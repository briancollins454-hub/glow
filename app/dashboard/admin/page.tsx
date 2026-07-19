"use client";

import { notFound } from "next/navigation";
import Link from "next/link";
import { Crown, PoundSterling, Users, XCircle, ShieldAlert, FlaskConical, Eye, UserCheck, FolderInput } from "lucide-react";
import { AsyncDashboardPage } from "@/components/dashboard/async-dashboard-page";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fmtDate } from "@/lib/format";
import type { AccountClosureRequest, Tech } from "@/lib/db/types";
import type { PlatformTraffic } from "@/lib/traffic-stats";
import { setCompAction, setTesterOfferAction } from "./actions";

const LIVE = ["trialing", "active", "comped"];

type AdminSuccess = { techs: Tech[]; closures: AccountClosureRequest[]; traffic: PlatformTraffic };

type AdminData = { forbidden: true } | AdminSuccess;

export default function AdminPage() {
  return (
    <AsyncDashboardPage<AdminData> pageKey="admin">
      {(data) => <AdminGate data={data} />}
    </AsyncDashboardPage>
  );
}

function AdminGate({ data }: { data: AdminData }) {
  if ("forbidden" in data) notFound();
  return <AdminView techs={data.techs} closures={data.closures} traffic={data.traffic} />;
}

function AdminView({
  techs,
  closures,
  traffic,
}: {
  techs: Tech[];
  closures: AccountClosureRequest[];
  traffic: PlatformTraffic;
}) {
  const techById = Object.fromEntries(techs.map((t) => [t.id, t]));

  const active = techs.filter((t) => LIVE.includes(t.subscriptionStatus));
  const cancelled = techs.filter((t) => t.subscriptionStatus === "canceled");
  const pastDue = techs.filter((t) => t.subscriptionStatus === "past_due");
  const testers = techs.filter((t) => t.signupOffer === "tester");
  const mrr =
    active.filter((t) => t.plan === "monthly" && t.subscriptionStatus !== "comped").length * 19 +
    active.filter((t) => t.plan === "annual" && t.subscriptionStatus !== "comped").length * 15;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 font-display text-2xl font-semibold">
          <Crown className="h-6 w-6 text-brand-400" /> Owner
        </h1>
        <p className="text-sm text-ink-soft">Only you can see this page.</p>
        <Link
          href="/dashboard/admin/support-import"
          className="mt-3 inline-flex items-center gap-2 rounded-xl border border-edge bg-cream px-4 py-2.5 text-sm font-medium text-ink transition hover:border-brand-400/40"
        >
          <FolderInput className="h-4 w-4 text-brand-400" /> Support import
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={Users} tone="brand" label="Accounts" value={String(techs.length)} hint={`${testers.length} tester${testers.length === 1 ? "" : "s"}`} />
        <Stat icon={PoundSterling} tone="green" label="Paying / live" value={String(active.length)} hint={`~£${mrr}/mo`} />
        <Stat icon={XCircle} tone="amber" label="Cancelled" value={String(cancelled.length)} hint={`${pastDue.length} past due`} />
        <Stat icon={ShieldAlert} tone="red" label="Closure requests" value={String(closures.length)} hint="awaiting action" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-brand-400" /> Site traffic
          </CardTitle>
          <CardDescription>
            Real visits to glow-uk.com and public booking pages. Unique visitors are estimated per day (no cookies, no raw IPs stored).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <TrafficStat label="Today" views={traffic.today.views} visitors={traffic.today.visitors} />
            <TrafficStat label="Last 7 days" views={traffic.last7Days.views} visitors={traffic.last7Days.visitors} />
            <TrafficStat label="Last 30 days" views={traffic.last30Days.views} visitors={traffic.last30Days.visitors} />
            <TrafficStat label="All time" views={traffic.allTime.views} visitors={traffic.allTime.visitors} />
          </div>

          {traffic.daily.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-medium">Daily breakdown (last 30 days)</p>
              <div className="overflow-x-auto rounded-xl border border-edge">
                <table className="w-full min-w-[320px] text-left text-sm">
                  <thead className="bg-white/[0.03] text-xs text-ink-faint">
                    <tr>
                      <th className="px-4 py-2 font-medium">Date</th>
                      <th className="px-4 py-2 font-medium">Views</th>
                      <th className="px-4 py-2 font-medium">Visitors</th>
                    </tr>
                  </thead>
                  <tbody>
                    {traffic.daily.map((row) => (
                      <tr key={row.day} className="border-t border-edge">
                        <td className="px-4 py-2">{fmtDate(`${row.day}T12:00:00.000Z`)}</td>
                        <td className="px-4 py-2">{row.views.toLocaleString()}</td>
                        <td className="px-4 py-2">{row.visitors.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <p className="mb-2 text-sm font-medium">Top pages (30 days)</p>
              {traffic.topPaths.length === 0 ? (
                <p className="text-sm text-ink-faint">No visits recorded yet. Traffic will appear here as people browse the site.</p>
              ) : (
                <div className="space-y-2">
                  {traffic.topPaths.map((row) => (
                    <div key={row.path} className="flex items-center justify-between rounded-xl border border-edge bg-cream px-4 py-2.5 text-sm">
                      <span className="font-medium">{row.path}</span>
                      <span className="text-ink-faint">
                        {row.views.toLocaleString()} views · {row.visitors.toLocaleString()} visitors
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <p className="mb-2 text-sm font-medium">Top booking pages (30 days)</p>
              {traffic.topTechs.length === 0 ? (
                <p className="text-sm text-ink-faint">No booking page visits yet.</p>
              ) : (
                <div className="space-y-2">
                  {traffic.topTechs.map((row) => (
                    <div key={row.techId} className="flex items-center justify-between rounded-xl border border-edge bg-cream px-4 py-2.5 text-sm">
                      <div>
                        <p className="font-medium">{row.businessName}</p>
                        <a href={`/${row.handle}`} target="_blank" className="text-xs text-brand-400 hover:underline">/{row.handle}</a>
                      </div>
                      <span className="text-ink-faint">
                        {row.views.toLocaleString()} views · {row.visitors.toLocaleString()} visitors
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {closures.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ShieldAlert className="h-5 w-5 text-red-400" /> Closure requests</CardTitle>
            <CardDescription>These accounts asked to close. Export their data before deleting anything.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {closures.map((r) => {
              const t = techById[r.techId];
              return (
                <div key={r.id} className="rounded-xl border border-edge bg-cream px-4 py-3 text-sm">
                  <p className="font-medium">{t?.businessName ?? r.techId} <span className="text-ink-faint">· {t?.email}</span></p>
                  <p className="mt-0.5 text-xs text-ink-faint">Requested {fmtDate(r.requestedAt)}{r.reason ? ` · "${r.reason}"` : ""}</p>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>All accounts ({techs.length})</CardTitle>
          <CardDescription>Newest first. Mark testers or comp accounts straight from here.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {techs.map((t) => {
            const isLiveTech = LIVE.includes(t.subscriptionStatus);
            return (
              <div key={t.id} className="rounded-xl border border-edge bg-cream px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{t.businessName || t.handle}</p>
                  <a href={`/${t.handle}`} target="_blank" className="text-xs text-brand-400 hover:underline">/{t.handle}</a>
                  {t.subscriptionStatus === "active" && <Badge tone="green">Active</Badge>}
                  {t.subscriptionStatus === "trialing" && <Badge tone="green">Trialing</Badge>}
                  {t.subscriptionStatus === "comped" && <Badge tone="purple">Comped</Badge>}
                  {t.subscriptionStatus === "canceled" && <Badge tone="red">Cancelled</Badge>}
                  {t.subscriptionStatus === "past_due" && <Badge tone="amber">Past due</Badge>}
                  {t.subscriptionStatus === "none" && <Badge tone="neutral">Not live</Badge>}
                  {t.plan && isLiveTech && t.subscriptionStatus !== "comped" && (
                    <Badge tone="neutral">{t.plan}</Badge>
                  )}
                  {t.signupOffer === "tester" && <Badge tone="brand"><FlaskConical className="h-3 w-3" /> Tester</Badge>}
                </div>
                <p className="mt-0.5 text-xs text-ink-faint">
                  {t.email} · joined {fmtDate(t.createdAt)}{t.referredBy ? ` · referred by ${t.referredBy}` : ""}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <form action={setTesterOfferAction}>
                    <input type="hidden" name="id" value={t.id} />
                    <input type="hidden" name="tester" value={t.signupOffer === "tester" ? "0" : "1"} />
                    <button type="submit" className="rounded-lg bg-white/[0.06] px-3 py-1.5 text-xs font-medium text-ink-soft hover:bg-white/[0.1]">
                      {t.signupOffer === "tester" ? "Remove tester offer" : "Mark as tester (£1 month)"}
                    </button>
                  </form>
                  {!isLiveTech || t.subscriptionStatus === "comped" ? (
                    <form action={setCompAction}>
                      <input type="hidden" name="id" value={t.id} />
                      <input type="hidden" name="comp" value={t.subscriptionStatus === "comped" ? "0" : "1"} />
                      <button type="submit" className="rounded-lg bg-white/[0.06] px-3 py-1.5 text-xs font-medium text-ink-soft hover:bg-white/[0.1]">
                        {t.subscriptionStatus === "comped" ? "Remove free access" : "Give free access"}
                      </button>
                    </form>
                  ) : null}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

function TrafficStat({ label, views, visitors }: { label: string; views: number; visitors: number }) {
  return (
    <div className="rounded-xl border border-edge bg-cream p-4">
      <p className="text-xs font-medium text-ink-faint">{label}</p>
      <p className="mt-1 flex items-center gap-1.5 text-2xl font-semibold">
        <Eye className="h-5 w-5 text-brand-400" />
        {views.toLocaleString()}
      </p>
      <p className="mt-0.5 flex items-center gap-1 text-xs text-ink-faint">
        <UserCheck className="h-3.5 w-3.5" />
        {visitors.toLocaleString()} unique visitors
      </p>
    </div>
  );
}

function Stat({ icon: Icon, tone, label, value, hint }: { icon: React.ComponentType<{ className?: string }>; tone: "brand" | "green" | "amber" | "red"; label: string; value: string; hint: string; }) {
  const tones = {
    brand: "bg-brand-500/15 text-brand-300",
    green: "bg-emerald-500/15 text-emerald-300",
    amber: "bg-amber-500/15 text-amber-300",
    red: "bg-red-500/15 text-red-300",
  };
  return (
    <Card className="p-5">
      <span className={`grid h-10 w-10 place-items-center rounded-xl ${tones[tone]}`}><Icon className="h-5 w-5" /></span>
      <p className="mt-3 text-2xl font-semibold">{value}</p>
      <p className="text-sm font-medium">{label}</p>
      <p className="text-xs text-ink-faint">{hint}</p>
    </Card>
  );
}
