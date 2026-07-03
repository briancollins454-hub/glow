"use server";

import { getDashboardContext } from "@/lib/auth/session";
import { createMessage, getClient } from "@/lib/db/queries";
import { notifyClientOfMessage } from "@/lib/notify";
import { isLive } from "@/lib/subscriptions";
import type { Message } from "@/lib/db/types";

type SendResult = { ok: boolean; message?: Message; error?: string };

/** Delete an entire conversation with a client. */
export async function deleteConversationAction(formData: FormData) {
  const { redirect } = await import("next/navigation");
  const ctx = await getDashboardContext();
  if (!ctx) redirect("/login");
  const { sb, tech } = ctx!;
  const clientId = String(formData.get("clientId") ?? "");
  const client = await getClient(sb, clientId);
  if (client && client.techId === tech.id) {
    const { error } = await sb.from("messages").delete().eq("clientId", clientId);
    if (error) throw new Error(error.message);
  }
  redirect("/dashboard/messages");
}

/** Tech sends a message to a client (bound to clientId in the page). */
export async function sendMessageAction(clientId: string, body: string): Promise<SendResult> {
  const text = body.trim();
  if (!text) return { ok: false, error: "Message is empty" };
  const ctx = await getDashboardContext();
  if (!ctx) return { ok: false, error: "Not signed in" };
  const { sb, tech } = ctx;
  if (!isLive(tech)) {
    return { ok: false, error: "Messaging needs an active plan. Start your trial in Billing to reply to clients." };
  }
  const client = await getClient(sb, clientId);
  if (!client) return { ok: false, error: "Client not found" };
  const message = await createMessage(sb, { techId: tech.id, clientId, sender: "tech", body: text });
  try {
    await notifyClientOfMessage(client, tech, text);
  } catch {
    // Email is best-effort; the in-app message is already saved.
  }
  return { ok: true, message };
}
