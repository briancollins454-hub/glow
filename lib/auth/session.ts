import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getTechByAuthUserId } from "@/lib/db/queries";
import type { Tech } from "@/lib/db/types";

// Dashboard context: the authenticated Supabase client (RLS-scoped) plus the
// tech profile. Returns null when there is no valid session / profile.
// Cached per request so layout + page share one auth round-trip.
export const getDashboardContext = cache(async (): Promise<
  { sb: SupabaseClient; tech: Tech } | null
> => {
  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return null;
  const tech = await getTechByAuthUserId(sb, user.id);
  if (!tech) return null;
  return { sb, tech };
});

export async function getCurrentTech(): Promise<Tech | null> {
  const ctx = await getDashboardContext();
  return ctx?.tech ?? null;
}
