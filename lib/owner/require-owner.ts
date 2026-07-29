import { notFound, redirect } from "next/navigation";
import { getDashboardContext } from "@/lib/auth/session";
import { isAdminTech, isPlatformOwner } from "@/lib/admin";
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

/**
 * Destructive moderation (block / delete accounts).
 * Exclusive to brian@thesupportsdesk.com — not every ADMIN_EMAILS entry.
 */
export async function requirePlatformOwner(): Promise<OwnerContext> {
  const ctx = await requireOwner();
  if (!isPlatformOwner(ctx.tech)) notFound();
  return ctx;
}

export function ownerSb() {
  return supabaseService();
}
