import Link from "next/link";
import {
  CalendarDays,
  PoundSterling,
  Clock3,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
} from "lucide-react";
import { redirect } from "next/navigation";
import { getCurrentTech } from "@/lib/auth/session";
import {
  getClient,
  getService,
  listBookings,
  listClients,
  listPayments,
} from "@/lib/db/repo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { gbp, fmtDate, fmtTime, fmtRelativeDays } from "@/lib/format";
import { statusBadge } from "@/components/dashboard/status";

export default async function DashboardOverview() {
  const tech = await getCurrentTech();
  if (!tech) redirect("/login");

  const now = Date.now();
  const bookings = listBookings(tech.id);
  const payments = listPayments(tech.id);
  const clients = listClients(tech.id);

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const monthIncome = payments
    .filter((p) => p.status === "succeeded" && new Date(p.createdAt) >= monthStart)
    .reduce((sum, p) => sum + (p.kind === "refund" ? -p.amountPennies : p.amountPennies), 0);

  const upcoming = bookings.filter(
    (b) => new Date(b.startIso).getTime() >= now && (b.status === "confirmed" || b.status === "pending"),
  );

  const todayStr = fmtDate(new Date().toISOString());
  const todayCount = upcoming.filter((b) => fmtDate(b.startIso) === todayStr).length;

  const outstanding = upcoming
    .filter((b) => b.balanceStatus === "unpaid")
    .reduce((sum, b) => sum + b.balancePennies, 0);

  const blacklisted = clients.filter((c) => c.isBlacklisted).length;
  const noShows = bookings.filter((b) => b.status === "no_show").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">
            Hello, {tech.name?.split(" ")[0] || tech.businessName} 👋
          </h1>
          <p className="text-sm text-ink-soft">Here&apos;s how your studio is doing.</p>
        </div>
        <Link
          href={`/${tech.handle}`}
          target="_blank"
          className="text-sm font-medium text-brand-600 hover:underline"
        >
          glow.app/{tech.handle}
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={CalendarDays} label="Today" value={String(todayCount)} hint="appointments" tone="brand" />
        <StatCard icon={Clock3} label="Upcoming" value={String(upcoming.length)} hint="booked ahead" tone="blue" />
        <StatCard icon={PoundSterling} label="Income this month" value={gbp(monthIncome)} hint="deposits + balances" tone="green" />
        <StatCard icon={TrendingUp} label="Outstanding" value={gbp(outstanding)} hint="balances due" tone="amber" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Next appointments</CardTitle>
            <Link href="/dashboard/bookings" className="text-sm font-medium text-brand-600 hover:underline">
              View all
            </Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {upcoming.length === 0 && (
              <p className="py-6 text-center text-sm text-ink-faint">
                No upcoming appointments yet.
              </p>
            )}
            {upcoming.slice(0, 6).map((b) => {
              const client = getClient(b.clientId);
              const service = getService(b.serviceId);
              return (
                <div
                  key={b.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-black/5 bg-cream px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{client?.name}</p>
                    <p className="truncate text-xs text-ink-faint">{service?.name}</p>
                  </div>
                  <div className="flex items-center gap-3 text-right">
                    <div className="text-sm">
                      <p className="font-medium">{fmtTime(b.startIso)}</p>
                      <p className="text-xs text-ink-faint">{fmtRelativeDays(b.startIso)}</p>
                    </div>
                    {statusBadge(b.status)}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Needs attention</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <AlertRow
                icon={<AlertTriangle className="h-4 w-4 text-red-500" />}
                label="Blacklisted clients"
                value={blacklisted}
                href="/dashboard/clients"
              />
              <AlertRow
                icon={<AlertTriangle className="h-4 w-4 text-amber-500" />}
                label="No-shows recorded"
                value={noShows}
                href="/dashboard/bookings"
              />
              {blacklisted === 0 && noShows === 0 && (
                <p className="text-ink-faint">All clear. Nice work.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quick links</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <QuickLink href="/dashboard/services" label="Edit services & prices" />
              <QuickLink href="/dashboard/availability" label="Update availability" />
              <QuickLink href="/dashboard/reports" label="Tax & income reports" />
              <QuickLink href="/dashboard/settings" label="Branding & policy" />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint: string;
  tone: "brand" | "blue" | "green" | "amber";
}) {
  const tones = {
    brand: "bg-brand-100 text-brand-700",
    blue: "bg-sky-100 text-sky-700",
    green: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-700",
  };
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <span className={`grid h-10 w-10 place-items-center rounded-xl ${tones[tone]}`}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <p className="mt-3 text-2xl font-semibold">{value}</p>
      <p className="text-sm font-medium">{label}</p>
      <p className="text-xs text-ink-faint">{hint}</p>
    </Card>
  );
}

function AlertRow({
  icon,
  label,
  value,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  href: string;
}) {
  return (
    <Link href={href} className="flex items-center justify-between rounded-lg px-1 py-1 hover:bg-black/[0.03]">
      <span className="flex items-center gap-2">
        {icon} {label}
      </span>
      <Badge tone={value > 0 ? "red" : "neutral"}>{value}</Badge>
    </Link>
  );
}

function QuickLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-lg px-1 py-1.5 text-ink-soft hover:bg-black/[0.03] hover:text-ink"
    >
      {label} <ArrowRight className="h-4 w-4" />
    </Link>
  );
}
