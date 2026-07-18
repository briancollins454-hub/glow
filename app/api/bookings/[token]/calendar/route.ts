import { notFound } from "next/navigation";
import { supabaseService } from "@/lib/supabase/service";
import {
  getBookingByToken,
  getClient,
  getService,
  getTechById,
  listBookingsByGroup,
} from "@/lib/db/queries";

function esc(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

function stamp(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const sb = supabaseService();
  let booking = await getBookingByToken(sb, token);
  if (!booking) notFound();

  // Basket visits: one calendar event covering every treatment back-to-back.
  let names: string[] = [];
  let endIso = booking.endIso;
  if (booking.groupId) {
    const group = await listBookingsByGroup(sb, booking.groupId);
    if (group.length > 1) {
      booking = group[0];
      endIso = group[group.length - 1].endIso;
      names = (
        await Promise.all(group.map((b) => getService(sb, b.serviceId)))
      ).map((s) => s?.name ?? "Treatment");
    }
  }

  const [tech, client, service] = await Promise.all([
    getTechById(sb, booking.techId),
    getClient(sb, booking.clientId),
    getService(sb, booking.serviceId),
  ]);
  if (!tech) notFound();

  const what = names.length > 1 ? names.join(" + ") : service?.name ?? "Appointment";
  const summary = `${what} with ${tech.businessName}`;
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Glow//Booking//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${esc(booking.id)}@glow-uk.com`,
    `DTSTAMP:${stamp(new Date().toISOString())}`,
    `DTSTART:${stamp(booking.startIso)}`,
    `DTEND:${stamp(endIso)}`,
    `SUMMARY:${esc(summary)}`,
    `DESCRIPTION:${esc(`Booking for ${client?.name ?? "client"} through Glow.`)}`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="glow-booking-${booking.id}.ics"`,
    },
  });
}
