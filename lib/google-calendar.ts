import type { SupabaseClient } from "@supabase/supabase-js";
import { formatInTimeZone } from "date-fns-tz";
import { getClient, getService, listBookings, updateBooking } from "@/lib/db/queries";
import type { Booking, Tech } from "@/lib/db/types";
import { TZ } from "@/lib/format";

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
  htmlLink?: string;
  summary?: string;
  start?: { dateTime?: string; timeZone?: string };
};

export type GoogleSyncResult =
  | { ok: true; eventId?: string; htmlLink?: string; summary?: string; skipped?: boolean }
  | { ok: false; reason: string; skipped?: boolean };

export type GoogleSyncedEvent = {
  bookingId: string;
  summary: string;
  htmlLink: string | null;
  startLocal: string;
};

export type GoogleBulkSyncResult = {
  synced: number;
  failed: number;
  skipped: number;
  upcoming: number;
  errors: string[];
  googleEmail: string | null;
  calendarName: string | null;
  calendarId: string | null;
  events: GoogleSyncedEvent[];
};

/** Google Calendar expects local wall-clock with timeZone, not a UTC `Z` timestamp. */
function googleDateTime(iso: string): string {
  return formatInTimeZone(new Date(iso), TZ, "yyyy-MM-dd'T'HH:mm:ss");
}

export function googleCalendarConfigured(): boolean {
  return !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;
}

export function googleConnected(tech: Pick<Tech, "googleRefreshToken" | "googleCalendarId">): boolean {
  return !!(tech.googleRefreshToken && tech.googleCalendarId);
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
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Google token refresh failed: ${res.status}${detail ? ` — ${detail.slice(0, 120)}` : ""}`);
  }
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

async function googleCalendarMeta(
  accessToken: string,
  calendarId: string,
): Promise<{ id: string; summary: string } | null> {
  const res = await fetch(`${GOOGLE_CALENDAR_URL}/${encodeURIComponent(calendarId)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { id?: string; summary?: string };
  if (!json.id) return null;
  return { id: json.id, summary: json.summary ?? json.id };
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
    start: { dateTime: googleDateTime(booking.startIso), timeZone: TZ },
    end: { dateTime: googleDateTime(booking.endIso), timeZone: TZ },
    extendedProperties: { private: { glowBookingId: booking.id } },
  };
}

async function upsertGoogleEvent({
  accessToken,
  calendarId,
  booking,
  body,
  eventId,
}: {
  accessToken: string;
  calendarId: string;
  booking: Booking;
  body: ReturnType<typeof googleEventBody>;
  eventId: string | null;
}): Promise<GoogleEventResponse> {
  const encodedCalendar = encodeURIComponent(calendarId);
  const tryRequest = async (method: "POST" | "PATCH", id: string | null) => {
    const url =
      method === "POST"
        ? `${GOOGLE_CALENDAR_URL}/${encodedCalendar}/events`
        : `${GOOGLE_CALENDAR_URL}/${encodedCalendar}/events/${encodeURIComponent(id!)}`;
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    return res;
  };

  if (eventId) {
    const res = await tryRequest("PATCH", eventId);
    if (res.ok) return (await res.json()) as GoogleEventResponse;
    if (res.status === 404) {
      // Stale event id — create a fresh one.
      const created = await tryRequest("POST", null);
      if (!created.ok) {
        const detail = await created.text().catch(() => "");
        throw new Error(`Google Calendar create failed: ${created.status}${detail ? ` — ${detail.slice(0, 120)}` : ""}`);
      }
      return (await created.json()) as GoogleEventResponse;
    }
    const detail = await res.text().catch(() => "");
    throw new Error(`Google Calendar update failed: ${res.status}${detail ? ` — ${detail.slice(0, 120)}` : ""}`);
  }

  const res = await tryRequest("POST", null);
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Google Calendar create failed: ${res.status}${detail ? ` — ${detail.slice(0, 120)}` : ""}`);
  }
  return (await res.json()) as GoogleEventResponse;
}

/** Push one booking to Google Calendar (create, update, or delete). */
export async function syncBookingToGoogle(
  sb: SupabaseClient,
  tech: Tech | null,
  booking: Booking | null,
): Promise<GoogleSyncResult> {
  if (!tech || !booking) return { ok: false, reason: "missing_booking", skipped: true };
  if (!googleCalendarConfigured()) return { ok: false, reason: "not_configured", skipped: true };
  if (!googleConnected(tech)) return { ok: false, reason: "not_connected", skipped: true };

  try {
    const accessToken = await accessTokenFromRefresh(tech.googleRefreshToken!);
    const calendarId = tech.googleCalendarId!;

    if (booking.status === "cancelled" || booking.status === "no_show") {
      if (!booking.googleEventId) return { ok: true };
      await fetch(
        `${GOOGLE_CALENDAR_URL}/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(booking.googleEventId)}`,
        { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } },
      );
      await updateBooking(sb, booking.id, { googleEventId: null });
      return { ok: true };
    }

    if (booking.status === "pending" || booking.status === "pending_approval") {
      return { ok: true, skipped: true };
    }

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

    const event = await upsertGoogleEvent({
      accessToken,
      calendarId,
      booking,
      body,
      eventId: booking.googleEventId,
    });

    if (event.id && event.id !== booking.googleEventId) {
      await updateBooking(sb, booking.id, { googleEventId: event.id });
    }
    return {
      ok: true,
      eventId: event.id,
      htmlLink: event.htmlLink,
      summary: event.summary ?? body.summary,
    };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : "sync_failed" };
  }
}

/** Sync all upcoming confirmed appointments to Google (backfill + repair). */
export async function syncUpcomingBookingsToGoogle(
  sb: SupabaseClient,
  tech: Tech,
): Promise<GoogleBulkSyncResult> {
  const bookings = await listBookings(sb, tech.id);
  const now = Date.now() - 15 * 60 * 1000;
  // Confirmed upcoming appointments only — pending / pending_approval wait until confirmed.
  const upcoming = bookings.filter(
    (b) => b.status === "confirmed" && new Date(b.startIso).getTime() > now,
  );

  let synced = 0;
  let failed = 0;
  let skipped = 0;
  const errors: string[] = [];
  const events: GoogleSyncedEvent[] = [];
  let calendarName: string | null = null;
  let calendarId: string | null = tech.googleCalendarId;

  if (googleConnected(tech) && tech.googleRefreshToken) {
    try {
      const accessToken = await accessTokenFromRefresh(tech.googleRefreshToken);
      const meta = await googleCalendarMeta(accessToken, tech.googleCalendarId!);
      if (meta) {
        calendarName = meta.summary;
        calendarId = meta.id;
      }
    } catch {
      // Calendar metadata is best-effort for diagnostics.
    }
  }

  for (const booking of upcoming) {
    const result = await syncBookingToGoogle(sb, tech, booking);
    if (result.ok) {
      if (result.skipped) skipped++;
      else {
        synced++;
        if (events.length < 5) {
          events.push({
            bookingId: booking.id,
            summary: result.summary ?? "Appointment",
            htmlLink: result.htmlLink ?? null,
            startLocal: formatInTimeZone(new Date(booking.startIso), TZ, "EEE d MMM yyyy HH:mm"),
          });
        }
      }
    } else if (result.skipped) {
      skipped++;
      if (errors.length < 3) errors.push(result.reason);
    } else {
      failed++;
      if (errors.length < 3) errors.push(result.reason);
    }
  }

  return {
    synced,
    failed,
    skipped,
    upcoming: upcoming.length,
    errors,
    googleEmail: tech.googleCalendarEmail,
    calendarName,
    calendarId,
    events,
  };
}

export async function deleteGoogleEventForBooking(tech: Tech, booking: Booking): Promise<void> {
  if (!googleCalendarConfigured() || !googleConnected(tech) || !booking.googleEventId) return;
  const accessToken = await accessTokenFromRefresh(tech.googleRefreshToken!);
  await fetch(
    `${GOOGLE_CALENDAR_URL}/${encodeURIComponent(tech.googleCalendarId!)}/events/${encodeURIComponent(booking.googleEventId)}`,
    { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } },
  );
}
