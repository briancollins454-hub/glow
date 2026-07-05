"use server";

import { redirect } from "next/navigation";
import { supabaseService } from "@/lib/supabase/service";
import { createAuditEvent, getClientByMessageToken, updateClient } from "@/lib/db/queries";

export async function setMarketingOptOutAction(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const optOut = formData.get("optOut") === "1";
  const sb = supabaseService();
  const client = await getClientByMessageToken(sb, token);
  if (!client) redirect("/");

  await updateClient(sb, client!.id, { marketingOptOut: optOut });
  try {
    await createAuditEvent(sb, {
      techId: client!.techId,
      actor: "client",
      action: optOut ? "marketing_opt_out" : "marketing_opt_in",
      entityType: "client",
      entityId: client!.id,
      metadata: {},
    });
  } catch {
    // Audit is best-effort.
  }
  redirect(`/unsubscribe/${token}?done=${optOut ? "out" : "in"}`);
}
