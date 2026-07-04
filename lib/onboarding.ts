import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail, brandedEmail } from "@/lib/email";
import { randomId } from "@/lib/utils";
import type { Tech } from "@/lib/db/types";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const BRAND = "#db2777";

/** Immediate welcome email with the go-live checklist. */
export async function sendWelcomeEmail(tech: Tech): Promise<void> {
  const url = (p: string) => `${APP_URL}${p}`;
  const html = brandedEmail({
    brand: BRAND,
    businessName: "Glow",
    heading: `Welcome, ${tech.businessName}!`,
    bodyHtml:
      `Your booking page is ready at <strong>${APP_URL.replace(/^https?:\/\//, "")}/${tech.handle}</strong>.<br/><br/>` +
      `Three steps to your first booking:<br/><br/>` +
      `1. <a href="${url("/dashboard/services")}" style="color:${BRAND}">Add your services and prices</a><br/>` +
      `2. <a href="${url("/dashboard/availability")}" style="color:${BRAND}">Set your working hours</a><br/>` +
      `3. Put your link in your Instagram and TikTok bio<br/><br/>` +
      `Want card deposits paid straight to your bank? <a href="${url("/dashboard/payments")}" style="color:${BRAND}">Connect payouts</a> whenever you're ready.`,
    buttonLabel: "Open your dashboard",
    buttonUrl: url("/dashboard"),
  });
  await sendEmail({
    to: tech.email,
    subject: "Welcome to Glow - your booking page is ready",
    html,
    text: `Welcome to Glow! Your booking page: ${APP_URL}/${tech.handle}. Next: add services, set your hours, share your link. Dashboard: ${APP_URL}/dashboard`,
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
