import type { SupabaseClient } from "@supabase/supabase-js";
import { createStaff, listStaff } from "@/lib/db/queries";
import type { StaffMember, Tech } from "@/lib/db/types";

export const ANY_STAFF = "any";

type DayOption = { dateStr: string; slots: string[] };

/**
 * Every account has an "owner" staff member (created by migration 0029 or at
 * signup). Lazily create one for accounts that somehow miss it so the booking
 * engine always has a person to attach hours and appointments to.
 */
export async function getOrCreateOwnerStaff(
  sb: SupabaseClient,
  tech: Pick<Tech, "id" | "authUserId" | "name" | "businessName" | "email">,
): Promise<StaffMember> {
  const staff = await listStaff(sb, tech.id);
  const owner = staff.find((s) => s.role === "owner") ?? staff[0];
  if (owner) return owner;
  return createStaff(sb, {
    techId: tech.id,
    authUserId: tech.authUserId,
    name: tech.name?.trim() || tech.businessName || "Owner",
    email: tech.email,
    role: "owner",
    photoPath: null,
    bio: "",
    active: true,
    sortOrder: 0,
  });
}

/**
 * Can this staff member perform every one of these services? An empty
 * restriction list means they perform ALL services.
 */
export function staffCanPerform(
  restrictions: Record<string, string[]>,
  staffId: string,
  serviceIds: string[],
): boolean {
  const allowed = restrictions[staffId] ?? [];
  if (allowed.length === 0) return true;
  return serviceIds.every((id) => allowed.includes(id));
}

/** Active staff who can perform the whole visit. */
export function capableStaff(
  staff: StaffMember[],
  restrictions: Record<string, string[]>,
  serviceIds: string[],
): StaffMember[] {
  return staff.filter((s) => s.active && staffCanPerform(restrictions, s.id, serviceIds));
}

/** Merge several staff members' day options into one "any available" list. */
export function unionDayOptions(perStaff: DayOption[][], count = 14): DayOption[] {
  const byDate = new Map<string, Set<string>>();
  for (const days of perStaff) {
    for (const day of days) {
      const set = byDate.get(day.dateStr) ?? new Set<string>();
      for (const slot of day.slots) set.add(slot);
      byDate.set(day.dateStr, set);
    }
  }
  return [...byDate.entries()]
    .map(([dateStr, slots]) => ({ dateStr, slots: [...slots].sort() }))
    .sort((a, z) => a.dateStr.localeCompare(z.dateStr))
    .slice(0, count);
}
