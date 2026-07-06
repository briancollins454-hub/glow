import { cache } from "react";
import { unstable_cache, revalidateTag } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseService } from "@/lib/supabase/service";
import { getTechByAuthUserId } from "@/lib/db/queries";
import type { Tech } from "@/lib/db/types";

const cachedTechForAuthUser = (authUserId: string) =>
  unstable_cache(
    async () => getTechByAuthUserId(supabaseService(), authUserId),
    ["dashboard-tech", authUserId],
    { revalidate: 30, tags: [`tech-auth-${authUserId}`] },
  )();

// Dashboard context: the authenticated Supabase client (RLS-scoped) plus the
// tech profile. Returns null when there is no valid session / profile.
// Cached per request so layout + page share one auth round-trip.
export const getDashboardContext = cache(async (): Promise<
  { sb: SupabaseClient; tech: Tech } | null
> => {
  const sb = await createSupabaseServerClient();
  // getSession reads the JWT from cookies — no network round-trip to Supabase.
  const {
    data: { session },
  } = await sb.auth.getSession();
  const user = session?.user;
  if (!user) return null;
  const tech = await cachedTechForAuthUser(user.id);
  if (!tech) return null;
  return { sb, tech };
});

export async function getCurrentTech(): Promise<Tech | null> {
  const ctx = await getDashboardContext();
  return ctx?.tech ?? null;
}

export function invalidateDashboardTech(authUserId: string | null | undefined) {
  if (authUserId) revalidateTag(`tech-auth-${authUserId}`);
}
