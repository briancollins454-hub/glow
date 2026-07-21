import { notFound, redirect } from "next/navigation";
import { getDashboardContext } from "@/lib/auth/session";
import { isAdminTech } from "@/lib/admin";
import type { Tech } from "@/lib/db/types";
import { supabaseService } from "@/lib/supabase/service";

export type OwnerContext = {
  tech: Tech;
  role: "owner" | "staff";
};

/** Server-side owner gate. Re-check on every route and action. */
export async function requireOwner(): Promise<OwnerContext> {
  const c = await getDashboardContext();
  if (!c) redirect("/login");
  if (c.role !== "owner" || !isAdminTech(c.tech)) notFound();
  return { tech: c.tech, role: c.role };
}

export function ownerSb() {
  return supabaseService();
}
