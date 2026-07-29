import { supabaseService } from "@/lib/supabase/service";
import type { MetricValue } from "@/lib/owner/overview";

export type DeliveryKindRow = {
  kind: string;
  sent: number;
  delivered: number;
  bounced: number;
  complained: number;
  deferred: number;
  skipped: number;
};

export type DeliveryDomainRow = {
  domain: string;
  sent: number;
  bounced: number;
  complained: number;
};

export type DeliverabilitySnapshot = {
  windows: Record<
    "24h" | "7d" | "30d",
    {
      sent: MetricValue;
      delivered: MetricValue;
      bounced: MetricValue;
      complained: MetricValue;
      deferred: MetricValue;
      skipped: MetricValue;
    }
  >;
  byKind: DeliveryKindRow[];
  byDomain: DeliveryDomainRow[];
  suppressions: {
    email: string;
    reason: string | null;
    permanent: boolean;
    consecutiveSoftFailures: number;
    lastEventType: string | null;
    updatedAt: string;
    accounts: string[];
  }[];
  flaggedAccounts: {
    id: string;
    businessName: string;
    handle: string;
    email: string;
    reason: string | null;
    at: string | null;
  }[];
};

function sinceIso(hours: number): string {
  return new Date(Date.now() - hours * 3600_000).toISOString();
}

function ok(n: number): MetricValue {
  return { ok: true, value: n };
}
function unavailable(reason: string): MetricValue {
  return { ok: false, reason };
}

async function countOutbound(
  since: string,
  filter?: { column: string; value: string | boolean },
): Promise<MetricValue> {
  try {
    const sb = supabaseService();
    let q = sb
      .from("outbound_sends")
      .select("id", { count: "exact", head: true })
      .gte("createdAt", since)
      .eq("channel", "email");
    if (filter) q = q.eq(filter.column, filter.value);
    const { count, error } = await q;
    if (error) return unavailable(error.message);
    return ok(count ?? 0);
  } catch (e) {
    return unavailable((e as Error).message);
  }
}

export async function getDeliverabilitySnapshot(): Promise<DeliverabilitySnapshot> {
  const sb = supabaseService();
  const windows = {
    "24h": sinceIso(24),
    "7d": sinceIso(24 * 7),
    "30d": sinceIso(24 * 30),
  } as const;

  const windowStats = {} as DeliverabilitySnapshot["windows"];
  for (const [key, since] of Object.entries(windows) as [keyof typeof windows, string][]) {
    const [sent, delivered, bounced, complained, deferred, skipped] = await Promise.all([
      countOutbound(since),
      countOutbound(since, { column: "deliveryStatus", value: "delivered" }),
      countOutbound(since, { column: "deliveryStatus", value: "bounced" }),
      countOutbound(since, { column: "deliveryStatus", value: "complained" }),
      countOutbound(since, { column: "deliveryStatus", value: "delayed" }),
      countOutbound(since, { column: "ok", value: false }),
    ]);
    // skipped = suppressed skips if column exists — approximate via error containing suppress
    windowStats[key] = { sent, delivered, bounced, complained, deferred, skipped };
  }

  // By kind (30d)
  const { data: kindRows } = await sb
    .from("outbound_sends")
    .select("kind, deliveryStatus, ok")
    .eq("channel", "email")
    .gte("createdAt", windows["30d"])
    .limit(5000);
  const byKindMap = new Map<string, DeliveryKindRow>();
  for (const row of kindRows ?? []) {
    const kind = String(row.kind || "unknown");
    const cur = byKindMap.get(kind) ?? {
      kind,
      sent: 0,
      delivered: 0,
      bounced: 0,
      complained: 0,
      deferred: 0,
      skipped: 0,
    };
    cur.sent++;
    if (row.deliveryStatus === "delivered") cur.delivered++;
    if (row.deliveryStatus === "bounced") cur.bounced++;
    if (row.deliveryStatus === "complained") cur.complained++;
    if (row.deliveryStatus === "delayed") cur.deferred++;
    if (row.ok === false) cur.skipped++;
    byKindMap.set(kind, cur);
  }

  // By domain
  const { data: destRows } = await sb
    .from("outbound_sends")
    .select("destination, deliveryStatus")
    .eq("channel", "email")
    .gte("createdAt", windows["30d"])
    .limit(5000);
  const domainMap = new Map<string, DeliveryDomainRow>();
  for (const row of destRows ?? []) {
    const email = String(row.destination || "");
    const domain = email.includes("@") ? email.split("@")[1]!.toLowerCase() : "other";
    const bucket =
      /gmail\.com$/.test(domain)
        ? "gmail.com"
        : /(outlook|hotmail|live)\./.test(domain)
          ? "outlook/hotmail"
          : /yahoo\./.test(domain)
            ? "yahoo"
            : /icloud\.com$|me\.com$/.test(domain)
              ? "icloud"
              : "other";
    const cur = domainMap.get(bucket) ?? { domain: bucket, sent: 0, bounced: 0, complained: 0 };
    cur.sent++;
    if (row.deliveryStatus === "bounced") cur.bounced++;
    if (row.deliveryStatus === "complained") cur.complained++;
    domainMap.set(bucket, cur);
  }

  const { data: suppressions } = await sb
    .from("email_suppressions")
    .select("*")
    .eq("suppressed", true)
    .order("updatedAt", { ascending: false })
    .limit(100);

  const suppressionRows = [];
  for (const s of suppressions ?? []) {
    const email = String(s.email);
    const { findAccountEmailsByAddress } = await import("@/lib/email-suppression");
    const hits = await findAccountEmailsByAddress(sb, email).catch(() => []);
    suppressionRows.push({
      email,
      reason: s.reason as string | null,
      permanent: !!s.permanent,
      consecutiveSoftFailures: s.consecutiveSoftFailures ?? 0,
      lastEventType: s.lastEventType as string | null,
      updatedAt: s.updatedAt as string,
      accounts: hits.map((h) => h.label),
    });
  }

  const { data: flagged } = await sb
    .from("techs")
    .select("id, businessName, handle, email, emailDeliveryIssueReason, emailDeliveryIssueAt")
    .eq("emailDeliveryIssue", true)
    .order("emailDeliveryIssueAt", { ascending: false })
    .limit(50);

  return {
    windows: windowStats,
    byKind: [...byKindMap.values()].sort((a, b) => b.sent - a.sent),
    byDomain: [...domainMap.values()].sort((a, b) => b.sent - a.sent),
    suppressions: suppressionRows,
    flaggedAccounts: (flagged ?? []).map((t) => ({
      id: t.id,
      businessName: t.businessName,
      handle: t.handle,
      email: t.email,
      reason: t.emailDeliveryIssueReason,
      at: t.emailDeliveryIssueAt,
    })),
  };
}
