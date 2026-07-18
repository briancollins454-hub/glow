import { cache } from "react";
import { unstable_cache, revalidateTag } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseService } from "@/lib/supabase/service";
import { getTechByAuthUserId } from "@/lib/db/queries";
import type { StaffMember, Tech } from "@/lib/db/types";

export type DashboardContext = {
  sb: SupabaseClient;
  tech: Tech;
  /** Set when the session belongs to a staff login rather than the owner. */
  staff: StaffMember | null;
  role: "owner" | "staff";
};

const cachedTechForAuthUser = (authUserId: string) =>
  unstable_cache(
    async () => getTechByAuthUserId(supabaseService(), authUserId),
    ["dashboard-tech", authUserId],
    { revalidate: 30, tags: [`tech-auth-${authUserId}`] },
  )();

const cachedStaffForAuthUser = (authUserId: string) =>
  unstable_cache(
    async () => {
      const { getStaffByAuthUserId, getTechById } = await import("@/lib/db/queries");
      const sb = supabaseService();
      const staff = await getStaffByAuthUserId(sb, authUserId).catch(() => null);
      if (!staff || !staff.active) return null;
      const tech = await getTechById(sb, staff.techId);
      if (!tech) return null;
      return { staff, tech };
    },
    ["dashboard-staff", authUserId],
    { revalidate: 30, tags: [`tech-auth-${authUserId}`] },
  )();

// Dashboard context: the tech (account) profile plus who is logged in.
// Owners get the RLS-scoped authenticated client; staff logins have no techs
// row of their own, so their queries run on the service client (every query in
// the data layer is explicitly techId-scoped). Returns null when there is no
// valid session / profile. Cached per request so layout + page share one
// auth round-trip.
export const getDashboardContext = cache(async (): Promise<DashboardContext | null> => {
  const sb = await createSupabaseServerClient();
  // getUser revalidates the JWT with Supabase Auth (do not trust cookie-only getSession).
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return null;

  const tech = await cachedTechForAuthUser(user.id);
  if (tech) return { sb, tech, staff: null, role: "owner" };

  // Staff login (salon mode): resolve their account via the staff record.
  const viaStaff = await cachedStaffForAuthUser(user.id);
  if (viaStaff) {
    return { sb: supabaseService(), tech: viaStaff.tech, staff: viaStaff.staff, role: "staff" };
  }
  return null;
});

export async function getCurrentTech(): Promise<Tech | null> {
  const ctx = await getDashboardContext();
  return ctx?.tech ?? null;
}

export function invalidateDashboardTech(authUserId: string | null | undefined) {
  if (authUserId) revalidateTag(`tech-auth-${authUserId}`);
}
