/**
 * Referral graph + partner ledger (Phase 2.8).
 */

import { randomId } from "@/lib/ids";
import { supabaseService } from "@/lib/supabase/service";
import { filterOutInternal, shouldIncludeInternal } from "@/lib/owner/internal-accounts";
import { planMrrPennies, LIST_MONTHLY_PENNIES } from "@/lib/owner/mrr";
import { listPartners } from "@/lib/partners";
import type { Tech } from "@/lib/db/types";

export type ReferralEdge = {
  referrerId: string;
  referrerHandle: string;
  referredId: string;
  referredHandle: string;
  referredLabel: string;
  firstPaidAt: string | null;
  creditGrantedAt: string | null;
  fraudFlags: string[];
};

export type FraudFlag = {
  rule: string;
  title: string;
  detail: string;
  techIds: string[];
};

export type PartnerLedgerRow = {
  slug: string;
  name: string;
  signups: number;
  converted: number;
  revenueAttributedPennies: number;
  commissionOwedPennies: number;
  commissionPaidPennies: number;
  outstandingPennies: number;
};

export type ReferralsSnapshot = {
  edges: ReferralEdge[];
  fraud: FraudFlag[];
  partners: PartnerLedgerRow[];
  generatedAt: string;
};

/** Soft fraud rules — flag for review, never auto-block. */
export function detectReferralFraud(techs: Tech[]): FraudFlag[] {
  const byHandle = new Map(techs.map((t) => [t.handle.toLowerCase(), t]));
  const flags: FraudFlag[] = [];

  // Self-referral: referredBy equals own handle
  for (const t of techs) {
    if (t.referredBy && t.referredBy.toLowerCase() === t.handle.toLowerCase()) {
      flags.push({
        rule: "self_referral",
        title: `Self-referral attempt: /${t.handle}`,
        detail: "referredBy matches own handle",
        techIds: [t.id],
      });
    }
  }

  // Same signup IP across referrer and referred
  for (const t of techs) {
    if (!t.referredBy || !t.signupIp) continue;
    const ref = byHandle.get(t.referredBy.toLowerCase());
    if (ref?.signupIp && ref.signupIp === t.signupIp) {
      flags.push({
        rule: "same_signup_ip",
        title: `Same signup IP: /${ref.handle} → /${t.handle}`,
        detail: t.signupIp,
        techIds: [ref.id, t.id],
      });
    }
  }

  // Same user agent + close createdAt (soft collusion)
  for (const t of techs) {
    if (!t.referredBy || !t.signupUserAgent) continue;
    const ref = byHandle.get(t.referredBy.toLowerCase());
    if (
      ref?.signupUserAgent &&
      ref.signupUserAgent === t.signupUserAgent &&
      Math.abs(new Date(ref.createdAt).getTime() - new Date(t.createdAt).getTime()) < 7 * 24 * 3600_000
    ) {
      flags.push({
        rule: "same_device_ua",
        title: `Same user-agent within 7d: /${ref.handle} → /${t.handle}`,
        detail: "Review for device collusion",
        techIds: [ref.id, t.id],
      });
    }
  }

  // Same card fingerprint
  for (const t of techs) {
    if (!t.referredBy || !t.signupCardFingerprint) continue;
    const ref = byHandle.get(t.referredBy.toLowerCase());
    if (ref?.signupCardFingerprint && ref.signupCardFingerprint === t.signupCardFingerprint) {
      flags.push({
        rule: "same_card_fingerprint",
        title: `Same card fingerprint: /${ref.handle} → /${t.handle}`,
        detail: "Flagged for review",
        techIds: [ref.id, t.id],
      });
    }
  }

  // Same email local-part pattern (soft)
  for (const t of techs) {
    if (!t.referredBy) continue;
    const ref = byHandle.get(t.referredBy.toLowerCase());
    if (!ref) continue;
    const a = t.email.split("@")[0]?.replace(/[^a-z0-9]/gi, "");
    const b = ref.email.split("@")[0]?.replace(/[^a-z0-9]/gi, "");
    if (a && b && a === b && t.email !== ref.email) {
      flags.push({
        rule: "similar_email_local",
        title: `Similar email local-part: /${ref.handle} → /${t.handle}`,
        detail: `${ref.email} / ${t.email}`,
        techIds: [ref.id, t.id],
      });
    }
  }

  return flags;
}

export async function getReferralsSnapshot(): Promise<ReferralsSnapshot> {
  const sb = supabaseService();
  const includeInternal = await shouldIncludeInternal(sb);
  const { data } = await sb.from("techs").select("*").limit(5000);
  const techs = filterOutInternal((data ?? []) as Tech[], includeInternal);
  const byHandle = new Map(techs.map((t) => [t.handle.toLowerCase(), t]));

  const edges: ReferralEdge[] = [];
  for (const t of techs) {
    if (!t.referredBy) continue;
    const ref = byHandle.get(t.referredBy.toLowerCase());
    if (!ref) continue;
    const pairFraud = detectReferralFraud([ref, t]).map((f) => f.rule);
    edges.push({
      referrerId: ref.id,
      referrerHandle: ref.handle,
      referredId: t.id,
      referredHandle: t.handle,
      referredLabel: t.businessName || t.handle,
      firstPaidAt:
        t.subscriptionStatus === "active" || t.subscriptionStatus === "trialing"
          ? t.referralCreditGrantedAt || t.currentPeriodEnd || t.createdAt
          : null,
      creditGrantedAt: t.referralCreditGrantedAt ?? null,
      fraudFlags: [...new Set(pairFraud)],
    });
  }

  const fraud = detectReferralFraud(techs);
  const partnersList = await listPartners().catch(() => []);
  const { data: ledger } = await sb.from("partner_ledger_entries").select("*").limit(2000);
  const owed = new Map<string, number>();
  const paid = new Map<string, number>();
  for (const e of ledger ?? []) {
    const slug = String(e.partnerSlug);
    if (e.kind === "commission_owed" || e.kind === "adjustment") {
      owed.set(slug, (owed.get(slug) ?? 0) + (e.amountPennies as number));
    }
    if (e.kind === "commission_paid") {
      paid.set(slug, (paid.get(slug) ?? 0) + (e.amountPennies as number));
    }
  }

  const partners: PartnerLedgerRow[] = [];
  for (const p of partnersList) {
    const signed = techs.filter((t) => t.signupPartnerSlug === p.slug);
    const converted = signed.filter((t) => t.subscriptionStatus === "active");
    const revenueAttributedPennies = converted.reduce(
      (s, t) => s + (planMrrPennies(t.plan) || LIST_MONTHLY_PENNIES),
      0,
    );
    const commissionOwedPennies = owed.get(p.slug) ?? 0;
    const commissionPaidPennies = paid.get(p.slug) ?? 0;
    partners.push({
      slug: p.slug,
      name: p.name,
      signups: signed.length,
      converted: converted.length,
      revenueAttributedPennies,
      commissionOwedPennies,
      commissionPaidPennies,
      outstandingPennies: commissionOwedPennies - commissionPaidPennies,
    });
  }

  return { edges, fraud, partners, generatedAt: new Date().toISOString() };
}

export async function addPartnerLedgerEntry(opts: {
  partnerSlug: string;
  kind: "commission_owed" | "commission_paid" | "adjustment";
  amountPennies: number;
  note: string;
  periodMonth?: string;
  techId?: string;
  createdByEmail: string;
}): Promise<void> {
  await supabaseService().from("partner_ledger_entries").insert({
    id: randomId("pled"),
    partnerSlug: opts.partnerSlug,
    kind: opts.kind,
    amountPennies: opts.amountPennies,
    note: opts.note,
    periodMonth: opts.periodMonth ?? null,
    techId: opts.techId ?? null,
    createdByEmail: opts.createdByEmail,
    createdAt: new Date().toISOString(),
  });
}

/** CSV for quarterly partner statement. */
export function partnerStatementCsv(row: PartnerLedgerRow, quarterLabel: string): string {
  const lines = [
    "partner,quarter,signups,converted,revenue_gbp,commission_owed_gbp,commission_paid_gbp,outstanding_gbp",
    [
      row.slug,
      quarterLabel,
      row.signups,
      row.converted,
      (row.revenueAttributedPennies / 100).toFixed(2),
      (row.commissionOwedPennies / 100).toFixed(2),
      (row.commissionPaidPennies / 100).toFixed(2),
      (row.outstandingPennies / 100).toFixed(2),
    ].join(","),
  ];
  return lines.join("\n");
}
