import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail, brandedEmail, isValidEmail } from "@/lib/email";
import { fmtDate } from "@/lib/format";
import { salonTz } from "@/lib/locale";
import { MONTHLY_PRICE_LABEL, TRIAL_DAYS } from "@/lib/offers";
import type { Tech } from "@/lib/db/types";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const BRAND = "#db2777";
const DAY_MS = 24 * 60 * 60 * 1000;

export function trialDaysRemaining(trialEndsAt: string | null | undefined, nowMs = Date.now()): number {
  if (!trialEndsAt) return 0;
  return Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - nowMs) / DAY_MS));
}

export function isOnFrozenTrial(tech: Pick<Tech, "signupOffer" | "subscriptionStatus" | "trialEndsAt">): boolean {
  return tech.signupOffer === "trial" && tech.subscriptionStatus === "trialing";
}

function cancelUrl(): string {
  return `${APP_URL}/dashboard/billing`;
}

async function sendTrialEmail(opts: {
  tech: Tech;
  subject: string;
  heading: string;
  bodyHtml: string;
  text: string;
  idempotencyKey: string;
  kind: string;
}): Promise<boolean> {
  if (!isValidEmail(opts.tech.email)) return false;
  const html = brandedEmail({
    brand: BRAND,
    businessName: "Glow",
    heading: opts.heading,
    bodyHtml: opts.bodyHtml,
    buttonLabel: "Manage billing",
    buttonUrl: cancelUrl(),
  });
  return sendEmail({
    to: opts.tech.email,
    subject: opts.subject,
    html,
    text: opts.text,
    idempotencyKey: opts.idempotencyKey,
    techId: opts.tech.id,
    kind: opts.kind,
  });
}

/** Day 7 — halfway check-in. */
export async function sendTrialDay7Email(tech: Tech): Promise<boolean> {
  const ends = tech.trialEndsAt ? fmtDate(tech.trialEndsAt, salonTz(tech)) : "the end of your trial";
  return sendTrialEmail({
    tech,
    subject: "You're halfway through your Glow trial",
    heading: "Halfway there",
    bodyHtml:
      `Hi ${tech.name || "there"},<br/><br/>` +
      `You're halfway through your 14-day Glow trial. Here's a quick nudge to finish setup if you haven't already — services, hours, and your booking page.<br/><br/>` +
      `Your trial ends on <strong>${ends}</strong>. On that day your card will be charged <strong>${MONTHLY_PRICE_LABEL}</strong> and your subscription continues monthly. Cancel any time before then from Billing and you won't be charged.`,
    text:
      `You're halfway through your Glow trial. It ends on ${ends}; your card will be charged ${MONTHLY_PRICE_LABEL} then. Cancel any time before: ${cancelUrl()}`,
    idempotencyKey: `trial-day7/${tech.id}`,
    kind: "trial_day7",
  });
}

/** Day 11 — 3 days before charge. */
export async function sendTrialDay11Email(tech: Tech): Promise<boolean> {
  const ends = tech.trialEndsAt ? fmtDate(tech.trialEndsAt, salonTz(tech)) : "in 3 days";
  return sendTrialEmail({
    tech,
    subject: `Your Glow trial ends in 3 days — ${MONTHLY_PRICE_LABEL} on ${ends}`,
    heading: "Your trial ends in 3 days",
    bodyHtml:
      `Hi ${tech.name || "there"},<br/><br/>` +
      `Your free trial ends in <strong>3 days</strong> (${ends}). Your card will be charged <strong>${MONTHLY_PRICE_LABEL}</strong> on that date and your subscription continues monthly.<br/><br/>` +
      `Don't want to continue? <a href="${cancelUrl()}">Cancel before ${ends}</a> and you won't be charged.`,
    text:
      `Your Glow trial ends in 3 days (${ends}). Your card will be charged ${MONTHLY_PRICE_LABEL} then. Cancel before then: ${cancelUrl()}`,
    idempotencyKey: `trial-day11/${tech.id}`,
    kind: "trial_day11",
  });
}

/** Day 13 — 1 day before charge. */
export async function sendTrialDay13Email(tech: Tech): Promise<boolean> {
  const ends = tech.trialEndsAt ? fmtDate(tech.trialEndsAt, salonTz(tech)) : "tomorrow";
  return sendTrialEmail({
    tech,
    subject: `Tomorrow: your Glow trial ends — ${MONTHLY_PRICE_LABEL} charge`,
    heading: "Your trial ends tomorrow",
    bodyHtml:
      `Hi ${tech.name || "there"},<br/><br/>` +
      `<strong>Tomorrow</strong> (${ends}) your Glow trial ends and your card will be charged <strong>${MONTHLY_PRICE_LABEL}</strong>. Your subscription then continues monthly.<br/><br/>` +
      `To avoid the charge, <a href="${cancelUrl()}">cancel today</a>.`,
    text:
      `Tomorrow (${ends}) your Glow trial ends and your card will be charged ${MONTHLY_PRICE_LABEL}. Cancel today to avoid the charge: ${cancelUrl()}`,
    idempotencyKey: `trial-day13/${tech.id}`,
    kind: "trial_day13",
  });
}

export async function sendTrialFirstChargeSuccessEmail(tech: Tech): Promise<boolean> {
  return sendTrialEmail({
    tech,
    subject: `You're live on Glow — ${MONTHLY_PRICE_LABEL}/month`,
    heading: "You're subscribed",
    bodyHtml:
      `Hi ${tech.name || "there"},<br/><br/>` +
      `Your free trial has ended and we've charged <strong>${MONTHLY_PRICE_LABEL}</strong> for your first month of Glow. Your subscription continues monthly — manage or cancel any time from Billing.`,
    text: `Your Glow trial ended and we charged ${MONTHLY_PRICE_LABEL}. Manage billing: ${cancelUrl()}`,
    idempotencyKey: `trial-first-charge-ok/${tech.id}/${tech.stripeSubscriptionId ?? "sub"}`,
    kind: "trial_first_charge_ok",
  });
}

export async function sendTrialFirstChargeFailedEmail(tech: Tech): Promise<boolean> {
  return sendTrialEmail({
    tech,
    subject: "We couldn't charge your Glow subscription",
    heading: "Payment failed",
    bodyHtml:
      `Hi ${tech.name || "there"},<br/><br/>` +
      `Your Glow trial ended but we couldn't charge your card for <strong>${MONTHLY_PRICE_LABEL}</strong>. Please update your payment method in Billing so your booking page stays online. We'll retry automatically.`,
    text: `We couldn't charge ${MONTHLY_PRICE_LABEL} for Glow. Update your card: ${cancelUrl()}`,
    idempotencyKey: `trial-first-charge-fail/${tech.id}/${tech.stripeSubscriptionId ?? "sub"}`,
    kind: "trial_first_charge_fail",
  });
}

export async function sendPastDueWarningEmail(tech: Tech): Promise<boolean> {
  return sendTrialEmail({
    tech,
    subject: "Action needed: Glow payment past due",
    heading: "Payment past due",
    bodyHtml:
      `Hi ${tech.name || "there"},<br/><br/>` +
      `Your Glow subscription payment is past due. Please update your card in Billing. If payment isn't resolved after Stripe's retries, your public booking page will be taken offline — we'll email you again before that happens.`,
    text: `Glow payment past due. Update your card: ${cancelUrl()}`,
    idempotencyKey: `past-due-warn/${tech.id}/${(tech.currentPeriodEnd ?? "").slice(0, 10)}`,
    kind: "past_due_warn",
  });
}

export async function sendBookingPageOfflineWarningEmail(tech: Tech): Promise<boolean> {
  return sendTrialEmail({
    tech,
    subject: "Your Glow booking page will go offline soon",
    heading: "Booking page at risk",
    bodyHtml:
      `Hi ${tech.name || "there"},<br/><br/>` +
      `We still haven't received payment for your Glow subscription. Your public booking page will be taken offline if this isn't fixed. Update your card now: <a href="${cancelUrl()}">Billing</a>.`,
    text: `Your Glow booking page will go offline soon without payment. Update card: ${cancelUrl()}`,
    idempotencyKey: `booking-offline-warn/${tech.id}/${(tech.currentPeriodEnd ?? "").slice(0, 10)}`,
    kind: "booking_offline_warn",
  });
}

/**
 * Cron: send day 7 / 11 / 13 trial warning emails based on trialEndsAt.
 * Idempotent via per-tech sent-at stamps.
 */
export async function processTrialLifecycleEmails(
  sb: SupabaseClient,
  nowMs = Date.now(),
): Promise<{ sent: number }> {
  let sent = 0;
  const { data, error } = await sb
    .from("techs")
    .select("*")
    .eq("signupOffer", "trial")
    .eq("subscriptionStatus", "trialing")
    .not("trialEndsAt", "is", null)
    .limit(200);
  if (error || !data?.length) return { sent };

  for (const row of data) {
    const tech = row as Tech;
    if (!tech.trialEndsAt) continue;
    const ends = new Date(tech.trialEndsAt).getTime();
    const daysLeft = Math.ceil((ends - nowMs) / DAY_MS);
    const startedApprox = ends - TRIAL_DAYS * DAY_MS;
    const daysSinceStart = Math.floor((nowMs - startedApprox) / DAY_MS);

    const patch: Partial<Tech> = {};

    if (daysSinceStart >= 7 && daysLeft > 3 && !tech.trialWarningDay7SentAt) {
      if (await sendTrialDay7Email(tech)) {
        patch.trialWarningDay7SentAt = new Date(nowMs).toISOString();
        sent++;
      }
    }
    if (daysLeft <= 3 && daysLeft > 1 && !tech.trialWarningDay11SentAt) {
      if (await sendTrialDay11Email(tech)) {
        patch.trialWarningDay11SentAt = new Date(nowMs).toISOString();
        sent++;
      }
    }
    if (daysLeft <= 1 && daysLeft >= 0 && !tech.trialWarningDay13SentAt) {
      if (await sendTrialDay13Email(tech)) {
        patch.trialWarningDay13SentAt = new Date(nowMs).toISOString();
        sent++;
      }
    }

    if (Object.keys(patch).length) {
      await sb.from("techs").update(patch).eq("id", tech.id);
    }
  }
  return { sent };
}

/** Pure helper for tests: which warning emails are due. */
export function trialWarningsDue(opts: {
  trialEndsAt: string;
  nowMs: number;
  day7Sent: boolean;
  day11Sent: boolean;
  day13Sent: boolean;
}): Array<"day7" | "day11" | "day13"> {
  const ends = new Date(opts.trialEndsAt).getTime();
  const daysLeft = Math.ceil((ends - opts.nowMs) / DAY_MS);
  const startedApprox = ends - TRIAL_DAYS * DAY_MS;
  const daysSinceStart = Math.floor((opts.nowMs - startedApprox) / DAY_MS);
  const due: Array<"day7" | "day11" | "day13"> = [];
  if (daysSinceStart >= 7 && daysLeft > 3 && !opts.day7Sent) due.push("day7");
  if (daysLeft <= 3 && daysLeft > 1 && !opts.day11Sent) due.push("day11");
  if (daysLeft <= 1 && daysLeft >= 0 && !opts.day13Sent) due.push("day13");
  return due;
}
