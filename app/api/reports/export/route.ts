import { formatInTimeZone } from "date-fns-tz";
import { getCurrentTech } from "@/lib/auth/session";
import {
  getBooking,
  getClient,
  getService,
  listPayments,
} from "@/lib/db/repo";
import { TZ } from "@/lib/format";

function csvCell(value: string | number): string {
  const s = String(value ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET() {
  const tech = await getCurrentTech();
  if (!tech) {
    return new Response("Unauthorized", { status: 401 });
  }

  const payments = listPayments(tech.id);
  const header = ["Date", "Type", "Amount (GBP)", "Status", "Client", "Service", "Appointment"];
  const rows = payments.map((p) => {
    const booking = getBooking(p.bookingId);
    const client = booking ? getClient(booking.clientId) : undefined;
    const service = booking ? getService(booking.serviceId) : undefined;
    return [
      formatInTimeZone(new Date(p.createdAt), TZ, "yyyy-MM-dd HH:mm"),
      p.kind,
      (p.amountPennies / 100).toFixed(2),
      p.status,
      client?.name ?? "",
      service?.name ?? "",
      booking ? formatInTimeZone(new Date(booking.startIso), TZ, "yyyy-MM-dd HH:mm") : "",
    ];
  });

  const csv = [header, ...rows]
    .map((r) => r.map(csvCell).join(","))
    .join("\n");

  const filename = `glow-income-${formatInTimeZone(new Date(), TZ, "yyyy-MM-dd")}.csv`;
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
