import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createReactionCheckin,
  getReactionCheckin,
  getReactionCheckinByToken,
  updateReactionCheckin,
} from "@/lib/db/queries";
import { notifyClientOfReactionCheckin, notifyTechOfReactionReport } from "@/lib/notify";
import { recordClientReaction } from "@/lib/product-batches";
import { randomToken } from "@/lib/ids";
import type { ReactionCheckin } from "@/lib/db/types";

const HOUR = 60 * 60 * 1000;
const CHECKIN_DELAY_MS = 48 * HOUR;

export type ScheduleCheckinInput = {
  techId: string;
  clientId: string;
  categoryId: string;
  anchorIso: string;
  patchTestId?: string | null;
  bookingId?: string | null;
};

/** Schedule a 48-hour reaction check-in if the send time is still in the future. */
export async function scheduleReactionCheckin(
  sb: SupabaseClient,
  input: ScheduleCheckinInput,
): Promise<ReactionCheckin | null> {
  const sendAt = new Date(new Date(input.anchorIso).getTime() + CHECKIN_DELAY_MS);
  if (sendAt.getTime() <= Date.now()) return null;

  if (input.patchTestId) {
    const { data } = await sb
      .from("reaction_checkins")
      .select("id")
      .eq("patchTestId", input.patchTestId)
      .maybeSingle();
    if (data) return null;
  }
  if (input.bookingId) {
    const { data } = await sb
      .from("reaction_checkins")
      .select("id")
      .eq("bookingId", input.bookingId)
      .maybeSingle();
    if (data) return null;
  }

  return createReactionCheckin(sb, {
    techId: input.techId,
    clientId: input.clientId,
    categoryId: input.categoryId,
    patchTestId: input.patchTestId ?? null,
    bookingId: input.bookingId ?? null,
    token: randomToken(),
    sendAtIso: sendAt.toISOString(),
    sentAtIso: null,
    status: "scheduled",
    response: null,
    symptoms: "",
    reactionId: null,
  });
}

/** Send due check-in emails/SMS and mark as sent. */
export async function sendReactionCheckin(
  sb: SupabaseClient,
  checkin: ReactionCheckin,
): Promise<boolean> {
  if (checkin.status !== "scheduled") return false;
  const sent = await notifyClientOfReactionCheckin(sb, checkin);
  if (!sent) {
    await updateReactionCheckin(sb, checkin.id, { status: "skipped" });
    return false;
  }
  await updateReactionCheckin(sb, checkin.id, {
    status: "sent",
    sentAtIso: new Date().toISOString(),
  });
  return true;
}

/** Process client response from the public check-in page. */
export async function submitReactionCheckinResponse(
  sb: SupabaseClient,
  token: string,
  response: "fine" | "reaction",
  symptoms: string,
): Promise<{ ok: boolean; error?: string }> {
  const checkin = await getReactionCheckinByToken(sb, token);
  if (!checkin) return { ok: false, error: "not_found" };
  if (checkin.status === "responded") return { ok: true };
  if (checkin.status === "skipped") return { ok: false, error: "expired" };

  const nowIso = new Date().toISOString();

  if (response === "fine") {
    await updateReactionCheckin(sb, checkin.id, {
      status: "responded",
      response: "fine",
      symptoms: "",
    });
    return { ok: true };
  }

  const reaction = await recordClientReaction(sb, checkin.techId, {
    clientId: checkin.clientId,
    categoryId: checkin.categoryId,
    severity: "moderate",
    symptoms: symptoms.trim() || "Reported via 48-hour check-in",
    onsetIso: nowIso,
    patchTestId: checkin.patchTestId,
    bookingId: checkin.bookingId,
    notes: "Client reported via automated 48-hour check-in",
  });

  await updateReactionCheckin(sb, checkin.id, {
    status: "responded",
    response: "reaction",
    symptoms: symptoms.trim(),
    reactionId: reaction.id,
  });

  await notifyTechOfReactionReport(sb, checkin, reaction.symptoms);

  return { ok: true };
}

/** Cron: send all due check-ins. */
export async function processDueReactionCheckins(
  sb: SupabaseClient,
  nowIso = new Date().toISOString(),
): Promise<{ sent: number; skipped: number }> {
  const { dueReactionCheckins } = await import("@/lib/db/queries");
  const due = await dueReactionCheckins(sb, nowIso);
  let sent = 0;
  let skipped = 0;

  for (const checkin of due) {
    const ok = await sendReactionCheckin(sb, checkin);
    if (ok) sent++;
    else skipped++;
  }

  return { sent, skipped };
}

/** Skip a pending check-in (e.g. client already recorded a reaction manually). */
export async function skipReactionCheckin(sb: SupabaseClient, id: string): Promise<void> {
  const row = await getReactionCheckin(sb, id);
  if (!row || row.status !== "scheduled") return;
  await updateReactionCheckin(sb, id, { status: "skipped" });
}
