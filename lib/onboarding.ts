import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail, brandedEmail } from "@/lib/email";
import { adminEmails } from "@/lib/admin";
import { randomId } from "@/lib/ids";
import type { Tech } from "@/lib/db/types";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const BRAND = "#db2777";

/**
 * Alert the platform owner(s) that a new tech has signed up. Best-effort: sent
 * to every address in ADMIN_EMAILS so Brian (and any future owners) get a
 * heads-up the moment an account is created, before they've paid.
 */
export async function notifyOwnerOfSignup(tech: Tech): Promise<void> {
  const recipients = adminEmails();
  if (recipients.length === 0) return;

  const dash = (p: string) => `${APP_URL}${p}`;
  const pageUrl = `${APP_URL.replace(/^https?:\/\//, "")}/${tech.handle}`;
  const referredLine = tech.referredBy
    ? `Referred by: <strong>${tech.referredBy}</strong><br/>`
    : "";
  const offerLine = tech.signupOffer === "tester" ? "Tester (£1 first month)" : "Standard (£9.50 first month)";

  const html = brandedEmail({
    brand: BRAND,
    businessName: "Glow",
    heading: "New signup",
    bodyHtml:
      `A new tech just created an account.<br/><br/>` +
      `Business: <strong>${tech.businessName || "(not set)"}</strong><br/>` +
      `Name: ${tech.name || "(not set)"}<br/>` +
      `Email: ${tech.email}<br/>` +
      `Booking link: ${pageUrl}<br/>` +
      `Offer: ${offerLine}<br/>` +
      referredLine +
      `<br/>They have <strong>not paid yet</strong> - they need to activate a plan before they can take bookings.`,
    buttonLabel: "Open the owner dashboard",
    buttonUrl: dash("/dashboard/admin"),
  });

  await sendEmail({
    to: recipients,
    subject: `New Glow signup: ${tech.businessName || tech.email}`,
    html,
    text:
      `New Glow signup.\n\n` +
      `Business: ${tech.businessName || "(not set)"}\n` +
      `Name: ${tech.name || "(not set)"}\n` +
      `Email: ${tech.email}\n` +
      `Booking link: ${pageUrl}\n` +
      `Offer: ${offerLine}\n` +
      `${tech.referredBy ? `Referred by: ${tech.referredBy}\n` : ""}` +
      `\nThey have not paid yet. Owner dashboard: ${dash("/dashboard/admin")}`,
    idempotencyKey: `owner-signup/${tech.id}`,
  });
}

/** Immediate welcome email with the go-live checklist. */
export async function sendWelcomeEmail(tech: Tech): Promise<void> {
  const url = (p: string) => `${APP_URL}${p}`;
  const price = tech.signupOffer === "tester" ? "£1" : "£9.50";
  const html = brandedEmail({
    brand: BRAND,
    businessName: "Glow",
    heading: `Welcome, ${tech.businessName}!`,
    bodyHtml:
      `Your booking page is reserved at <strong>${APP_URL.replace(/^https?:\/\//, "")}/${tech.handle}</strong>.<br/><br/>` +
      `Three steps to your first booking:<br/><br/>` +
      `1. <a href="${url("/dashboard/billing")}" style="color:${BRAND}">Activate your plan</a> (${price} for your first month, then £19/mo)<br/>` +
      `2. <a href="${url("/dashboard/services")}" style="color:${BRAND}">Add your services and prices</a><br/>` +
      `3. Set your hours and put your link in your Instagram and TikTok bio<br/><br/>` +
      `Activating unlocks your services, availability, deposits and client messaging - and switches your booking page on so clients can book.`,
    buttonLabel: `Activate for ${price}`,
    buttonUrl: url("/dashboard/billing"),
  });
  await sendEmail({
    to: tech.email,
    subject: "Welcome to Glow - activate your booking page",
    html,
    text: `Welcome to Glow! Your booking page: ${APP_URL}/${tech.handle}. First, activate your plan (${price} first month, then £19/mo) to unlock your tools and switch on bookings: ${APP_URL}/dashboard/billing`,
    idempotencyKey: `welcome/${tech.id}`,
  });
}

/** Queue the follow-up nudge (sent by the cron route). */
export async function scheduleOnboardingEmails(sb: SupabaseClient, techId: string): Promise<void> {
  const { error } = await sb.from("onboarding_emails").insert({
    id: randomId("ob"),
    techId,
    kind: "setup_nudge",
    sendAtIso: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    status: "scheduled",
  });
  if (error) throw new Error(error.message);
}

/** Send any due onboarding emails. Called from the reminders cron. */
export async function processDueOnboardingEmails(sb: SupabaseClient): Promise<number> {
  const { data, error } = await sb
    .from("onboarding_emails")
    .select("*")
    .eq("status", "scheduled")
    .lte("sendAtIso", new Date().toISOString());
  if (error) throw new Error(error.message);
  let sent = 0;

  for (const row of data ?? []) {
    const { data: tech } = await sb.from("techs").select("*").eq("id", row.techId).maybeSingle();
    if (tech && row.kind === "setup_nudge") {
      // Skip if they're already fully set up and live.
      const { count: serviceCount } = await sb
        .from("services")
        .select("id", { count: "exact", head: true })
        .eq("techId", tech.id);
      const live = ["trialing", "active", "comped"].includes(tech.subscriptionStatus);
      if (!(live && (serviceCount ?? 0) > 0)) {
        const html = brandedEmail({
          brand: BRAND,
          businessName: "Glow",
          heading: "Your booking page is nearly there",
          bodyHtml:
            `Hi ${tech.name?.split(" ")[0] || "there"},<br/><br/>` +
            `Your page <strong>${APP_URL.replace(/^https?:\/\//, "")}/${tech.handle}</strong> is one or two steps from taking bookings:` +
            `<br/><br/>` +
            `${(serviceCount ?? 0) === 0 ? `&bull; Add at least one service<br/>` : ""}` +
            `${!live ? `&bull; Start your plan so clients can book online (50% off your first month)<br/>` : ""}` +
            `<br/>It takes about five minutes. Reply to this email if you're stuck and a human will help.`,
          buttonLabel: "Finish setting up",
          buttonUrl: `${APP_URL}/dashboard`,
        });
        await sendEmail({
          to: tech.email,
          subject: "Finish your Glow setup (5 minutes)",
          html,
          text: `Your Glow page ${APP_URL}/${tech.handle} is nearly ready. Finish setting up: ${APP_URL}/dashboard`,
          idempotencyKey: `onboarding/${row.id}`,
        });
        sent++;
      }
    }
    await sb.from("onboarding_emails").update({ status: "sent" }).eq("id", row.id);
  }
  return sent;
}
