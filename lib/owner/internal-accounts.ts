import type { SupabaseClient } from "@supabase/supabase-js";
import type { Tech } from "@/lib/db/types";
import { supabaseService } from "@/lib/supabase/service";

const INCLUDE_INTERNAL_KEY = "includeInternalInMetrics";

export function isInternalTech(tech: Pick<Tech, "isInternal"> | { isInternal?: boolean | null }): boolean {
  return !!tech.isInternal;
}

/** Exclude internal accounts unless the owner toggle is on. */
export async function shouldIncludeInternal(sb?: SupabaseClient): Promise<boolean> {
  try {
    const client = sb ?? supabaseService();
    const { data } = await client
      .from("owner_settings")
      .select("value")
      .eq("key", INCLUDE_INTERNAL_KEY)
      .maybeSingle();
    const value = (data as { value?: { enabled?: boolean } } | null)?.value;
    return !!value?.enabled;
  } catch {
    return false;
  }
}

export async function setIncludeInternal(
  sb: SupabaseClient,
  enabled: boolean,
  byEmail: string,
): Promise<void> {
  await sb.from("owner_settings").upsert({
    key: INCLUDE_INTERNAL_KEY,
    value: { enabled },
    updatedAt: new Date().toISOString(),
    updatedByEmail: byEmail,
  });
}

/** Apply .eq("isInternal", false) when internals should be hidden. */
export function applyInternalFilter<T extends { eq: (c: string, v: boolean) => T }>(
  query: T,
  includeInternal: boolean,
): T {
  if (includeInternal) return query;
  return query.eq("isInternal", false);
}

export function filterOutInternal<T extends { isInternal?: boolean | null }>(
  rows: T[],
  includeInternal: boolean,
): T[] {
  if (includeInternal) return rows;
  return rows.filter((r) => !r.isInternal);
}

/** Suggested accounts to mark internal (never auto-applied). */
export async function suggestInternalAccounts(sb: SupabaseClient): Promise<Tech[]> {
  const { data, error } = await sb
    .from("techs")
    .select("*")
    .eq("isInternal", false)
    .or(
      [
        "email.ilike.%@test.com",
        "email.ilike.%@example.com",
        "email.ilike.brian@thesupportsdesk.com",
        "handle.ilike.%test%",
        "handle.ilike.%demo%",
        "handle.ilike.%glow%",
        "businessName.ilike.%test%",
        "businessName.ilike.%demo%",
      ].join(","),
    )
    .order("createdAt", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return (data ?? []) as Tech[];
}
