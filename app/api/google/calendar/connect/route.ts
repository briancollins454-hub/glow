import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getDashboardContext } from "@/lib/auth/session";
import { googleAuthUrl, googleCalendarConfigured, googleRedirectUri } from "@/lib/google-calendar";
import { randomToken } from "@/lib/ids";
import { GOOGLE_OAUTH_COOKIE } from "@/lib/google-oauth";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function GET() {
  const c = await getDashboardContext();
  if (!c) redirect("/login");
  if (!googleCalendarConfigured()) redirect("/dashboard/settings?google=missing");

  const state = randomToken();
  const jar = await cookies();
  jar.set(
    GOOGLE_OAUTH_COOKIE,
    JSON.stringify({ state, techId: c.tech.id }),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 10 * 60,
      path: "/",
    },
  );

  redirect(googleAuthUrl({
    state,
    redirectUri: googleRedirectUri(APP_URL),
  }));
}
