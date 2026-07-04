import type { SupabaseClient } from "@supabase/supabase-js";
import { getClient, getService, updateBooking } from "@/lib/db/queries";
import type { Booking, Tech } from "@/lib/db/types";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";
const GOOGLE_CALENDAR_URL = "https://www.googleapis.com/calendar/v3/calendars";

type TokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  token_type: string;
};

type GoogleEventResponse = {
  id: string;
};

export function googleCalendarConfigured(): boolean {
  return !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;
}

export function googleRedirectUri(appUrl: string): string {
  return `${appUrl.replace(/\/$/, "")}/api/google/calendar/callback`;
}

export function googleAuthUrl({ state, redirectUri }: { state: string; redirectUri: string }): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: redirectUri,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    state,
    scope: [
      "https://www.googleapis.com/auth/calendar.events",
      "https://www.googleapis.com/auth/userinfo.email",
    ].join(" "),
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export async function exchangeGoogleCode({
  code,
  redirectUri,
}: {
  code: string;
  redirectUri: string;
}): Promise<TokenResponse> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`Google token exchange failed: ${res.status}`);
  return (await res.json()) as TokenResponse;
}

async function accessTokenFromRefresh(refreshToken: string): Promise<string> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Google token refresh failed: ${res.status}`);
  const json = (await res.json()) as TokenResponse;
  return json.access_token;
}

export async function googleAccountEmail(accessToken: string): Promise<string> {
  const res = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return "";
  const json = (await res.json()) as { email?: string };
  return json.email ?? "";
}

function googleEventBody({
  tech,
  booking,
  clientName,
  serviceName,
}: {
  tech: Tech;
  booking: Booking;
  clientName: string;
  serviceName: string;
}) {
  return {
    summary: `${clientName} - ${serviceName}`,
    description: `Glow booking for ${tech.businessName}.`,
    start: { dateTime: booking.startIso, timeZone: "Europe/London" },
    end: { dateTime: booking.endIso, timeZone: "Europe/London" },
    extendedProperties: { private: { glowBookingId: booking.id } },
  };
}

export async function syncBookingToGoogle(
  sb: SupabaseClient,
  tech: Tech | null,
  booking: Booking | null,
): Promise<void> {
  if (!tech || !booking || !googleCalendarConfigured()) return;
  if (!tech.googleRefreshToken || !tech.googleCalendarId) return;

  const accessToken = await accessTokenFromRefresh(tech.googleRefreshToken);
  const calendarId = encodeURIComponent(tech.googleCalendarId);

  if (booking.status === "cancelled" || booking.status === "no_show") {
    if (!booking.googleEventId) return;
    await fetch(`${GOOGLE_CALENDAR_URL}/${calendarId}/events/${encodeURIComponent(booking.googleEventId)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    await updateBooking(sb, booking.id, { googleEventId: null });
    return;
  }

  if (booking.status === "pending") return;

  const [client, service] = await Promise.all([
    getClient(sb, booking.clientId),
    getService(sb, booking.serviceId),
  ]);
  const body = googleEventBody({
    tech,
    booking,
    clientName: client?.name ?? "Client",
    serviceName: service?.name ?? "Appointment",
  });

  const eventId = booking.googleEventId;
  const url = eventId
    ? `${GOOGLE_CALENDAR_URL}/${calendarId}/events/${encodeURIComponent(eventId)}`
    : `${GOOGLE_CALENDAR_URL}/${calendarId}/events`;
  const res = await fetch(url, {
    method: eventId ? "PATCH" : "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Google Calendar sync failed: ${res.status}`);
  const event = (await res.json()) as GoogleEventResponse;
  if (!eventId && event.id) await updateBooking(sb, booking.id, { googleEventId: event.id });
}

export async function deleteGoogleEventForBooking(tech: Tech, booking: Booking): Promise<void> {
  if (!googleCalendarConfigured() || !tech.googleRefreshToken || !tech.googleCalendarId || !booking.googleEventId) return;
  const accessToken = await accessTokenFromRefresh(tech.googleRefreshToken);
  await fetch(
    `${GOOGLE_CALENDAR_URL}/${encodeURIComponent(tech.googleCalendarId)}/events/${encodeURIComponent(booking.googleEventId)}`,
    { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } },
  );
}
