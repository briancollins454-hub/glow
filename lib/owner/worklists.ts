/**
 * Lifecycle worklists (Phase 2.2) — actionable queues, not bare counts.
 */

import { supabaseService } from "@/lib/supabase/service";
import { filterOutInternal, shouldIncludeInternal } from "@/lib/owner/internal-accounts";
import { trialDaysLeft } from "@/lib/owner/accounts";
import { acceptsOnlineBookings, isLive } from "@/lib/subscriptions";
import { LIST_MONTHLY_PENNIES } from "@/lib/owner/mrr";
import type { Tech } from "@/lib/db/types";

export type WorklistKey =
  | "stalled_signups"
  | "setup_not_live"
  | "live_no_bookings"
  | "trial_cohort"
  | "at_risk"
  | "churn_watch"
  | "past_due"
  | "awaiting_migration";

export type WorklistRow = {
  techId: string;
  label: string;
  handle: string;
  email: string;
  blockingStep: string;
  daysInState: number;
  lastContact: string | null;
  tried: string[];
  href: string;
  meta?: Record<string, string | number | boolean | null>;
};

export type WorklistsSnapshot = {
  lists: Record<WorklistKey, WorklistRow[]>;
  generatedAt: string;
};

const DAY = 24 * 3600_000;

function daysSince(iso: string | null | undefined, now: number): number {
  if (!iso) return 0;
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / DAY));
}

async function lastOwnerContact(techId: string): Promise<{ at: string | null; tried: string[] }> {
  const sb = supabaseService();
  const tried: string[] = [];
  const { data: audits } = await sb
    .from("owner_audit")
    .select("action, createdAt")
    .eq("targetId", techId)
    .order("createdAt", { ascending: false })
    .limit(20);
  for (const a of audits ?? []) {
    if (
      String(a.action).includes("nudge") ||
      String(a.action).includes("setup_help") ||
      String(a.action).includes("win_back") ||
      String(a.action).includes("email")
    ) {
      tried.push(`${a.action} @ ${a.createdAt}`);
    }
  }
  const { data: notes } = await sb
    .from("owner_notes")
    .select("createdAt")
    .eq("techId", techId)
    .order("createdAt", { ascending: false })
    .limit(1);
  const at = notes?.[0]?.createdAt ?? audits?.[0]?.createdAt ?? null;
  return { at, tried: tried.slice(0, 5) };
}

export async function buildWorklists(): Promise<WorklistsSnapshot> {
  const sb = supabaseService();
  const includeInternal = await shouldIncludeInternal(sb);
  const now = Date.now();
  const d14 = new Date(now - 14 * DAY).toISOString();
  const d30 = new Date(now - 30 * DAY).toISOString();

  const { data } = await sb.from("techs").select("*").order("createdAt", { ascending: false }).limit(2000);
  const techs = filterOutInternal((data ?? []) as Tech[], includeInternal);

  const lists: Record<WorklistKey, WorklistRow[]> = {
    stalled_signups: [],
    setup_not_live: [],
    live_no_bookings: [],
    trial_cohort: [],
    at_risk: [],
    churn_watch: [],
    past_due: [],
    awaiting_migration: [],
  };

  // Observed trial→paid among finished trials (approx)
  const finishedTrials = techs.filter(
    (t) => t.signupOffer === "trial" && t.trialEndsAt && new Date(t.trialEndsAt).getTime() < now,
  );
  const converted = finishedTrials.filter((t) => t.subscriptionStatus === "active").length;
  const conversionRate =
    finishedTrials.length > 0 ? converted / finishedTrials.length : 0.35;

  for (const tech of techs) {
    const [svc, bookings14, contact] = await Promise.all([
      sb.from("services").select("id", { count: "exact", head: true }).eq("techId", tech.id),
      sb
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("techId", tech.id)
        .gte("createdAt", d14),
      lastOwnerContact(tech.id),
    ]);
    const serviceCount = svc.count ?? 0;
    const b14 = bookings14.count ?? 0;
    const base = {
      techId: tech.id,
      label: tech.businessName || tech.handle,
      handle: tech.handle,
      email: tech.email,
      lastContact: contact.at,
      tried: contact.tried,
      href: `/dashboard/admin/accounts/${tech.id}`,
    };

    if (serviceCount === 0 && tech.subscriptionStatus !== "canceled") {
      lists.stalled_signups.push({
        ...base,
        blockingStep: "No services created",
        daysInState: daysSince(tech.createdAt, now),
      });
    }

    if (serviceCount > 0 && tech.bookingPageLive === false && isLive(tech)) {
      lists.setup_not_live.push({
        ...base,
        blockingStep: "Services exist; booking page not live",
        daysInState: daysSince(tech.createdAt, now),
      });
    }

    if (acceptsOnlineBookings(tech) && serviceCount > 0 && b14 === 0) {
      lists.live_no_bookings.push({
        ...base,
        blockingStep: "Live with zero bookings in last 14 days",
        daysInState: daysSince(tech.createdAt, now),
      });
    }

    if (tech.subscriptionStatus === "trialing" || (tech.signupOffer === "trial" && tech.trialEndsAt && new Date(tech.trialEndsAt).getTime() > now)) {
      const dayN = tech.trialEndsAt
        ? Math.max(1, 14 - (trialDaysLeft(tech.trialEndsAt, now) ?? 0))
        : daysSince(tech.createdAt, now) + 1;
      lists.trial_cohort.push({
        ...base,
        blockingStep: `Trial day ${Math.min(14, dayN)} of 14`,
        daysInState: dayN,
        meta: {
          dayN: Math.min(14, dayN),
          cardOnFile: !!tech.stripeCustomerId,
          projectedChargeDate: tech.trialEndsAt ?? null,
          projectedAmountPennies: LIST_MONTHLY_PENNIES,
          predictedConversionPct: Math.round(conversionRate * 100),
          activationServices: serviceCount > 0,
          activationBookings: b14 > 0,
        },
      });
    }

    if (tech.healthBand === "at_risk" || tech.atRiskManual) {
      const reasons = Array.isArray(tech.healthReasons)
        ? (tech.healthReasons as { detail?: string }[])
            .slice(0, 2)
            .map((r) => r.detail)
            .filter(Boolean)
            .join("; ")
        : "";
      lists.at_risk.push({
        ...base,
        blockingStep: reasons || "Health band at_risk",
        daysInState: daysSince(tech.createdAt, now),
        meta: { healthScore: tech.healthScore ?? null, healthBand: tech.healthBand ?? null },
      });
    }

    if (
      (tech.subscriptionStatus === "canceled" || tech.subscriptionStatus === "past_due") &&
      (tech.currentPeriodEnd ? tech.currentPeriodEnd >= d30 : true)
    ) {
      lists.churn_watch.push({
        ...base,
        blockingStep:
          tech.subscriptionStatus === "past_due" ? "Past due — win-back / dunning" : "Cancelled in recent window",
        daysInState: daysSince(tech.currentPeriodEnd ?? tech.createdAt, now),
      });
    }

    if (tech.subscriptionStatus === "past_due") {
      lists.past_due.push({
        ...base,
        blockingStep: "Past due — page may go offline after warning",
        daysInState: daysSince(tech.currentPeriodEnd ?? tech.createdAt, now),
        meta: {
          bookingPageLive: tech.bookingPageLive !== false,
          periodEnd: tech.currentPeriodEnd ?? null,
        },
      });
    }

    const tags = tech.ownerTags ?? [];
    if (tags.some((t) => /migration/i.test(t))) {
      lists.awaiting_migration.push({
        ...base,
        blockingStep: "Tagged migration pending",
        daysInState: daysSince(tech.createdAt, now),
        meta: { tags: tags.join(", ") },
      });
    }
  }

  return { lists, generatedAt: new Date().toISOString() };
}

/** Pure predicate helpers for tests. */
export function matchesStalledSignup(opts: { serviceCount: number; subscriptionStatus: string }): boolean {
  return opts.serviceCount === 0 && opts.subscriptionStatus !== "canceled";
}

export function matchesSetupNotLive(opts: {
  serviceCount: number;
  bookingPageLive: boolean | null | undefined;
  live: boolean;
}): boolean {
  return opts.serviceCount > 0 && opts.bookingPageLive === false && opts.live;
}

export function matchesLiveNoBookings(opts: {
  accepting: boolean;
  serviceCount: number;
  bookings14d: number;
}): boolean {
  return opts.accepting && opts.serviceCount > 0 && opts.bookings14d === 0;
}
