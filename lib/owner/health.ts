/**
 * Account health score (Phase 2.1). Pure compute + daily persist/snapshot job.
 * Never display a bare score without reasons.
 */

import { supabaseService } from "@/lib/supabase/service";
import { acceptsOnlineBookings, isLive } from "@/lib/subscriptions";
import { planMrrPennies } from "@/lib/owner/mrr";
import { filterOutInternal } from "@/lib/owner/internal-accounts";
import type { Tech } from "@/lib/db/types";
import type { FeatureFlags } from "@/lib/owner/adoption";

function countByTechId(rows: { techId?: string | null }[] | null | undefined): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows ?? []) {
    if (!row.techId) continue;
    map.set(row.techId, (map.get(row.techId) ?? 0) + 1);
  }
  return map;
}

export type HealthReason = {
  factor: string;
  impact: number;
  detail: string;
};

export type HealthBand = "healthy" | "watch" | "at_risk";

export type HealthResult = {
  score: number;
  band: HealthBand;
  reasons: HealthReason[];
};

export type HealthSignals = {
  lastOwnerLoginAt: string | null;
  bookings14d: number;
  bookingsPrev14d: number;
  bookingPageLive: boolean;
  serviceCount: number;
  staffCount: number;
  hasRota: boolean;
  hasOpeningHours: boolean;
  stripeConnected: boolean;
  hasBranding: boolean;
  featureAdoptionCount: number;
  featureAdoptionTotal: number;
  emailDeliveryIssue: boolean;
  subscriptionStatus: string;
  atRiskManual: boolean;
  clientsNow: number;
  clientsPrevApprox: number;
  nowMs?: number;
};

const DAY = 24 * 3600_000;

export function bandForScore(score: number): HealthBand {
  if (score >= 70) return "healthy";
  if (score >= 40) return "watch";
  return "at_risk";
}

/**
 * Deterministic 0–100 score from signals. Impacts are negative; top reasons
 * are the most negative factors (sorted by |impact|).
 */
export function computeHealthFromSignals(s: HealthSignals): HealthResult {
  const now = s.nowMs ?? Date.now();
  const reasons: HealthReason[] = [];
  let score = 100;

  const push = (factor: string, impact: number, detail: string) => {
    if (impact === 0) return;
    reasons.push({ factor, impact, detail });
    score += impact;
  };

  // Owner login recency
  if (!s.lastOwnerLoginAt) {
    push("owner_login", -20, "No recorded owner login yet");
  } else {
    const age = now - new Date(s.lastOwnerLoginAt).getTime();
    if (age > 30 * DAY) push("owner_login", -25, "Owner last logged in over 30 days ago");
    else if (age > 14 * DAY) push("owner_login", -15, "Owner last logged in over 14 days ago");
    else if (age > 7 * DAY) push("owner_login", -5, "Owner last logged in over 7 days ago");
  }

  // Bookings trend
  if (s.bookingsPrev14d > 0) {
    const ratio = s.bookings14d / s.bookingsPrev14d;
    if (ratio < 0.5) {
      push(
        "bookings_trend",
        -20,
        `Bookings down ${Math.round((1 - ratio) * 100)}% vs prior 14 days (${s.bookings14d} vs ${s.bookingsPrev14d})`,
      );
    } else if (ratio < 0.8) {
      push(
        "bookings_trend",
        -10,
        `Bookings soft vs prior 14 days (${s.bookings14d} vs ${s.bookingsPrev14d})`,
      );
    }
  } else if (s.bookingPageLive && s.bookings14d === 0 && s.serviceCount > 0) {
    push("bookings_trend", -15, "Live with services but zero bookings in 14 days");
  }

  if (!s.bookingPageLive && s.serviceCount > 0) {
    push("booking_page", -10, "Services exist but booking page is not live");
  }

  // Setup completeness
  let setupHits = 0;
  if (s.serviceCount === 0) {
    push("setup_services", -10, "No services");
    setupHits++;
  }
  if (s.staffCount === 0) {
    push("setup_staff", -5, "No staff");
    setupHits++;
  }
  if (!s.hasOpeningHours) {
    push("setup_hours", -5, "No opening hours");
    setupHits++;
  }
  if (!s.hasRota && s.staffCount > 1) {
    push("setup_rota", -5, "Multi-staff without rota hours");
    setupHits++;
  }
  if (!s.stripeConnected) {
    push("setup_stripe", -8, "Stripe Connect not ready");
    setupHits++;
  }
  if (!s.hasBranding) {
    push("setup_branding", -3, "Branding incomplete (no photo or tagline)");
    setupHits++;
  }
  void setupHits;

  // Feature adoption breadth
  if (s.featureAdoptionTotal > 0) {
    const pct = s.featureAdoptionCount / s.featureAdoptionTotal;
    if (pct < 0.15) push("feature_adoption", -10, "Very low feature adoption");
    else if (pct < 0.3) push("feature_adoption", -5, "Low feature adoption");
  }

  if (s.emailDeliveryIssue) {
    push("deliverability", -15, "Account flagged for email delivery issues");
  }

  // Subscription state
  if (s.subscriptionStatus === "past_due") {
    push("subscription", -30, "Subscription past due");
  } else if (s.subscriptionStatus === "canceled") {
    push("subscription", -20, "Subscription cancelled");
  } else if (s.subscriptionStatus === "none") {
    push("subscription", -12, "No subscription");
  }

  if (s.atRiskManual) {
    push("manual_at_risk", -25, "Manually flagged at risk");
  }

  // Client trend (approx)
  if (s.clientsPrevApprox > 5 && s.clientsNow < s.clientsPrevApprox * 0.8) {
    push(
      "client_trend",
      -10,
      `Client count soft (${s.clientsNow} vs prior ~${s.clientsPrevApprox})`,
    );
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  reasons.sort((a, b) => a.impact - b.impact);
  return { score, band: bandForScore(score), reasons };
}

export function topHealthReasons(result: HealthResult, n = 2): HealthReason[] {
  return result.reasons.filter((r) => r.impact < 0).slice(0, n);
}

export async function gatherHealthSignals(
  tech: Tech,
  opts?: { featureFlags?: FeatureFlags },
): Promise<HealthSignals> {
  const sb = supabaseService();
  const now = Date.now();
  const d14 = new Date(now - 14 * DAY).toISOString();
  const d28 = new Date(now - 28 * DAY).toISOString();

  const [
    bookings14,
    bookingsPrev,
    services,
    staff,
    hours,
    rota,
    clients,
  ] = await Promise.all([
    sb
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("techId", tech.id)
      .gte("createdAt", d14),
    sb
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("techId", tech.id)
      .gte("createdAt", d28)
      .lt("createdAt", d14),
    sb.from("services").select("id", { count: "exact", head: true }).eq("techId", tech.id),
    sb
      .from("staff_members")
      .select("id", { count: "exact", head: true })
      .eq("techId", tech.id)
      .eq("active", true),
    sb
      .from("working_hours")
      .select("id", { count: "exact", head: true })
      .eq("techId", tech.id)
      .eq("enabled", true),
    sb.from("rota_hours").select("id", { count: "exact", head: true }).eq("techId", tech.id),
    sb.from("clients").select("id", { count: "exact", head: true }).eq("techId", tech.id),
  ]);

  let featureAdoptionCount = 0;
  let featureAdoptionTotal = 12;
  if (opts?.featureFlags) {
    const vals = Object.values(opts.featureFlags);
    featureAdoptionTotal = vals.length || 12;
    featureAdoptionCount = vals.filter(Boolean).length;
  }

  const hasBranding = !!(
    tech.tagline ||
    tech.coverPhotoPath ||
    tech.profilePhotoPath ||
    (tech.brandColor && tech.brandColor !== "#C4785A" && tech.brandColor !== "#c4785a")
  );

  return {
    lastOwnerLoginAt: tech.lastOwnerLoginAt ?? null,
    bookings14d: bookings14.count ?? 0,
    bookingsPrev14d: bookingsPrev.count ?? 0,
    bookingPageLive: tech.bookingPageLive !== false && acceptsOnlineBookings(tech),
    serviceCount: services.count ?? 0,
    staffCount: staff.count ?? 0,
    hasRota: (rota.count ?? 0) > 0,
    hasOpeningHours: (hours.count ?? 0) > 0,
    stripeConnected: !!tech.connectChargesEnabled,
    hasBranding,
    featureAdoptionCount,
    featureAdoptionTotal,
    emailDeliveryIssue: !!tech.emailDeliveryIssue,
    subscriptionStatus: tech.subscriptionStatus,
    atRiskManual: !!tech.atRiskManual,
    clientsNow: clients.count ?? 0,
    clientsPrevApprox: clients.count ?? 0,
    nowMs: now,
  };
}

/**
 * Recompute health for non-internal techs and write daily snapshots.
 * Batched reads (not N+1 per account) so the Ops button and cron finish
 * inside serverless time limits.
 */
export async function runHealthAndSnapshotJob(opts?: {
  /** Soft cap for manual runs; cron can pass a higher limit. */
  limit?: number;
}): Promise<{
  updated: number;
  snapshotted: number;
  errors: number;
}> {
  const sb = supabaseService();
  const limit = opts?.limit ?? 500;
  const { data, error: techErr } = await sb
    .from("techs")
    .select(
      "id, handle, businessName, email, plan, subscriptionStatus, bookingPageLive, blockedAt, connectChargesEnabled, lastOwnerLoginAt, emailDeliveryIssue, atRiskManual, isInternal, tagline, coverPhotoPath, profilePhotoPath, brandColor, smsRemindersEnabled, loyaltyVisitThreshold, minNoticeHours, googleConnectedAt, googleRefreshToken, noShowProtection, clientPaymentsEnabled, createdAt",
    )
    .order("createdAt", { ascending: false })
    .limit(limit);
  if (techErr) throw new Error(techErr.message);

  const techs = filterOutInternal((data ?? []) as Tech[], false);
  if (techs.length === 0) {
    return { updated: 0, snapshotted: 0, errors: 0 };
  }

  const now = Date.now();
  const d14 = new Date(now - 14 * DAY).toISOString();
  const d28 = new Date(now - 28 * DAY).toISOString();
  const today = new Date(now).toISOString().slice(0, 10);
  const techIds = techs.map((t) => t.id);

  // Batched signal loads (chunk .in() to stay under PostgREST URL limits).
  const bookings14 = new Map<string, number>();
  const bookingsPrev = new Map<string, number>();
  const serviceCounts = new Map<string, number>();
  const staffCounts = new Map<string, number>();
  const hourCounts = new Map<string, number>();
  const rotaCounts = new Map<string, number>();
  const clientCounts = new Map<string, number>();

  for (let i = 0; i < techIds.length; i += 100) {
    const chunk = techIds.slice(i, i + 100);
    const [b28, services, staff, hours, rota, clients] = await Promise.all([
      sb
        .from("bookings")
        .select("techId, createdAt")
        .in("techId", chunk)
        .gte("createdAt", d28)
        .limit(20_000),
      sb.from("services").select("techId").in("techId", chunk).limit(20_000),
      sb
        .from("staff_members")
        .select("techId")
        .in("techId", chunk)
        .eq("active", true)
        .limit(20_000),
      sb
        .from("working_hours")
        .select("techId")
        .in("techId", chunk)
        .eq("enabled", true)
        .limit(20_000),
      sb.from("rota_hours").select("techId").in("techId", chunk).limit(20_000),
      sb.from("clients").select("techId").in("techId", chunk).limit(50_000),
    ]);

    for (const row of b28.data ?? []) {
      if (!row.techId) continue;
      if (row.createdAt >= d14) {
        bookings14.set(row.techId, (bookings14.get(row.techId) ?? 0) + 1);
      } else {
        bookingsPrev.set(row.techId, (bookingsPrev.get(row.techId) ?? 0) + 1);
      }
    }
    for (const [k, v] of countByTechId(services.data)) {
      serviceCounts.set(k, (serviceCounts.get(k) ?? 0) + v);
    }
    for (const [k, v] of countByTechId(staff.data)) {
      staffCounts.set(k, (staffCounts.get(k) ?? 0) + v);
    }
    for (const [k, v] of countByTechId(hours.data)) {
      hourCounts.set(k, (hourCounts.get(k) ?? 0) + v);
    }
    for (const [k, v] of countByTechId(rota.data)) {
      rotaCounts.set(k, (rotaCounts.get(k) ?? 0) + v);
    }
    for (const [k, v] of countByTechId(clients.data)) {
      clientCounts.set(k, (clientCounts.get(k) ?? 0) + v);
    }
  }

  let updated = 0;
  let snapshotted = 0;
  let errors = 0;

  // Persist in small parallel batches (writes only — signals already in memory).
  for (let i = 0; i < techs.length; i += 10) {
    const batch = techs.slice(i, i + 10);
    await Promise.all(
      batch.map(async (tech) => {
        try {
          const serviceCount = serviceCounts.get(tech.id) ?? 0;
          const staffCount = staffCounts.get(tech.id) ?? 0;
          const hasRota = (rotaCounts.get(tech.id) ?? 0) > 0;
          const hasOpeningHours = (hourCounts.get(tech.id) ?? 0) > 0;
          const hasBranding = !!(
            tech.tagline ||
            tech.coverPhotoPath ||
            tech.profilePhotoPath ||
            (tech.brandColor && tech.brandColor !== "#C4785A" && tech.brandColor !== "#c4785a")
          );

          // Lightweight adoption proxy for daily job (full matrix is on /adoption).
          const lightFlags: FeatureFlags = {
            deposits: false,
            card_capture: tech.noShowProtection === "card_capture" && !!tech.connectChargesEnabled,
            sms_reminders: !!tech.smsRemindersEnabled,
            loyalty: (tech.loyaltyVisitThreshold ?? 0) > 0,
            min_notice: (tech.minNoticeHours ?? 0) > 0,
            multi_staff: staffCount > 1,
            rota: hasRota,
            client_payments: tech.clientPaymentsEnabled !== false && !!tech.connectChargesEnabled,
            google_calendar: !!(tech.googleConnectedAt || tech.googleRefreshToken),
          };
          const flagVals = Object.values(lightFlags).filter((v) => typeof v === "boolean");
          const featureAdoptionCount = flagVals.filter(Boolean).length;
          const featureAdoptionTotal = flagVals.length || 1;

          const signals: HealthSignals = {
            lastOwnerLoginAt: tech.lastOwnerLoginAt ?? null,
            bookings14d: bookings14.get(tech.id) ?? 0,
            bookingsPrev14d: bookingsPrev.get(tech.id) ?? 0,
            bookingPageLive: tech.bookingPageLive !== false && acceptsOnlineBookings(tech),
            serviceCount,
            staffCount,
            hasRota,
            hasOpeningHours,
            stripeConnected: !!tech.connectChargesEnabled,
            hasBranding,
            featureAdoptionCount,
            featureAdoptionTotal,
            emailDeliveryIssue: !!tech.emailDeliveryIssue,
            subscriptionStatus: tech.subscriptionStatus,
            atRiskManual: !!tech.atRiskManual,
            clientsNow: clientCounts.get(tech.id) ?? 0,
            clientsPrevApprox: clientCounts.get(tech.id) ?? 0,
            nowMs: now,
          };

          const health = computeHealthFromSignals(signals);
          const { error: upErr } = await sb
            .from("techs")
            .update({
              healthScore: health.score,
              healthBand: health.band,
              healthReasons: health.reasons.slice(0, 8),
            })
            .eq("id", tech.id);
          if (upErr) throw new Error(upErr.message);
          updated++;

          const { error: snapErr } = await sb.from("account_snapshots").upsert(
            {
              id: `asnp_${tech.id}_${today}`,
              techId: tech.id,
              snapshotDate: today,
              subscriptionStatus: tech.subscriptionStatus,
              mrrPennies:
                tech.subscriptionStatus === "active" ? planMrrPennies(tech.plan) : 0,
              bookings14d: signals.bookings14d,
              bookingsPrev14d: signals.bookingsPrev14d,
              clientCount: signals.clientsNow,
              staffCount: signals.staffCount,
              servicesCount: signals.serviceCount,
              bookingPageLive: signals.bookingPageLive,
              healthScore: health.score,
              featureFlags: lightFlags,
            },
            { onConflict: "techId,snapshotDate" },
          );
          if (!snapErr) snapshotted++;
        } catch {
          errors++;
        }
      }),
    );
  }

  return { updated, snapshotted, errors };
}

/** Convenience for UI: health label with top reasons. */
export function formatHealthLabel(tech: Pick<Tech, "healthScore" | "healthBand" | "healthReasons">): {
  score: string;
  band: string;
  reasons: string;
} {
  if (tech.healthScore == null) {
    return { score: "—", band: "—", reasons: "Not yet scored (daily job pending)" };
  }
  const reasons = Array.isArray(tech.healthReasons)
    ? (tech.healthReasons as HealthReason[])
        .filter((r) => r.impact < 0)
        .slice(0, 2)
        .map((r) => r.detail)
        .join("; ")
    : "";
  return {
    score: String(tech.healthScore),
    band: tech.healthBand || bandForScore(tech.healthScore),
    reasons: reasons || "No negative factors",
  };
}

export function isLiveSetup(tech: Tech): boolean {
  return isLive(tech);
}
