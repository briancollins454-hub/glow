import { redirect } from "next/navigation";
import { Download, PoundSterling, CheckCircle2, XCircle, ShieldX } from "lucide-react";
import { formatInTimeZone } from "date-fns-tz";
import { getCurrentTech } from "@/lib/auth/session";
import {
  getBooking,
  getService,
  listBookings,
  listPayments,
} from "@/lib/db/repo";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { gbp, TZ } from "@/lib/format";

export default async function ReportsPage() {
  const tech = await getCurrentTech();
  if (!tech) redirect("/login");

  const payments = listPayments(tech.id).filter((p) => p.status === "succeeded");
  const bookings = listBookings(tech.id);

  const signed = (kind: string, amt: number) => (kind === "refund" ? -amt : amt);

  const totalIncome = payments.reduce((s, p) => s + signed(p.kind, p.amountPennies), 0);
  const depositsTotal = payments
    .filter((p) => p.kind === "deposit")
    .reduce((s, p) => s + p.amountPennies, 0);
  const balancesTotal = payments
    .filter((p) => p.kind === "balance")
    .reduce((s, p) => s + p.amountPennies, 0);

  const completed = bookings.filter((b) => b.status === "completed").length;
  const noShows = bookings.filter((b) => b.status === "no_show").length;
  const forfeited = bookings
    .filter((b) => b.depositStatus === "forfeited")
    .reduce((s, b) => s + b.depositPennies, 0);

  // Monthly breakdown
  const byMonth = new Map<string, number>();
  for (const p of payments) {
    const key = formatInTimeZone(new Date(p.createdAt), TZ, "yyyy-MM");
    byMonth.set(key, (byMonth.get(key) ?? 0) + signed(p.kind, p.amountPennies));
  }
  const months = [...byMonth.entries()].sort((a, b) => b[0].localeCompare(a[0]));

  // Per-service revenue
  const byService = new Map<string, number>();
  for (const p of payments) {
    const b = getBooking(p.bookingId);
    if (!b) continue;
    const name = getService(b.serviceId)?.name ?? "Other";
    byService.set(name, (byService.get(name) ?? 0) + signed(p.kind, p.amountPennies));
  }
  const services = [...byService.entries()].sort((a, b) => b[1] - a[1]);
  const maxService = Math.max(1, ...services.map(([, v]) => v));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Tax &amp; income</h1>
          <p className="text-sm text-ink-soft">
            A simple view for your Self Assessment. Export the raw records as CSV.
          </p>
        </div>
        <ButtonLink href="/api/reports/export" variant="outline">
          <Download className="h-4 w-4" /> Export CSV
        </ButtonLink>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={PoundSterling} tone="green" label="Total income" value={gbp(totalIncome)} />
        <Stat icon={CheckCircle2} tone="blue" label="Completed" value={String(completed)} />
        <Stat icon={XCircle} tone="amber" label="No-shows" value={String(noShows)} />
        <Stat icon={ShieldX} tone="red" label="Forfeited deposits" value={gbp(forfeited)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Income by month</CardTitle>
            <CardDescription>Deposits {gbp(depositsTotal)} · balances {gbp(balancesTotal)}</CardDescription>
          </CardHeader>
          <CardContent>
            {months.length === 0 ? (
              <p className="text-sm text-ink-faint">No income recorded yet.</p>
            ) : (
              <table className="w-full text-sm">
                <tbody>
                  {months.map(([m, total]) => (
                    <tr key={m} className="border-b border-black/5 last:border-0">
                      <td className="py-2.5 text-ink-soft">
                        {formatInTimeZone(new Date(`${m}-01T12:00:00Z`), TZ, "MMMM yyyy")}
                      </td>
                      <td className="py-2.5 text-right font-medium">{gbp(total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Revenue by service</CardTitle>
            <CardDescription>Where your income comes from.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {services.length === 0 ? (
              <p className="text-sm text-ink-faint">No revenue yet.</p>
            ) : (
              services.map(([name, total]) => (
                <div key={name}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-ink-soft">{name}</span>
                    <span className="font-medium">{gbp(total)}</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-black/[0.06]">
                    <div
                      className="h-full rounded-full bg-brand-500"
                      style={{ width: `${Math.round((total / maxService) * 100)}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-ink-faint">
        Note: figures reflect payments recorded in Glow and are a guide only, not
        formal accounting or tax advice.
      </p>
    </div>
  );
}

function Stat({
  icon: Icon,
  tone,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  tone: "green" | "blue" | "amber" | "red";
  label: string;
  value: string;
}) {
  const tones = {
    green: "bg-emerald-100 text-emerald-700",
    blue: "bg-sky-100 text-sky-700",
    amber: "bg-amber-100 text-amber-700",
    red: "bg-red-100 text-red-700",
  };
  return (
    <Card className="p-5">
      <span className={`grid h-10 w-10 place-items-center rounded-xl ${tones[tone]}`}>
        <Icon className="h-5 w-5" />
      </span>
      <p className="mt-3 text-2xl font-semibold">{value}</p>
      <p className="text-sm font-medium">{label}</p>
    </Card>
  );
}
