import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getDashboardContext, invalidateDashboardTech } from "@/lib/auth/session";
import { createAuditEvent, getTechById, updateTech } from "@/lib/db/queries";
import {
  exchangeGoogleCode,
  googleAccountEmail,
  googleCalendarConfigured,
  googleRedirectUri,
  syncUpcomingBookingsToGoogle,
} from "@/lib/google-calendar";
import { GOOGLE_OAUTH_COOKIE } from "../connect/route";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function GET(request: Request) {
  const c = await getDashboardContext();
  if (!c) redirect("/login");
  if (!googleCalendarConfigured()) redirect("/dashboard/settings?google=missing");

  const url = new URL(request.url);
  const error = url.searchParams.get("error");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (error) redirect("/dashboard/settings?google=denied");

  const jar = await cookies();
  const raw = jar.get(GOOGLE_OAUTH_COOKIE)?.value;
  jar.delete(GOOGLE_OAUTH_COOKIE);

  let cookieState = "";
  let cookieTechId = "";
  try {
    const parsed = JSON.parse(raw ?? "") as { state?: string; techId?: string };
    cookieState = parsed.state ?? "";
    cookieTechId = parsed.techId ?? "";
  } catch {
    // Invalid cookie payload — fail closed below.
  }

  if (
    !code ||
    !state ||
    state !== cookieState ||
    cookieTechId !== c.tech.id
  ) {
    redirect("/dashboard/settings?google=failed");
  }

  try {
    const tokens = await exchangeGoogleCode({ code, redirectUri: googleRedirectUri(APP_URL) });
    const email = await googleAccountEmail(tokens.access_token);
    await updateTech(c.sb, c.tech.id, {
      googleRefreshToken: tokens.refresh_token ?? c.tech.googleRefreshToken,
      googleCalendarId: "primary",
      googleCalendarEmail: email,
      googleConnectedAt: new Date().toISOString(),
    });
    invalidateDashboardTech(c.tech.authUserId);
    await createAuditEvent(c.sb, {
      techId: c.tech.id,
      actor: "tech",
      action: "google_calendar_connected",
      entityType: "tech",
      entityId: c.tech.id,
      metadata: { email },
    });

    const updated = await getTechById(c.sb, c.tech.id);
    if (updated) {
      const sync = await syncUpcomingBookingsToGoogle(c.sb, updated);
      await createAuditEvent(c.sb, {
        techId: c.tech.id,
        actor: "system",
        action: "google_calendar_backfill",
        entityType: "tech",
        entityId: c.tech.id,
        metadata: sync,
      });
      redirect(
        `/dashboard/settings?google=connected&synced=${sync.synced}&failed=${sync.failed}&skipped=${sync.skipped}`,
      );
    }
  } catch {
    redirect("/dashboard/settings?google=failed");
  }

  redirect("/dashboard/settings?google=connected");
}
