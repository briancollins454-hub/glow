import { redirect } from "next/navigation";
import { getDashboardContext } from "@/lib/auth/session";
import { googleAuthUrl, googleCalendarConfigured, googleRedirectUri } from "@/lib/google-calendar";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function GET() {
  const c = await getDashboardContext();
  if (!c) redirect("/login");
  if (!googleCalendarConfigured()) redirect("/dashboard/settings?google=missing");

  redirect(googleAuthUrl({
    state: c.tech.id,
    redirectUri: googleRedirectUri(APP_URL),
  }));
}
