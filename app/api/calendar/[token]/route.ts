import { notFound } from "next/navigation";
import { supabaseService } from "@/lib/supabase/service";
import { getTechByCalendarToken, listBookings, listClients, listServices } from "@/lib/db/queries";

function esc(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
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
  const tech = await getTechByCalendarToken(sb, token);
  if (!tech) notFound();

  const [bookings, clients, services] = await Promise.all([
    listBookings(sb, tech.id),
    listClients(sb, tech.id),
    listServices(sb, tech.id),
  ]);
  const clientById = new Map(clients.map((c) => [c.id, c]));
  const serviceById = new Map(services.map((s) => [s.id, s]));
  const now = stamp(new Date().toISOString());

  const events = bookings
    .filter((b) => b.status !== "cancelled" && b.status !== "no_show")
    .map((b) => {
      const client = clientById.get(b.clientId);
      const service = serviceById.get(b.serviceId);
      const summary = `${client?.name ?? "Client"} - ${service?.name ?? "Appointment"}`;
      const status = b.status === "completed" ? "CONFIRMED" : b.status === "pending" ? "TENTATIVE" : "CONFIRMED";
      return [
        "BEGIN:VEVENT",
        `UID:${esc(b.id)}@glow-uk.com`,
        `DTSTAMP:${now}`,
        `DTSTART:${stamp(b.startIso)}`,
        `DTEND:${stamp(b.endIso)}`,
        `SUMMARY:${esc(summary)}`,
        `DESCRIPTION:${esc(`Booked through Glow for ${tech.businessName}.`)}`,
        `STATUS:${status}`,
        "END:VEVENT",
      ].join("\r\n");
    });

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Glow//Bookings//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${esc(`${tech.businessName} bookings`)}`,
    "X-WR-TIMEZONE:Europe/London",
    ...events,
    "END:VCALENDAR",
    "",
  ].join("\r\n");

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": "private, max-age=300",
    },
  });
}
