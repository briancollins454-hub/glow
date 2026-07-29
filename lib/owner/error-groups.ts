/**
 * Error grouping (Phase 3.8) — fingerprint collapse.
 */

import { supabaseService } from "@/lib/supabase/service";

export type ErrorGroup = {
  signature: string;
  message: string;
  count: number;
  firstSeen: string;
  lastSeen: string;
  affectedAccounts: string[];
  sampleStack: string | null;
  resolvedAt: string | null;
  sampleIds: string[];
};

export function fingerprintError(message: string, name = "Error"): string {
  return `${name}:${message}`.slice(0, 200);
}

export async function listErrorGroups(opts?: { includeResolved?: boolean; limit?: number }): Promise<ErrorGroup[]> {
  const sb = supabaseService();
  let q = sb
    .from("platform_errors")
    .select("id, signature, message, stack, techId, createdAt, resolvedAt")
    .order("createdAt", { ascending: false })
    .limit(2000);
  if (!opts?.includeResolved) q = q.is("resolvedAt", null);
  const { data, error } = await q;
  if (error) throw new Error(error.message);

  const map = new Map<string, ErrorGroup>();
  for (const row of data ?? []) {
    const sig = String(row.signature || fingerprintError(row.message));
    const cur = map.get(sig) ?? {
      signature: sig,
      message: row.message,
      count: 0,
      firstSeen: row.createdAt,
      lastSeen: row.createdAt,
      affectedAccounts: [] as string[],
      sampleStack: row.stack,
      resolvedAt: row.resolvedAt,
      sampleIds: [] as string[],
    };
    cur.count++;
    if (row.createdAt < cur.firstSeen) cur.firstSeen = row.createdAt;
    if (row.createdAt > cur.lastSeen) cur.lastSeen = row.createdAt;
    if (row.techId && !cur.affectedAccounts.includes(row.techId)) {
      cur.affectedAccounts.push(row.techId);
    }
    if (cur.sampleIds.length < 5) cur.sampleIds.push(row.id);
    if (!cur.sampleStack && row.stack) cur.sampleStack = row.stack;
    // If any row unresolved, group is open
    if (!row.resolvedAt) cur.resolvedAt = null;
    map.set(sig, cur);
  }

  return [...map.values()]
    .sort((a, b) => b.count - a.count || b.affectedAccounts.length - a.affectedAccounts.length)
    .slice(0, opts?.limit ?? 80);
}

export async function resolveErrorGroup(signature: string, byEmail: string): Promise<void> {
  await supabaseService()
    .from("platform_errors")
    .update({ resolvedAt: new Date().toISOString(), resolvedBy: byEmail })
    .eq("signature", signature)
    .is("resolvedAt", null);
}
