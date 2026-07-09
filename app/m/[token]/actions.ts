"use server";

import { supabaseService } from "@/lib/supabase/service";
import { createMessage, getClientByMessageToken, getTechById } from "@/lib/db/queries";
import { notifyTechOfMessage } from "@/lib/notify";
import { isLive } from "@/lib/subscriptions";
import { rateLimit } from "@/lib/rate-limit";
import type { Message } from "@/lib/db/types";

type SendResult = { ok: boolean; message?: Message; error?: string };

/** Client (no login) sends a message via their private token (bound in the page). */
export async function sendClientMessageAction(token: string, body: string): Promise<SendResult> {
  const text = body.trim();
  if (!text) return { ok: false, error: "Message is empty" };
  if (!(await rateLimit("client-message", { limit: 20, windowMinutes: 10 }))) {
    return { ok: false, error: "Too many messages - give it a few minutes." };
  }
  const sb = supabaseService();
  const client = await getClientByMessageToken(sb, token);
  if (!client) return { ok: false, error: "Conversation not found" };
  const tech = await getTechById(sb, client.techId);
  if (!tech || !isLive(tech)) {
    return { ok: false, error: "This studio isn't accepting messages right now." };
  }
  const message = await createMessage(sb, {
    techId: client.techId,
    clientId: client.id,
    sender: "client",
    body: text,
  });
  try {
    await notifyTechOfMessage(tech, client, text, message.id);
  } catch {
    // Email is best-effort; the in-app message is already saved.
  }
  return { ok: true, message };
}
