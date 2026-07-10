import { NextResponse } from "next/server";
import { getDashboardContext } from "@/lib/auth/session";
import { createAuditEvent, getBooking, getTechById } from "@/lib/db/queries";
import { googleConnected, syncBookingToGoogle } from "@/lib/google-calendar";

export async function POST(request: Request) {
  const c = await getDashboardContext();
  if (!c) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { bookingId?: string };
  const bookingId = body.bookingId;
  if (!bookingId) return NextResponse.json({ error: "missing_booking" }, { status: 400 });

  const booking = await getBooking(c.sb, bookingId);
  if (!booking || booking.techId !== c.tech.id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const tech = (await getTechById(c.sb, c.tech.id)) ?? c.tech;
  if (!googleConnected(tech)) {
    return NextResponse.json({ error: "not_connected" }, { status: 400 });
  }

  const result = await syncBookingToGoogle(c.sb, tech, booking);
  try {
    await createAuditEvent(c.sb, {
      techId: tech.id,
      actor: "tech",
      action: "google_calendar_booking_sync",
      entityType: "booking",
      entityId: bookingId,
      metadata: {
        ok: result.ok,
        reason: "reason" in result ? result.reason : undefined,
        eventId: "eventId" in result ? result.eventId : undefined,
      },
    });
  } catch {
    // Audit must not block sync.
  }

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: "reason" in result ? result.reason : "sync_failed" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    eventId: "eventId" in result ? result.eventId : undefined,
    skipped: "skipped" in result ? result.skipped : false,
  });
}
