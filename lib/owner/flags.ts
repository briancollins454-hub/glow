/**
 * Feature flags (Phase 3.11) — global + per-account overrides.
 */

import { randomId } from "@/lib/ids";
import { supabaseService } from "@/lib/supabase/service";
import { writeOwnerAudit } from "@/lib/owner/owner-audit-log";

export type FeatureFlag = {
  key: string;
  description: string;
  enabledGlobal: boolean;
  updatedAt: string;
  updatedByEmail: string | null;
};

export type FlagOverride = {
  id: string;
  key: string;
  techId: string;
  enabled: boolean;
};

export async function listFeatureFlags(): Promise<FeatureFlag[]> {
  const { data, error } = await supabaseService()
    .from("feature_flags")
    .select("*")
    .order("key", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    key: r.key,
    description: r.description,
    enabledGlobal: !!r.enabledGlobal,
    updatedAt: r.updatedAt,
    updatedByEmail: r.updatedByEmail,
  }));
}

export async function setFeatureFlagGlobal(opts: {
  key: string;
  enabled: boolean;
  byEmail: string;
}): Promise<void> {
  await supabaseService()
    .from("feature_flags")
    .update({
      enabledGlobal: opts.enabled,
      updatedAt: new Date().toISOString(),
      updatedByEmail: opts.byEmail,
    })
    .eq("key", opts.key);
  await writeOwnerAudit({
    actorEmail: opts.byEmail,
    action: "feature_flag_global",
    metadata: { key: opts.key, enabled: opts.enabled },
  });
}

export async function setFeatureFlagOverride(opts: {
  key: string;
  techId: string;
  enabled: boolean;
  byEmail: string;
}): Promise<void> {
  await supabaseService().from("feature_flag_overrides").upsert(
    {
      id: randomId("ffo"),
      key: opts.key,
      techId: opts.techId,
      enabled: opts.enabled,
      updatedAt: new Date().toISOString(),
      updatedByEmail: opts.byEmail,
    },
    { onConflict: "key,techId" },
  );
  await writeOwnerAudit({
    actorEmail: opts.byEmail,
    action: "feature_flag_override",
    targetType: "tech",
    targetId: opts.techId,
    metadata: { key: opts.key, enabled: opts.enabled },
  });
}

export async function resolveFlagForTech(key: string, techId: string): Promise<boolean> {
  const sb = supabaseService();
  const { data: override } = await sb
    .from("feature_flag_overrides")
    .select("enabled")
    .eq("key", key)
    .eq("techId", techId)
    .maybeSingle();
  if (override) return !!override.enabled;
  const { data: flag } = await sb
    .from("feature_flags")
    .select("enabledGlobal")
    .eq("key", key)
    .maybeSingle();
  return !!flag?.enabledGlobal;
}

export async function flagsForTech(techId: string): Promise<Record<string, boolean>> {
  const flags = await listFeatureFlags();
  const out: Record<string, boolean> = {};
  for (const f of flags) {
    out[f.key] = await resolveFlagForTech(f.key, techId);
  }
  return out;
}
