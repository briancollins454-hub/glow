/**
 * Platform-wide owner_audit listing / export (Phase 3.10).
 */

import { supabaseService } from "@/lib/supabase/service";

export type OwnerAuditRow = {
  id: string;
  actorEmail: string;
  action: string;
  targetType: string;
  targetId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export async function listOwnerAudit(opts?: {
  q?: string;
  action?: string;
  targetId?: string;
  limit?: number;
}): Promise<OwnerAuditRow[]> {
  const sb = supabaseService();
  let q = sb
    .from("owner_audit")
    .select("*")
    .order("createdAt", { ascending: false })
    .limit(opts?.limit ?? 100);
  if (opts?.action) q = q.eq("action", opts.action);
  if (opts?.targetId) q = q.eq("targetId", opts.targetId);
  if (opts?.q) {
    const needle = opts.q.trim();
    q = q.or(`actorEmail.ilike.%${needle}%,action.ilike.%${needle}%,targetId.ilike.%${needle}%`);
  }
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as OwnerAuditRow[];
}
