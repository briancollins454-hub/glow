"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  CalendarDays,
  PoundSterling,
  Clock3,
  AlertTriangle,
  ArrowRight,
  Lightbulb,
  TrendingUp,
  CheckCircle2,
} from "lucide-react";
import { AsyncDashboardPage } from "@/components/dashboard/async-dashboard-page";
import { RunningLatePanel } from "@/components/dashboard/running-late-panel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { gbp, fmtDate, fmtTime, fmtRelativeDays } from "@/lib/format";
import { statusBadge } from "@/components/dashboard/status";
import { isLive, isPaymentsReady } from "@/lib/subscriptions";
import { OnboardingChecklist, type SetupStep } from "@/components/dashboard/onboarding-checklist";
import type { BusinessInsight } from "@/lib/insights";
import type { Booking, Client, Service, Tech } from "@/lib/db/types";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://glow-uk.com";

type HomeData = {
  tech: Tech;
  upcoming: Booking[];
  services: Service[];
  monthIncome: number;
  outstanding: number;
  todayCount: number;
  upcomingCount: number;
  blacklisted: number;
  noShows: number;
  insights: BusinessInsight[];
  clientById: Record<string, Client>;
  serviceById: Record<string, Service>;
  lateCascadeCount: number;
};

export default function DashboardOverview() {
  return (
    <AsyncDashboardPage<HomeData> pageKey="home">
      {(data) => <HomeView {...data} />}
    </AsyncDashboardPage>
  );
}

function HomeView({
  tech,
  upcoming,
  services,
  monthIncome,
  outstanding,
  todayCount,
  upcomingCount,
  blacklisted,
  noShows,
  insights,
  clientById,
  serviceById,
  lateCascadeCount,
}: HomeData) {
  const searchParams = useSearchParams();
  const lateDone = searchParams.get("late");
  const notified = searchParams.get("notified");
  const minutes = searchParams.get("minutes");
  const live = isLive(tech);
  const isTester = tech.signupOffer === "tester";
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
      title: isTester ? "Go live - your first month is just £1" : "Go live - 50% off your first month",
      detail: isTester
        ? "Tester offer: £1 for month one, then £19/mo, cancel anytime."
        : "Switches on online bookings. £19/mo, cancel anytime.",
      href: "/dashboard/billing",
      done: live,
      cta: isTester ? "Go live for £1" : "Go live",
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
      {isTester && !live && (
        <Link
          href="/dashboard/billing"
          className="block rounded-2xl border-2 border-brand-400 bg-gradient-to-r from-brand-600 to-brand-700 p-5 text-white shadow-glow transition hover:from-brand-500 hover:to-brand-600"
        >
          <p className="font-display text-lg font-semibold">Congrats - you&apos;re an invited tester!</p>
          <p className="mt-0.5 text-2xl font-bold">Your first month is just £1</p>
          <p className="mt-1 text-sm text-white/85">Then £19/mo, cancel anytime. Tap here to go live for £1 →</p>
        </Link>
      )}

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
        <StatCard icon={Clock3} label="Upcoming" value={String(upcomingCount)} hint="booked ahead" tone="blue" href="/dashboard/bookings" />
        <StatCard icon={PoundSterling} label="Income this month" value={gbp(monthIncome)} hint="deposits + balances" tone="green" href="/dashboard/reports" />
        <StatCard icon={TrendingUp} label="Outstanding" value={gbp(outstanding)} hint="balances due" tone="amber" href="/dashboard/bookings" />
      </div>

      {lateDone && (
        <div className="flex items-start gap-2 rounded-xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Notified {notified ?? "0"} client{(notified === "1" ? "" : "s")} you&apos;re ~{minutes ?? "?"} min late.
          </span>
        </div>
      )}

      {lateCascadeCount > 0 && (
        <RunningLatePanel targetCount={lateCascadeCount} compact returnTo="/dashboard" />
      )}

      {insights.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-brand-400" /> Smart admin prompts
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            {insights.map((insight) => (
              <InsightCard key={insight.title} insight={insight} />
            ))}
          </CardContent>
        </Card>
      )}

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
                    <p className="truncate font-medium">{clientById[b.clientId]?.name}</p>
                    <span className="hidden sm:inline-flex">{statusBadge(b.status)}</span>
                  </div>
                  <p className="truncate text-xs text-ink-faint">{serviceById[b.serviceId]?.name}</p>
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

function InsightCard({ insight }: { insight: BusinessInsight }) {
  const tones = {
    brand: "border-brand-500/30 bg-brand-500/10 text-brand-300",
    amber: "border-amber-500/30 bg-amber-500/10 text-amber-300",
    green: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    red: "border-red-500/30 bg-red-500/10 text-red-300",
  };
  return (
    <Link href={insight.href} className={`rounded-xl border p-4 transition hover:shadow-card ${tones[insight.tone]}`}>
      <p className="font-semibold">{insight.title}</p>
      <p className="mt-1 text-sm text-ink-soft">{insight.body}</p>
      <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium">
        Open <ArrowRight className="h-4 w-4" />
      </span>
    </Link>
  );
}
