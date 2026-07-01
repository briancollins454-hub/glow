import { formatInTimeZone } from "date-fns-tz";
import { getDashboardContext } from "@/lib/auth/session";
import { listBookings, listClients, listPayments, listServices } from "@/lib/db/queries";
import { TZ } from "@/lib/format";

function csvCell(value: string | number): string {
  const s = String(value ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET() {
  const c = await getDashboardContext();
  if (!c) return new Response("Unauthorized", { status: 401 });
  const { sb, tech } = c;

  const [payments, bookings, clients, services] = await Promise.all([
    listPayments(sb, tech.id),
    listBookings(sb, tech.id),
    listClients(sb, tech.id),
    listServices(sb, tech.id),
  ]);
  const bookingById = new Map(bookings.map((b) => [b.id, b]));
  const clientById = new Map(clients.map((c) => [c.id, c.name]));
  const serviceById = new Map(services.map((s) => [s.id, s.name]));

  const header = ["Date", "Type", "Amount (GBP)", "Status", "Client", "Service", "Appointment"];
  const rows = payments.map((p) => {
    const booking = bookingById.get(p.bookingId);
    return [
      formatInTimeZone(new Date(p.createdAt), TZ, "yyyy-MM-dd HH:mm"),
      p.kind,
      (p.amountPennies / 100).toFixed(2),
      p.status,
      booking ? clientById.get(booking.clientId) ?? "" : "",
      booking ? serviceById.get(booking.serviceId) ?? "" : "",
      booking ? formatInTimeZone(new Date(booking.startIso), TZ, "yyyy-MM-dd HH:mm") : "",
    ];
  });

  const csv = [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\n");
  const filename = `glow-income-${formatInTimeZone(new Date(), TZ, "yyyy-MM-dd")}.csv`;
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
