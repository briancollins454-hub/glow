"use server";

import { redirect } from "next/navigation";
import { requireOwner } from "@/lib/owner/require-owner";
import { getTechById } from "@/lib/db/queries";
import { supabaseService } from "@/lib/supabase/service";
import { endViewAsSession, startViewAsSession } from "@/lib/owner/view-as";

export async function startViewAsAction(formData: FormData) {
  const { tech: admin } = await requireOwner();
  const id = String(formData.get("id") ?? "");
  const target = await getTechById(supabaseService(), id);
  if (!target) redirect("/dashboard/admin/accounts");
  try {
    await startViewAsSession({ ownerEmail: admin.email, target });
  } catch {
    redirect(`/dashboard/admin/accounts/${id}?err=viewas`);
  }
  redirect(`/dashboard/admin/accounts/${id}/view-as`);
}

export async function endViewAsAction() {
  const { tech: admin } = await requireOwner();
  await endViewAsSession(admin.email);
  redirect("/dashboard/admin/accounts");
}
