/**
 * Cohorts, retention grid, MRR movement, forecast (Phase 2.4).
 * Built from account_snapshots — history accrues from the daily job go-live.
 */

import { supabaseService } from "@/lib/supabase/service";
import { filterOutInternal, shouldIncludeInternal } from "@/lib/owner/internal-accounts";
import { computeMrrFromTechs, LIST_MONTHLY_PENNIES } from "@/lib/owner/mrr";
import type { Tech } from "@/lib/db/types";

export type SnapshotRow = {
  techId: string;
  snapshotDate: string;
  subscriptionStatus: string | null;
  mrrPennies: number;
  healthScore: number | null;
};

export type RetentionCell = {
  accounts: number;
  mrrPennies: number;
};

/** Retention grid: signupMonth (YYYY-MM) → monthsSince → cell */
export type RetentionGrid = {
  signupMonths: string[];
  maxAge: number;
  cells: Record<string, Record<number, RetentionCell>>;
  firstSnapshotDate: string | null;
  note: string;
};

export type MrrMovement = {
  month: string;
  newPennies: number;
  expansionPennies: number;
  contractionPennies: number;
  churnedPennies: number;
  netPennies: number;
};

export type RevenueForecast = {
  currentMrrPennies: number;
  expectedFromTrialsPennies: number;
  atRiskMrrPennies: number;
  observedTrialConversionRate: number;
  ltvPennies: number | null;
  avgLifetimeMonths: number | null;
  ltvNote: string;
};

function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

function monthsBetween(a: string, b: string): number {
  const [ay, am] = a.split("-").map(Number);
  const [by, bm] = b.split("-").map(Number);
  return (by! - ay!) * 12 + (bm! - am!);
}

/**
 * Pure retention builder. For each signup cohort month, at each age in months,
 * count accounts still paying (mrr > 0 or status active) on the latest snapshot
 * in that age month.
 */
export function buildRetentionGrid(
  techs: { id: string; createdAt: string }[],
  snapshots: SnapshotRow[],
  opts?: { asOfMonth?: string },
): RetentionGrid {
  const asOf = opts?.asOfMonth ?? monthKey(new Date().toISOString());
  const byTech = new Map<string, SnapshotRow[]>();
  for (const s of snapshots) {
    const list = byTech.get(s.techId) ?? [];
    list.push(s);
    byTech.set(s.techId, list);
  }
  for (const list of byTech.values()) {
    list.sort((a, b) => a.snapshotDate.localeCompare(b.snapshotDate));
  }

  const cohortIds = new Map<string, string[]>();
  for (const t of techs) {
    const m = monthKey(t.createdAt);
    cohortIds.set(m, [...(cohortIds.get(m) ?? []), t.id]);
  }
  const signupMonths = [...cohortIds.keys()].sort();
  let maxAge = 0;
  const cells: RetentionGrid["cells"] = {};

  for (const sm of signupMonths) {
    cells[sm] = {};
    const ids = cohortIds.get(sm) ?? [];
    const age = monthsBetween(sm, asOf);
    maxAge = Math.max(maxAge, age);
    for (let a = 0; a <= age; a++) {
      const targetMonth = addMonths(sm, a);
      let accounts = 0;
      let mrrPennies = 0;
      for (const id of ids) {
        const snaps = byTech.get(id) ?? [];
        // Latest snapshot in that calendar month
        const inMonth = snaps.filter((s) => monthKey(s.snapshotDate) === targetMonth);
        const pick = inMonth[inMonth.length - 1];
        if (!pick) continue;
        if (pick.subscriptionStatus === "active" || pick.mrrPennies > 0) {
          accounts++;
          mrrPennies += pick.mrrPennies;
        }
      }
      cells[sm]![a] = { accounts, mrrPennies };
    }
  }

  const firstSnapshotDate =
    snapshots.length === 0
      ? null
      : snapshots.map((s) => s.snapshotDate).sort()[0] ?? null;

  return {
    signupMonths,
    maxAge,
    cells,
    firstSnapshotDate,
    note: firstSnapshotDate
      ? `Retention history accrues from ${firstSnapshotDate}. Cells use account_snapshots.`
      : "No account_snapshots yet — run the daily owner job. Retention grid will fill from today.",
  };
}

export function addMonths(yyyyMm: string, add: number): string {
  const [y, m] = yyyyMm.split("-").map(Number);
  const d = new Date(Date.UTC(y!, m! - 1 + add, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** MRR movement between consecutive month-end snapshots. */
export function computeMrrMovement(snapshots: SnapshotRow[]): MrrMovement[] {
  const byMonthTech = new Map<string, Map<string, number>>();
  for (const s of snapshots) {
    const m = monthKey(s.snapshotDate);
    if (!byMonthTech.has(m)) byMonthTech.set(m, new Map());
    byMonthTech.get(m)!.set(s.techId, s.mrrPennies);
  }
  const months = [...byMonthTech.keys()].sort();
  const out: MrrMovement[] = [];
  for (let i = 1; i < months.length; i++) {
    const prev = byMonthTech.get(months[i - 1]!)!;
    const cur = byMonthTech.get(months[i]!)!;
    let newPennies = 0;
    let expansionPennies = 0;
    let contractionPennies = 0;
    let churnedPennies = 0;
    for (const [techId, mrr] of cur) {
      const before = prev.get(techId) ?? 0;
      if (before === 0 && mrr > 0) newPennies += mrr;
      else if (mrr > before) expansionPennies += mrr - before;
      else if (mrr < before) contractionPennies += before - mrr;
    }
    for (const [techId, mrr] of prev) {
      if (mrr > 0 && (cur.get(techId) ?? 0) === 0) churnedPennies += mrr;
    }
    out.push({
      month: months[i]!,
      newPennies,
      expansionPennies,
      contractionPennies,
      churnedPennies,
      netPennies: newPennies + expansionPennies - contractionPennies - churnedPennies,
    });
  }
  return out;
}

export async function getCohortRevenueExtras(): Promise<{
  retention: RetentionGrid;
  movement: MrrMovement[];
  forecast: RevenueForecast;
}> {
  const sb = supabaseService();
  const includeInternal = await shouldIncludeInternal(sb);
  const { data: techsRaw } = await sb
    .from("techs")
    .select(
      "id, createdAt, subscriptionStatus, plan, signupOffer, trialEndsAt, healthBand, atRiskManual, currentPeriodEnd, isInternal",
    )
    .limit(5000);
  const techs = filterOutInternal((techsRaw ?? []) as Tech[], includeInternal);

  const { data: snaps } = await sb
    .from("account_snapshots")
    .select("techId, snapshotDate, subscriptionStatus, mrrPennies, healthScore")
    .order("snapshotDate", { ascending: true })
    .limit(100_000);

  const snapshots = (snaps ?? []) as SnapshotRow[];
  // Exclude internal tech snapshots
  const internalIds = new Set(
    ((techsRaw ?? []) as Tech[]).filter((t) => t.isInternal).map((t) => t.id),
  );
  const filteredSnaps = includeInternal
    ? snapshots
    : snapshots.filter((s) => !internalIds.has(s.techId));

  const retention = buildRetentionGrid(
    techs.map((t) => ({ id: t.id, createdAt: t.createdAt })),
    filteredSnaps,
  );
  const movement = computeMrrMovement(filteredSnaps);

  const mrr = computeMrrFromTechs(techs);
  const trials = techs.filter((t) => t.subscriptionStatus === "trialing");
  const finished = techs.filter(
    (t) =>
      t.signupOffer === "trial" &&
      t.trialEndsAt &&
      new Date(t.trialEndsAt).getTime() < Date.now(),
  );
  const converted = finished.filter((t) => t.subscriptionStatus === "active").length;
  const rate = finished.length > 0 ? converted / finished.length : 0;
  const expectedFromTrialsPennies = Math.round(trials.length * rate * LIST_MONTHLY_PENNIES);

  const atRisk = techs.filter(
    (t) =>
      t.subscriptionStatus === "past_due" ||
      t.healthBand === "at_risk" ||
      !!t.atRiskManual,
  );
  const atRiskMrrPennies = atRisk
    .filter((t) => t.subscriptionStatus === "active" || t.subscriptionStatus === "past_due")
    .reduce((sum, t) => sum + (t.subscriptionStatus === "active" ? LIST_MONTHLY_PENNIES : LIST_MONTHLY_PENNIES), 0);

  // LTV not yet computable without enough churn lifetime data
  const churned = techs.filter((t) => t.subscriptionStatus === "canceled");
  let ltvPennies: number | null = null;
  let avgLifetimeMonths: number | null = null;
  let ltvNote = "LTV not yet computable — need more cancelled-account lifetime data and snapshot history.";
  if (churned.length >= 10 && retention.firstSnapshotDate) {
    // Rough: MRR * avg months from createdAt to now for canceled
    const months = churned.map((t) => {
      const start = new Date(t.createdAt).getTime();
      const end = t.currentPeriodEnd ? new Date(t.currentPeriodEnd).getTime() : Date.now();
      return Math.max(1, (end - start) / (30 * DAY_MS));
    });
    avgLifetimeMonths = Math.round((months.reduce((a, b) => a + b, 0) / months.length) * 10) / 10;
    ltvPennies = Math.round(LIST_MONTHLY_PENNIES * avgLifetimeMonths);
    ltvNote = `Rough LTV from ${churned.length} cancelled accounts × list monthly price.`;
  }

  return {
    retention,
    movement,
    forecast: {
      currentMrrPennies: mrr.mrrPennies,
      expectedFromTrialsPennies,
      atRiskMrrPennies,
      observedTrialConversionRate: Math.round(rate * 1000) / 10,
      ltvPennies,
      avgLifetimeMonths,
      ltvNote,
    },
  };
}

const DAY_MS = 24 * 3600_000;
