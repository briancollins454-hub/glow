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
import { getDashboardContext } from "@/lib/auth/session";
import { listBookings, listClients, listPayments, listServices } from "@/lib/db/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { gbp, fmtDate, fmtTime, fmtRelativeDays } from "@/lib/format";
import { statusBadge } from "@/components/dashboard/status";
import { isLive } from "@/lib/subscriptions";
import { isPaymentsReady } from "@/lib/subscriptions";
import { OnboardingChecklist, type SetupStep } from "@/components/dashboard/onboarding-checklist";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://glow-uk.com";

export default async function DashboardOverview() {
  const c = await getDashboardContext();
  if (!c) redirect("/login");
  const { sb, tech } = c;

  const now = Date.now();
  const [bookings, payments, clients, services] = await Promise.all([
    listBookings(sb, tech.id),
    listPayments(sb, tech.id),
    listClients(sb, tech.id),
    listServices(sb, tech.id),
  ]);
  const clientById = new Map(clients.map((c) => [c.id, c]));
  const serviceById = new Map(services.map((s) => [s.id, s]));

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

  const live = isLive(tech);
  const setupSteps: SetupStep[] = [
    {
      title: "Add your first service",
      detail: "Name, price, how long it takes. Two minutes.",
      href: "/dashboard/services",
      done: services.length > 0,
      cta: "Add service",
    },
    {
      title: "Set your opening hours",
      detail: "We started you on Tue-Sat, 9-5. Tweak to suit.",
      href: "/dashboard/availability",
      done: live,
      cta: "Check hours",
    },
    {
      title: "Go live - 50% off your first month",
      detail: "Switches on online bookings. £19/mo, cancel anytime.",
      href: "/dashboard/billing",
      done: live,
      cta: "Go live",
    },
    {
      title: "Set up card payments (optional)",
      detail: "Let clients pay deposits by card, straight to your bank. Skip if you prefer cash or bank transfer.",
      href: "/dashboard/payments",
      done: isPaymentsReady(tech),
      cta: "Connect",
    },
  ];
  const essentialsDone = services.length > 0 && live;

  return (
    <div className="space-y-6">
      {!(essentialsDone && isPaymentsReady(tech)) && (
        <OnboardingChecklist steps={setupSteps} bookingUrl={`${APP_URL}/${tech.handle}`} />
      )}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">
            Hello, {tech.name?.split(" ")[0] || tech.businessName} 👋
          </h1>
          <p className="text-sm text-ink-soft">Here&apos;s how your studio is doing.</p>
        </div>
        <Link href={`/${tech.handle}`} target="_blank" className="text-sm font-medium text-brand-400 hover:underline">
          glow.app/{tech.handle}
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={CalendarDays} label="Today" value={String(todayCount)} hint="appointments" tone="brand" href="/dashboard/bookings" />
        <StatCard icon={Clock3} label="Upcoming" value={String(upcoming.length)} hint="booked ahead" tone="blue" href="/dashboard/bookings" />
        <StatCard icon={PoundSterling} label="Income this month" value={gbp(monthIncome)} hint="deposits + balances" tone="green" href="/dashboard/reports" />
        <StatCard icon={TrendingUp} label="Outstanding" value={gbp(outstanding)} hint="balances due" tone="amber" href="/dashboard/bookings" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Next appointments</CardTitle>
            <Link href="/dashboard/bookings" className="text-sm font-medium text-brand-400 hover:underline">
              View all
            </Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {upcoming.length === 0 && (
              <p className="py-6 text-center text-sm text-ink-faint">No upcoming appointments yet.</p>
            )}
            {upcoming.slice(0, 6).map((b) => (
              <Link key={b.id} href={`/dashboard/bookings/${b.id}`} className="flex items-center justify-between gap-3 rounded-xl border border-edge bg-cream px-4 py-3 transition hover:shadow-card">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <p className="truncate font-medium">{clientById.get(b.clientId)?.name}</p>
                    <span className="hidden sm:inline-flex">{statusBadge(b.status)}</span>
                  </div>
                  <p className="truncate text-xs text-ink-faint">{serviceById.get(b.serviceId)?.name}</p>
                </div>
                <div className="shrink-0 text-right text-sm">
                  <p className="font-medium">{fmtTime(b.startIso)}</p>
                  <p className="text-xs text-ink-faint">{fmtRelativeDays(b.startIso)}</p>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Needs attention</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <AlertRow icon={<AlertTriangle className="h-4 w-4 text-red-500" />} label="Blocked clients" value={blacklisted} href="/dashboard/clients" />
              <AlertRow icon={<AlertTriangle className="h-4 w-4 text-amber-500" />} label="No-shows recorded" value={noShows} href="/dashboard/bookings" />
              {blacklisted === 0 && noShows === 0 && <p className="text-ink-faint">All clear. Nice work.</p>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Quick links</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <QuickLink href="/dashboard/services" label="Edit services & prices" />
              <QuickLink href="/dashboard/availability" label="Update opening hours" />
              <QuickLink href="/dashboard/reports" label="Tax & income reports" />
              <QuickLink href="/dashboard/settings" label="Branding & policy" />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, hint, tone, href }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; hint: string; tone: "brand" | "blue" | "green" | "amber"; href: string; }) {
  const tones = { brand: "bg-brand-500/15 text-brand-300", blue: "bg-sky-500/15 text-sky-300", green: "bg-emerald-500/15 text-emerald-300", amber: "bg-amber-500/15 text-amber-300" };
  return (
    <Link href={href} className="card block p-5 transition hover:shadow-card hover:ring-1 hover:ring-brand-500/40">
      <span className={`grid h-10 w-10 place-items-center rounded-xl ${tones[tone]}`}><Icon className="h-5 w-5" /></span>
      <p className="mt-3 text-2xl font-semibold">{value}</p>
      <p className="text-sm font-medium">{label}</p>
      <p className="text-xs text-ink-faint">{hint}</p>
    </Link>
  );
}

function AlertRow({ icon, label, value, href }: { icon: React.ReactNode; label: string; value: number; href: string }) {
  return (
    <Link href={href} className="flex items-center justify-between rounded-lg px-1 py-1 hover:bg-white/[0.06]">
      <span className="flex items-center gap-2">{icon} {label}</span>
      <Badge tone={value > 0 ? "red" : "neutral"}>{value}</Badge>
    </Link>
  );
}

function QuickLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="flex items-center justify-between rounded-lg px-1 py-1.5 text-ink-soft hover:bg-white/[0.06] hover:text-ink">
      {label} <ArrowRight className="h-4 w-4" />
    </Link>
  );
}
