"use server";

import { getDashboardContext } from "@/lib/auth/session";
import { createMessage, getClient } from "@/lib/db/queries";
import { notifyClientOfMessage } from "@/lib/notify";
import { isLive } from "@/lib/subscriptions";
import type { Message } from "@/lib/db/types";
import { revalidatePath } from "next/cache";

export type SendResult = {
  ok: boolean;
  message?: Message;
  error?: string;
  /** Whether the client was emailed about this message. */
  emailSent?: boolean;
  /** Human-readable note when email was not sent. */
  emailNote?: string;
};

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
    return { ok: false, error: "Messaging needs an active plan. Subscribe in Billing to reply to clients." };
  }
  const client = await getClient(sb, clientId);
  if (!client || client.techId !== tech.id) return { ok: false, error: "Client not found" };

  const message = await createMessage(sb, { techId: tech.id, clientId, sender: "tech", body: text });

  let emailSent = false;
  let emailNote: string | undefined;
  if (!client.email?.trim()) {
    emailNote =
      "Saved in chat, but this client has no email on file. Share their private message link so they can see your reply.";
  } else {
    try {
      emailSent = await notifyClientOfMessage(client, tech, text);
      if (!emailSent) {
        emailNote = "Message saved, but the email notification could not be sent. Share their message link instead.";
      }
    } catch {
      emailNote = "Message saved, but the email notification failed. Share their message link instead.";
    }
  }

  revalidatePath("/dashboard/messages");
  revalidatePath(`/dashboard/messages/${clientId}`);

  return { ok: true, message, emailSent, emailNote };
}
