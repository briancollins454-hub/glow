/**
 * Weekly owner digest email (Phase 4) — Monday snapshot.
 */

import { sendEmail } from "@/lib/email";
import { getOwnerOverview } from "@/lib/owner/overview";
import { listOpenAlerts } from "@/lib/owner/alerts";
import { supabaseService } from "@/lib/supabase/service";
import { gbpFromPennies } from "@/lib/owner/mrr";
import { recordCronRun } from "@/lib/owner/ops";

const OWNER_DIGEST_TO = process.env.OWNER_DIGEST_EMAIL || "brian@thesupportsdesk.com";

export async function buildOwnerDigestBody(): Promise<{ subject: string; text: string }> {
  const o = await getOwnerOverview();
  const alerts = await listOpenAlerts(20);
  const sb = supabaseService();
  const since7 = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();
  const { count: signups7 } = await sb
    .from("techs")
    .select("id", { count: "exact", head: true })
    .gte("createdAt", since7)
    .eq("isInternal", false);
  const { count: atRisk } = await sb
    .from("techs")
    .select("id", { count: "exact", head: true })
    .or("atRiskManual.eq.true,healthBand.eq.at_risk")
    .eq("isInternal", false);

  const deliv = o.health.outboundFailures24h;
  const text = [
    "Glow weekly owner digest",
    "",
    `MRR: ${gbpFromPennies(o.mrr.mrrPennies)} (${o.mrr.payingCount} paying)`,
    `ARR: ${gbpFromPennies(o.mrr.arrPennies)}`,
    `Accounts: ${o.accountsTotal} total · ${o.paying} paying · ${o.trialing} trialing · ${o.pastDue} past due`,
    `Signups (7d): ${signups7 ?? o.signups.week}`,
    `At-risk accounts: ${atRisk ?? "—"}`,
    `Outbound failures (24h): ${deliv.ok ? deliv.value : "unavailable"}`,
    `Open alerts: ${alerts.length}`,
    ...alerts.slice(0, 8).map((a) => `  - [${a.severity}] ${a.title}`),
    "",
    "Open the console: /dashboard/admin",
  ].join("\n");

  return {
    subject: `Glow digest — MRR ${gbpFromPennies(o.mrr.mrrPennies)} · ${alerts.length} open alerts`,
    text,
  };
}

export async function sendOwnerWeeklyDigest(trigger: "cron" | "manual" = "cron") {
  const startedAt = new Date().toISOString();
  const t0 = Date.now();
  try {
    const { subject, text } = await buildOwnerDigestBody();
    const ok = await sendEmail({
      to: OWNER_DIGEST_TO,
      subject,
      text,
      html: `<pre style="font-family:sans-serif;white-space:pre-wrap">${text.replace(/</g, "&lt;")}</pre>`,
      kind: "ops_account_email",
    });
    const finishedAt = new Date().toISOString();
    await recordCronRun({
      job: "owner_weekly_digest",
      trigger,
      ok,
      result: { to: OWNER_DIGEST_TO },
      error: ok ? null : "send failed",
      startedAt,
      finishedAt,
      durationMs: Date.now() - t0,
    });
    return { ok, to: OWNER_DIGEST_TO };
  } catch (e) {
    const finishedAt = new Date().toISOString();
    await recordCronRun({
      job: "owner_weekly_digest",
      trigger,
      ok: false,
      error: (e as Error).message,
      startedAt,
      finishedAt,
      durationMs: Date.now() - t0,
    });
    return { ok: false as const, error: (e as Error).message };
  }
}
