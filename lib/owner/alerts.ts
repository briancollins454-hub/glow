/**
 * Anomaly alerts (Phase 3.5) — evaluate rules, write owner_alerts, dismiss.
 */

import { randomId } from "@/lib/ids";
import { supabaseService } from "@/lib/supabase/service";
import { filterOutInternal, shouldIncludeInternal } from "@/lib/owner/internal-accounts";
import type { Tech } from "@/lib/db/types";

export type OwnerAlert = {
  id: string;
  rule: string;
  techId: string | null;
  severity: string;
  title: string;
  body: string;
  dismissedAt: string | null;
  dismissedBy: string | null;
  createdAt: string;
  alertDate: string;
};

const DAY = 24 * 3600_000;

async function upsertAlert(opts: {
  rule: string;
  techId?: string | null;
  severity?: string;
  title: string;
  body: string;
}): Promise<void> {
  const sb = supabaseService();
  const alertDate = new Date().toISOString().slice(0, 10);
  const id = randomId("oalrt");
  // Unique on (rule, techId, alertDate) — ignore duplicates
  const { error } = await sb.from("owner_alerts").insert({
    id,
    rule: opts.rule,
    techId: opts.techId ?? null,
    severity: opts.severity ?? "warn",
    title: opts.title,
    body: opts.body,
    alertDate,
    createdAt: new Date().toISOString(),
  });
  if (error && !/duplicate|unique|23505/i.test(error.message)) {
    console.warn("[owner alerts]", error.message);
  }
}

/** Pure predicates for tests. */
export function bookingsDownOverHalf(current: number, prior: number): boolean {
  return prior > 0 && current / prior < 0.5;
}

export function bounceRateHigh(sent: number, bounced: number): boolean {
  return sent >= 20 && bounced / sent > 0.02;
}

export function cronFailureStreak(oks: boolean[]): boolean {
  let streak = 0;
  for (const ok of oks) {
    if (!ok) streak++;
    else break;
  }
  return streak >= 2;
}

export async function evaluateAnomalyAlerts(): Promise<{ created: number }> {
  const sb = supabaseService();
  const includeInternal = await shouldIncludeInternal(sb);
  const { data } = await sb.from("techs").select("*").limit(2000);
  const techs = filterOutInternal((data ?? []) as Tech[], includeInternal);
  let created = 0;
  const now = Date.now();
  const d7 = new Date(now - 7 * DAY).toISOString();
  const d14 = new Date(now - 14 * DAY).toISOString();
  const d21 = new Date(now - 21 * DAY).toISOString();

  // Platform bounce rate 24h
  const since24 = new Date(now - DAY).toISOString();
  const { count: sent24 } = await sb
    .from("outbound_sends")
    .select("id", { count: "exact", head: true })
    .eq("channel", "email")
    .gte("createdAt", since24);
  const { count: bounced24 } = await sb
    .from("outbound_sends")
    .select("id", { count: "exact", head: true })
    .eq("channel", "email")
    .eq("deliveryStatus", "bounced")
    .gte("createdAt", since24);
  if (bounceRateHigh(sent24 ?? 0, bounced24 ?? 0)) {
    await upsertAlert({
      rule: "platform_bounce_rate",
      title: "Platform bounce rate >2% (24h)",
      body: `${bounced24} bounced of ${sent24} sends`,
      severity: "error",
    });
    created++;
  }

  // Cron failure streak
  const { data: crons } = await sb
    .from("cron_runs")
    .select("ok")
    .eq("job", "reminders")
    .order("startedAt", { ascending: false })
    .limit(5);
  if (cronFailureStreak((crons ?? []).map((c) => !!c.ok))) {
    await upsertAlert({
      rule: "cron_failure_streak",
      title: "Reminders cron failure streak (2+)",
      body: "Check Operations → cron log",
      severity: "error",
    });
    created++;
  }

  for (const tech of techs.slice(0, 300)) {
    const [b7, bPrev] = await Promise.all([
      sb
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("techId", tech.id)
        .gte("createdAt", d7),
      sb
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("techId", tech.id)
        .gte("createdAt", d14)
        .lt("createdAt", d7),
    ]);
    if (bookingsDownOverHalf(b7.count ?? 0, bPrev.count ?? 0)) {
      await upsertAlert({
        rule: "bookings_down_50",
        techId: tech.id,
        title: `Bookings down >50% WoW — /${tech.handle}`,
        body: `${b7.count} vs prior ${bPrev.count}`,
      });
      created++;
    }

    if (
      tech.subscriptionStatus === "active" &&
      (!tech.lastOwnerLoginAt || new Date(tech.lastOwnerLoginAt).getTime() < now - 14 * DAY)
    ) {
      await upsertAlert({
        rule: "no_login_14d",
        techId: tech.id,
        title: `No owner login 14d — /${tech.handle}`,
        body: "Paying account with stale login",
      });
      created++;
    }

    if (tech.emailDeliveryIssue) {
      await upsertAlert({
        rule: "tech_delivery_flag",
        techId: tech.id,
        title: `Delivery issue on account email — /${tech.handle}`,
        body: tech.emailDeliveryIssueReason || "Flagged",
        severity: "error",
      });
      created++;
    }

    if (tech.subscriptionStatus === "past_due") {
      await upsertAlert({
        rule: "past_due",
        techId: tech.id,
        title: `Past due — /${tech.handle}`,
        body: "Subscription payment failed",
        severity: "error",
      });
      created++;
    }

    if (
      tech.subscriptionStatus === "trialing" &&
      tech.trialEndsAt &&
      new Date(tech.trialEndsAt).getTime() - now < 3 * DAY &&
      new Date(tech.trialEndsAt).getTime() > now
    ) {
      const { count: svc } = await sb
        .from("services")
        .select("id", { count: "exact", head: true })
        .eq("techId", tech.id);
      if ((svc ?? 0) === 0) {
        await upsertAlert({
          rule: "trial_ending_unactivated",
          techId: tech.id,
          title: `Trial ending in 3d, no services — /${tech.handle}`,
          body: tech.trialEndsAt,
        });
        created++;
      }
    }
  }

  // Suppression growth spike (24h vs prior day)
  const { count: supp24 } = await sb
    .from("email_suppressions")
    .select("id", { count: "exact", head: true })
    .eq("suppressed", true)
    .gte("updatedAt", since24);
  const { count: suppPrev } = await sb
    .from("email_suppressions")
    .select("id", { count: "exact", head: true })
    .eq("suppressed", true)
    .gte("updatedAt", new Date(now - 2 * DAY).toISOString())
    .lt("updatedAt", since24);
  if ((supp24 ?? 0) >= 5 && (supp24 ?? 0) > (suppPrev ?? 0) * 2) {
    await upsertAlert({
      rule: "suppression_spike",
      title: "Suppression list growth spike",
      body: `${supp24} new/updated in 24h vs ${suppPrev} prior day`,
      severity: "error",
    });
    created++;
  }

  void d21;
  return { created };
}

export async function listOpenAlerts(limit = 50): Promise<OwnerAlert[]> {
  const { data } = await supabaseService()
    .from("owner_alerts")
    .select("*")
    .is("dismissedAt", null)
    .order("createdAt", { ascending: false })
    .limit(limit);
  return (data ?? []) as OwnerAlert[];
}

export async function dismissAlert(id: string, byEmail: string): Promise<void> {
  await supabaseService()
    .from("owner_alerts")
    .update({ dismissedAt: new Date().toISOString(), dismissedBy: byEmail })
    .eq("id", id);
}
