import { supabaseService } from "@/lib/supabase/service";
import { stripe, stripeConfigured } from "@/lib/stripe";
import { getRevenueSnapshot, type RevenueSnapshot } from "@/lib/owner/revenue";
import { filterOutInternal, shouldIncludeInternal } from "@/lib/owner/internal-accounts";
import type { Tech } from "@/lib/db/types";

export type ConnectMoneyRow = {
  tech: Pick<Tech, "id" | "businessName" | "handle" | "email" | "stripeConnectAccountId" | "connectChargesEnabled" | "connectPayoutsEnabled" | "createdAt" | "isInternal">;
  paymentsGmvPennies: number;
  paymentsCount: number;
  stripeChargesPennies: number | null;
  deltaPennies: number | null;
  mismatch: string | null;
  payoutsEnabled: boolean;
  accountAgeDays: number;
  /** Available Connect balance (pennies), when reconciled. */
  balanceAvailablePennies: number | null;
  balancePendingPennies: number | null;
  /** Sum of in-transit payouts (pennies), when reconciled. */
  payoutInTransitPennies: number | null;
  nextPayoutEta: string | null;
};

export type MoneySnapshot = {
  glow: RevenueSnapshot;
  connect: {
    lifetimeGmvPennies: number;
    monthGmvPennies: number;
    rows: ConnectMoneyRow[];
    stripeConfigured: boolean;
    note: string;
  };
  glowLifetimeEstimateNote: string;
};

/**
 * Money reconciliation: Glow subscriptions (via revenue snapshot) + Connect volume.
 */
export async function getMoneySnapshot(opts?: { reconcileStripe?: boolean }): Promise<MoneySnapshot> {
  const includeInternal = await shouldIncludeInternal();
  const glow = await getRevenueSnapshot({ reconcileStripe: opts?.reconcileStripe });
  // Filter glow rows for display when internals excluded
  if (!includeInternal) {
    glow.rows = glow.rows.filter((r) => !(r.tech as { isInternal?: boolean }).isInternal);
    glow.pastDue = glow.pastDue.filter((r) => !(r.tech as { isInternal?: boolean }).isInternal);
  }

  const sb = supabaseService();
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const { data: techs } = await sb
    .from("techs")
    .select(
      "id, businessName, handle, email, stripeConnectAccountId, connectChargesEnabled, connectPayoutsEnabled, createdAt, isInternal",
    )
    .order("createdAt", { ascending: false });
  const list = filterOutInternal((techs ?? []) as Tech[], includeInternal);

  const { data: pays } = await sb
    .from("payments")
    .select("techId, amountPennies, status, createdAt")
    .eq("status", "succeeded")
    .limit(20000);

  const gmvByTech = new Map<string, { total: number; count: number; month: number }>();
  for (const p of pays ?? []) {
    const cur = gmvByTech.get(p.techId) ?? { total: 0, count: 0, month: 0 };
    cur.total += p.amountPennies ?? 0;
    cur.count++;
    if (p.createdAt >= monthStart.toISOString()) cur.month += p.amountPennies ?? 0;
    gmvByTech.set(p.techId, cur);
  }

  let lifetime = 0;
  let month = 0;
  for (const v of gmvByTech.values()) {
    lifetime += v.total;
    month += v.month;
  }

  const rows: ConnectMoneyRow[] = [];
  const canStripe = stripeConfigured() && opts?.reconcileStripe;
  let note =
    "Connect compare uses succeeded payments in Glow. Use Refresh from Stripe to pull Connect charge totals where available.";

  for (const tech of list) {
    const g = gmvByTech.get(tech.id) ?? { total: 0, count: 0, month: 0 };
    let stripeChargesPennies: number | null = null;
    let mismatch: string | null = null;
    let balanceAvailablePennies: number | null = null;
    let balancePendingPennies: number | null = null;
    let payoutInTransitPennies: number | null = null;
    let nextPayoutEta: string | null = null;
    if (canStripe && tech.stripeConnectAccountId) {
      try {
        const s = stripe();
        // Sum recent succeeded charges on the connected account (best-effort sample).
        const charges = await s.charges.list(
          { limit: 100 },
          { stripeAccount: tech.stripeConnectAccountId },
        );
        stripeChargesPennies = charges.data
          .filter((c) => c.status === "succeeded" && !c.refunded)
          .reduce((sum, c) => sum + (c.amount ?? 0), 0);
        // Only flag when both sides have data and diverge by > £1 on the sampled window.
        if (Math.abs((stripeChargesPennies ?? 0) - g.total) > 100 && g.count > 0) {
          mismatch = `Sampled Stripe charges ${stripeChargesPennies}p vs Glow succeeded ${g.total}p (sample may be incomplete)`;
        }
        const bal = await s.balance.retrieve(
          undefined,
          { stripeAccount: tech.stripeConnectAccountId },
        );
        balanceAvailablePennies = (bal.available ?? [])
          .filter((b) => b.currency === "gbp")
          .reduce((sum, b) => sum + (b.amount ?? 0), 0);
        balancePendingPennies = (bal.pending ?? [])
          .filter((b) => b.currency === "gbp")
          .reduce((sum, b) => sum + (b.amount ?? 0), 0);
        const payouts = await s.payouts.list(
          { limit: 5 },
          { stripeAccount: tech.stripeConnectAccountId },
        );
        const inTransit = payouts.data.filter((p) => p.status === "in_transit" || p.status === "pending");
        payoutInTransitPennies = inTransit.reduce((sum, p) => sum + (p.amount ?? 0), 0);
        const next = inTransit.find((p) => p.arrival_date);
        if (next?.arrival_date) {
          nextPayoutEta = new Date(next.arrival_date * 1000).toISOString();
        }
      } catch (e) {
        mismatch = `Stripe Connect fetch failed: ${(e as Error).message}`;
      }
    }
    const ageDays = Math.floor(
      (Date.now() - new Date(tech.createdAt).getTime()) / (24 * 3600_000),
    );
    rows.push({
      tech,
      paymentsGmvPennies: g.total,
      paymentsCount: g.count,
      stripeChargesPennies,
      deltaPennies:
        stripeChargesPennies == null ? null : stripeChargesPennies - g.total,
      mismatch,
      payoutsEnabled: !!tech.connectPayoutsEnabled,
      accountAgeDays: ageDays,
      balanceAvailablePennies,
      balancePendingPennies,
      payoutInTransitPennies,
      nextPayoutEta,
    });
  }

  if (canStripe) note = "Stripe Connect charge sample reconciled for accounts with a Connect id.";

  return {
    glow,
    connect: {
      lifetimeGmvPennies: lifetime,
      monthGmvPennies: month,
      rows: rows.sort((a, b) => b.paymentsGmvPennies - a.paymentsGmvPennies),
      stripeConfigured: stripeConfigured(),
      note,
    },
    glowLifetimeEstimateNote:
      "Glow lifetime subscription cash is not fully stored locally; use Stripe for historical invoices. MRR below is list-price recurring.",
  };
}
