/**
 * Attribution report (Phase 2.6) — which channel actually converts.
 */

import { supabaseService } from "@/lib/supabase/service";
import { filterOutInternal, shouldIncludeInternal } from "@/lib/owner/internal-accounts";
import type { Tech } from "@/lib/db/types";

export type FunnelBucket = {
  key: string;
  dimension: "utm_source" | "utm_medium" | "utm_campaign" | "partner" | "heard_about";
  visits: number;
  signups: number;
  activated: number;
  paying: number;
  signupToActivatedPct: number;
  activatedToPayingPct: number;
  visitToSignupPct: number;
};

export type AttributionReport = {
  bySource: FunnelBucket[];
  byMedium: FunnelBucket[];
  byCampaign: FunnelBucket[];
  byPartner: FunnelBucket[];
  byHeardAbout: FunnelBucket[];
  totals: { signups: number; activated: number; paying: number; visits: number };
  generatedAt: string;
  note: string;
};

function pct(n: number, d: number): number {
  if (d <= 0) return 0;
  return Math.round((n / d) * 1000) / 10;
}

async function activatedSet(techIds: string[]): Promise<Set<string>> {
  const sb = supabaseService();
  const out = new Set<string>();
  // Batch in chunks
  for (let i = 0; i < techIds.length; i += 50) {
    const chunk = techIds.slice(i, i + 50);
    const { data } = await sb.from("services").select("techId").in("techId", chunk).limit(5000);
    for (const row of data ?? []) out.add(row.techId);
  }
  return out;
}

function groupTechs(
  techs: Tech[],
  activated: Set<string>,
  visitsByKey: Map<string, number>,
  dimension: FunnelBucket["dimension"],
  pick: (t: Tech) => string,
): FunnelBucket[] {
  const map = new Map<string, Tech[]>();
  for (const t of techs) {
    const k = pick(t) || "(none)";
    map.set(k, [...(map.get(k) ?? []), t]);
  }
  const rows: FunnelBucket[] = [];
  for (const [key, list] of map) {
    const signups = list.length;
    const act = list.filter((t) => activated.has(t.id)).length;
    const paying = list.filter((t) => t.subscriptionStatus === "active").length;
    const visits = visitsByKey.get(key) ?? 0;
    rows.push({
      key,
      dimension,
      visits,
      signups,
      activated: act,
      paying,
      visitToSignupPct: pct(signups, visits),
      signupToActivatedPct: pct(act, signups),
      activatedToPayingPct: pct(paying, act),
    });
  }
  return rows.sort((a, b) => b.signups - a.signups);
}

export async function getAttributionReport(): Promise<AttributionReport> {
  const sb = supabaseService();
  const includeInternal = await shouldIncludeInternal(sb);
  const { data } = await sb
    .from("techs")
    .select(
      "id, subscriptionStatus, signupUtmSource, signupUtmMedium, signupUtmCampaign, signupPartnerSlug, signupHeardAbout, isInternal, createdAt",
    )
    .limit(5000);
  const techs = filterOutInternal((data ?? []) as Tech[], includeInternal);
  const activated = await activatedSet(techs.map((t) => t.id));

  // Visits by utm source from page_views (best-effort)
  const visitsBySource = new Map<string, number>();
  const visitsByMedium = new Map<string, number>();
  const visitsByCampaign = new Map<string, number>();
  try {
    const { data: views } = await sb
      .from("page_views")
      .select("utmSource, utmMedium, utmCampaign")
      .limit(20000);
    for (const v of views ?? []) {
      const s = (v.utmSource as string) || "(none)";
      const m = (v.utmMedium as string) || "(none)";
      const c = (v.utmCampaign as string) || "(none)";
      visitsBySource.set(s, (visitsBySource.get(s) ?? 0) + 1);
      visitsByMedium.set(m, (visitsByMedium.get(m) ?? 0) + 1);
      visitsByCampaign.set(c, (visitsByCampaign.get(c) ?? 0) + 1);
    }
  } catch {
    // page_views utm columns may be sparse
  }

  const bySource = groupTechs(techs, activated, visitsBySource, "utm_source", (t) => t.signupUtmSource || "");
  const byMedium = groupTechs(techs, activated, visitsByMedium, "utm_medium", (t) => t.signupUtmMedium || "");
  const byCampaign = groupTechs(
    techs,
    activated,
    visitsByCampaign,
    "utm_campaign",
    (t) => t.signupUtmCampaign || "",
  );
  const byPartner = groupTechs(techs, activated, new Map(), "partner", (t) => t.signupPartnerSlug || "");
  const byHeardAbout = groupTechs(
    techs,
    activated,
    new Map(),
    "heard_about",
    (t) => t.signupHeardAbout || "",
  );

  const signups = techs.length;
  const act = techs.filter((t) => activated.has(t.id)).length;
  const paying = techs.filter((t) => t.subscriptionStatus === "active").length;
  const visits = [...visitsBySource.values()].reduce((a, b) => a + b, 0);

  // Reconciliation check: sum of bySource signups === totals
  const sourceSum = bySource.reduce((s, r) => s + r.signups, 0);

  return {
    bySource,
    byMedium,
    byCampaign,
    byPartner,
    byHeardAbout,
    totals: { signups, activated: act, paying, visits },
    generatedAt: new Date().toISOString(),
    note:
      sourceSum === signups
        ? "Attribution totals reconcile with raw signups."
        : `Source buckets sum ${sourceSum} vs ${signups} signups — check null handling.`,
  };
}

/** Pure helper for tests. */
export function reconcileAttributionSignups(
  buckets: { signups: number }[],
  rawSignups: number,
): boolean {
  return buckets.reduce((s, b) => s + b.signups, 0) === rawSignups;
}
