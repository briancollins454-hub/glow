/**
 * Feature adoption matrix (Phase 2.3) — actual usage, not mere availability.
 */

import { supabaseService } from "@/lib/supabase/service";
import { filterOutInternal, shouldIncludeInternal } from "@/lib/owner/internal-accounts";
import { usesCardCapture, salonTakesClientPayments } from "@/lib/subscriptions";
import type { Tech } from "@/lib/db/types";

export type FeatureKey =
  | "deposits"
  | "card_capture"
  | "consent_forms"
  | "service_scoped_questions"
  | "signed_consent"
  | "waitlist"
  | "loyalty"
  | "reviews"
  | "email_reminders"
  | "sms_reminders"
  | "min_notice"
  | "multi_staff"
  | "rota"
  | "referral_used"
  | "imports_run"
  | "client_payments"
  | "google_calendar"
  | "add_ons";

export type FeatureFlags = Partial<Record<FeatureKey, boolean>> & {
  depositsPercent?: number;
};

export const FEATURE_LABELS: Record<FeatureKey, string> = {
  deposits: "Deposits",
  card_capture: "Card-on-file",
  consent_forms: "Consent forms",
  service_scoped_questions: "Per-service questions",
  signed_consent: "Signed consent",
  waitlist: "Waitlist",
  loyalty: "Loyalty",
  reviews: "Reviews",
  email_reminders: "Email reminders",
  sms_reminders: "SMS reminders",
  min_notice: "Min notice",
  multi_staff: "Multi-staff",
  rota: "Rota",
  referral_used: "Referral used",
  imports_run: "Imports run",
  client_payments: "Client payments",
  google_calendar: "Google Calendar",
  add_ons: "Add-ons",
};

export type AdoptionRow = {
  tech: Pick<Tech, "id" | "businessName" | "handle" | "email" | "bookingPageLive" | "isInternal">;
  flags: FeatureFlags;
  suspicious: string[];
};

export type AdoptionMatrix = {
  rows: AdoptionRow[];
  platformPercent: Record<FeatureKey, number>;
  generatedAt: string;
  note: string;
};

export async function probeFeatureFlags(tech: Tech): Promise<FeatureFlags> {
  const sb = supabaseService();
  const id = tech.id;

  const [
    services,
    staff,
    questions,
    consents,
    waitlist,
    reviews,
    reminders,
    rota,
    referred,
    imports,
    addons,
    payments,
  ] = await Promise.all([
    sb
      .from("services")
      .select("id, depositType, active")
      .eq("techId", id)
      .limit(500),
    sb
      .from("staff_members")
      .select("id", { count: "exact", head: true })
      .eq("techId", id)
      .eq("active", true),
    sb
      .from("consultation_questions")
      .select("id, serviceId")
      .eq("techId", id)
      .limit(200),
    sb.from("consent_records").select("id", { count: "exact", head: true }).eq("techId", id),
    sb.from("waitlist_entries").select("id", { count: "exact", head: true }).eq("techId", id),
    sb.from("reviews").select("id", { count: "exact", head: true }).eq("techId", id),
    sb
      .from("reminders")
      .select("id", { count: "exact", head: true })
      .eq("techId", id)
      .eq("status", "sent")
      .eq("channel", "email"),
    sb.from("rota_hours").select("id", { count: "exact", head: true }).eq("techId", id),
    sb.from("techs").select("id", { count: "exact", head: true }).eq("referredBy", tech.handle),
    sb
      .from("audit_events")
      .select("id", { count: "exact", head: true })
      .eq("techId", id)
      .or("action.ilike.%import%,action.ilike.%support_import%"),
    sb.from("service_addons").select("id", { count: "exact", head: true }).eq("techId", id),
    sb
      .from("payments")
      .select("id", { count: "exact", head: true })
      .eq("techId", id)
      .eq("status", "succeeded")
      .limit(1),
  ]);

  const svc = services.data ?? [];
  const active = svc.filter((s) => s.active !== false);
  const withDeposit = active.filter((s) => s.depositType && s.depositType !== "none");
  const depositsPercent =
    active.length === 0 ? 0 : Math.round((withDeposit.length / active.length) * 100);

  const q = questions.data ?? [];
  const hasScoped = q.some((row) => !!row.serviceId);

  let smsReminders = !!tech.smsRemindersEnabled;
  if (!smsReminders) {
    const { count } = await sb
      .from("outbound_sends")
      .select("id", { count: "exact", head: true })
      .eq("techId", id)
      .eq("channel", "sms")
      .eq("ok", true);
    smsReminders = (count ?? 0) > 0;
  }

  return {
    deposits: withDeposit.length > 0,
    depositsPercent,
    card_capture: usesCardCapture(tech),
    consent_forms: q.length > 0,
    service_scoped_questions: hasScoped,
    signed_consent: (consents.count ?? 0) > 0,
    waitlist: (waitlist.count ?? 0) > 0,
    loyalty: (tech.loyaltyVisitThreshold ?? 0) > 0,
    reviews: (reviews.count ?? 0) > 0,
    email_reminders: (reminders.count ?? 0) > 0,
    sms_reminders: smsReminders,
    min_notice: (tech.minNoticeHours ?? 0) > 0,
    multi_staff: (staff.count ?? 0) > 1,
    rota: (rota.count ?? 0) > 0,
    referral_used: (referred.count ?? 0) > 0,
    imports_run: (imports.count ?? 0) > 0,
    client_payments: salonTakesClientPayments(tech) && (payments.count ?? 0) > 0,
    google_calendar: !!(tech.googleConnectedAt || tech.googleRefreshToken),
    add_ons: (addons.count ?? 0) > 0,
  };
}

function suspiciousFor(tech: Tech, flags: FeatureFlags): string[] {
  const out: string[] = [];
  if (flags.deposits && (flags.depositsPercent ?? 0) < 10) {
    out.push("Deposits on under 10% of services");
  }
  if (tech.bookingPageLive !== false && !flags.email_reminders) {
    out.push("Reminders appear unused");
  }
  if (tech.bookingPageLive !== false && flags.multi_staff && !flags.rota) {
    out.push("Page live with multi-staff but no rota");
  }
  return out;
}

export async function getAdoptionMatrix(opts?: { limit?: number }): Promise<AdoptionMatrix> {
  const sb = supabaseService();
  const includeInternal = await shouldIncludeInternal(sb);
  const { data } = await sb
    .from("techs")
    .select("*")
    .order("createdAt", { ascending: false })
    .limit(opts?.limit ?? 80);
  const techs = filterOutInternal((data ?? []) as Tech[], includeInternal);

  const rows: AdoptionRow[] = [];
  const counts = {} as Record<FeatureKey, number>;
  const keys = Object.keys(FEATURE_LABELS) as FeatureKey[];
  for (const k of keys) counts[k] = 0;

  for (const tech of techs) {
    const flags = await probeFeatureFlags(tech);
    for (const k of keys) {
      if (flags[k]) counts[k]++;
    }
    rows.push({
      tech: {
        id: tech.id,
        businessName: tech.businessName,
        handle: tech.handle,
        email: tech.email,
        bookingPageLive: tech.bookingPageLive,
        isInternal: tech.isInternal,
      },
      flags,
      suspicious: suspiciousFor(tech, flags),
    });
  }

  const denom = Math.max(1, rows.length);
  const platformPercent = {} as Record<FeatureKey, number>;
  for (const k of keys) {
    platformPercent[k] = Math.round((counts[k] / denom) * 1000) / 10;
  }

  return {
    rows,
    platformPercent,
    generatedAt: new Date().toISOString(),
    note: "Gift vouchers and multi-location are not in the schema yet — omitted. Usage is evidence-based where possible.",
  };
}
