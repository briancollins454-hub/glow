import type { Partner } from "@/lib/db/types";
import { supabaseService } from "@/lib/supabase/service";
import { randomId } from "@/lib/ids";

function mapPartner(row: Record<string, unknown>): Partner {
  return {
    id: String(row.id),
    slug: String(row.slug),
    name: String(row.name),
    logoUrl: String(row.logoUrl ?? ""),
    offerType: String(row.offerType ?? "three_months_free"),
    active: row.active !== false,
    createdAt: String(row.createdAt),
  };
}

export async function getPartnerBySlug(slug: string): Promise<Partner | null> {
  const normalised = slug.trim().toLowerCase();
  if (!normalised) return null;
  const { data, error } = await supabaseService()
    .from("partners")
    .select("*")
    .eq("slug", normalised)
    .eq("active", true)
    .maybeSingle();
  if (error) throw error;
  return data ? mapPartner(data as Record<string, unknown>) : null;
}

export async function listPartners(): Promise<Partner[]> {
  const { data, error } = await supabaseService()
    .from("partners")
    .select("*")
    .order("createdAt", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => mapPartner(row as Record<string, unknown>));
}

export async function createPartner(input: {
  name: string;
  slug: string;
  logoUrl?: string | null;
}): Promise<Partner> {
  const slug = input.slug
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!slug) throw new Error("Partner slug is required.");
  const name = input.name.trim();
  if (!name) throw new Error("Partner name is required.");

  const { data, error } = await supabaseService()
    .from("partners")
    .insert({
      id: randomId("partner"),
      name,
      slug,
      logoUrl: input.logoUrl?.trim() || "",
      offerType: "three_months_free",
      active: true,
    })
    .select("*")
    .single();
  if (error) throw error;
  return mapPartner(data as Record<string, unknown>);
}
