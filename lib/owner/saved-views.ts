/**
 * Saved account directory views (Phase 4).
 */

import { randomId } from "@/lib/ids";
import { supabaseService } from "@/lib/supabase/service";

export type AccountFilters = {
  q?: string;
  status?: string;
  tag?: string;
  healthBand?: string;
  atRisk?: boolean;
  signupSinceDays?: number;
};

export type SavedView = {
  id: string;
  ownerEmail: string;
  name: string;
  columns: string[];
  filters: AccountFilters;
  sort: string;
  createdAt: string;
  updatedAt: string;
};

export const DEFAULT_ACCOUNT_COLUMNS = [
  "account",
  "offer",
  "status",
  "health",
  "mrr",
  "joined",
  "flags",
] as const;

export async function listSavedViews(ownerEmail: string): Promise<SavedView[]> {
  const { data, error } = await supabaseService()
    .from("owner_saved_views")
    .select("*")
    .eq("ownerEmail", ownerEmail.trim().toLowerCase())
    .order("updatedAt", { ascending: false })
    .limit(40);
  if (error) {
    // Table may be missing pre-0061
    return [];
  }
  return (data ?? []).map((r) => ({
    id: r.id,
    ownerEmail: r.ownerEmail,
    name: r.name,
    columns: Array.isArray(r.columns) ? r.columns : [...DEFAULT_ACCOUNT_COLUMNS],
    filters: (r.filters ?? {}) as AccountFilters,
    sort: r.sort || "createdAt",
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));
}

export async function saveView(opts: {
  ownerEmail: string;
  name: string;
  columns: string[];
  filters: AccountFilters;
  sort: string;
  id?: string;
}): Promise<SavedView> {
  const id = opts.id || randomId("osv");
  const row = {
    id,
    ownerEmail: opts.ownerEmail.trim().toLowerCase(),
    name: opts.name.slice(0, 80),
    columns: opts.columns,
    filters: opts.filters,
    sort: opts.sort,
    updatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };
  const { error } = await supabaseService().from("owner_saved_views").upsert(row);
  if (error) throw new Error(error.message);
  return {
    id,
    ownerEmail: row.ownerEmail,
    name: row.name,
    columns: opts.columns,
    filters: opts.filters,
    sort: opts.sort,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function deleteSavedView(id: string, ownerEmail: string): Promise<void> {
  await supabaseService()
    .from("owner_saved_views")
    .delete()
    .eq("id", id)
    .eq("ownerEmail", ownerEmail.trim().toLowerCase());
}

export function filtersToSearchParams(f: AccountFilters & { sort?: string }): string {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.status) p.set("status", f.status);
  if (f.tag) p.set("tag", f.tag);
  if (f.healthBand) p.set("healthBand", f.healthBand);
  if (f.atRisk) p.set("atRisk", "1");
  if (f.signupSinceDays) p.set("signupSince", String(f.signupSinceDays));
  if (f.sort) p.set("sort", f.sort);
  return p.toString();
}
