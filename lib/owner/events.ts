/**
 * Platform event feed (Phase 3.4).
 */

import { supabaseService } from "@/lib/supabase/service";
import { recordPlatformEvent } from "@/lib/owner/owner-audit-log";

export type PlatformEvent = {
  id: string;
  type: string;
  techId: string | null;
  severity: string;
  title: string;
  detail: Record<string, unknown>;
  createdAt: string;
};

export async function listPlatformEvents(opts?: {
  type?: string;
  techId?: string;
  severity?: string;
  q?: string;
  limit?: number;
}): Promise<PlatformEvent[]> {
  const sb = supabaseService();
  let q = sb
    .from("platform_events")
    .select("*")
    .gte("createdAt", new Date(Date.now() - 90 * 24 * 3600_000).toISOString())
    .order("createdAt", { ascending: false })
    .limit(opts?.limit ?? 100);
  if (opts?.type) q = q.eq("type", opts.type);
  if (opts?.techId) q = q.eq("techId", opts.techId);
  if (opts?.severity) q = q.eq("severity", opts.severity);
  if (opts?.q) q = q.ilike("title", `%${opts.q}%`);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as PlatformEvent[];
}

/** Backfill a few event types from existing tables for a fresh feed. */
export async function hydrateRecentEvents(): Promise<number> {
  const sb = supabaseService();
  let n = 0;
  const since = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();
  const { data: signups } = await sb
    .from("techs")
    .select("id, businessName, handle, createdAt")
    .gte("createdAt", since)
    .limit(40);
  for (const t of signups ?? []) {
    await recordPlatformEvent({
      type: "signup",
      techId: t.id,
      title: `Signup: ${t.businessName || t.handle}`,
      detail: { handle: t.handle, at: t.createdAt },
    });
    n++;
  }
  return n;
}
