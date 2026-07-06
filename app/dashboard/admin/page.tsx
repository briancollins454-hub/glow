"use client";

import { notFound } from "next/navigation";
import { Crown, PoundSterling, Users, XCircle, ShieldAlert, FlaskConical } from "lucide-react";
import { AsyncDashboardPage } from "@/components/dashboard/async-dashboard-page";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fmtDate } from "@/lib/format";
import type { AccountClosureRequest, Tech } from "@/lib/db/types";
import { setCompAction, setTesterOfferAction } from "./actions";

const LIVE = ["trialing", "active", "comped"];

type AdminSuccess = { techs: Tech[]; closures: AccountClosureRequest[] };

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
  return <AdminView techs={data.techs} closures={data.closures} />;
}

function AdminView({ techs, closures }: { techs: Tech[]; closures: AccountClosureRequest[] }) {
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
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={Users} tone="brand" label="Accounts" value={String(techs.length)} hint={`${testers.length} tester${testers.length === 1 ? "" : "s"}`} />
        <Stat icon={PoundSterling} tone="green" label="Paying / live" value={String(active.length)} hint={`~£${mrr}/mo`} />
        <Stat icon={XCircle} tone="amber" label="Cancelled" value={String(cancelled.length)} hint={`${pastDue.length} past due`} />
        <Stat icon={ShieldAlert} tone="red" label="Closure requests" value={String(closures.length)} hint="awaiting action" />
      </div>

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
