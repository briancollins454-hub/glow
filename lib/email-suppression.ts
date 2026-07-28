import type { SupabaseClient } from "@supabase/supabase-js";

export type SuppressionReason = "hard_bounce" | "soft_bounce" | "complaint";

export type EmailSuppression = {
  email: string;
  suppressed: boolean;
  permanent: boolean;
  reason: SuppressionReason | null;
  consecutiveSoftFailures: number;
  lastEventType: string | null;
  lastResendEmailId: string | null;
  lastOutboundId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SoftBounceDecision =
  | { action: "count"; consecutiveSoftFailures: number; suppressed: false }
  | {
      action: "suppress";
      consecutiveSoftFailures: number;
      suppressed: true;
      reason: "soft_bounce";
    };

const SOFT_BOUNCE_SUPPRESS_AFTER = 3;

/** Normalise for suppression keys and lookups. */
export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Pure soft-bounce counter. Permanent suppressions are never downgraded here.
 * After SOFT_BOUNCE_SUPPRESS_AFTER consecutive soft failures → suppress.
 */
export function applySoftBounceCount(
  current: { consecutiveSoftFailures: number; suppressed: boolean; permanent: boolean },
): SoftBounceDecision {
  if (current.suppressed && current.permanent) {
    return {
      action: "suppress",
      consecutiveSoftFailures: current.consecutiveSoftFailures,
      suppressed: true,
      reason: "soft_bounce",
    };
  }
  const next = (current.consecutiveSoftFailures || 0) + 1;
  if (next >= SOFT_BOUNCE_SUPPRESS_AFTER) {
    return {
      action: "suppress",
      consecutiveSoftFailures: next,
      suppressed: true,
      reason: "soft_bounce",
    };
  }
  return { action: "count", consecutiveSoftFailures: next, suppressed: false };
}

export function isHardBounceType(bounceType: string | null | undefined): boolean {
  const t = (bounceType ?? "").toLowerCase();
  return t === "permanent" || t === "hard";
}

export function isSoftBounceType(bounceType: string | null | undefined): boolean {
  const t = (bounceType ?? "").toLowerCase();
  return t === "transient" || t === "temporary" || t === "undetermined" || t === "soft";
}

/** Missing type on email.bounced defaults to hard (safer for deliverability). */
export function classifyBounce(
  bounceType: string | null | undefined,
): "hard" | "soft" {
  if (isSoftBounceType(bounceType)) return "soft";
  return "hard";
}

function mapRow(row: Record<string, unknown>): EmailSuppression {
  return {
    email: String(row.email ?? ""),
    suppressed: !!row.suppressed,
    permanent: !!row.permanent,
    reason: (row.reason as SuppressionReason | null) ?? null,
    consecutiveSoftFailures: Number(row.consecutiveSoftFailures ?? 0),
    lastEventType: (row.lastEventType as string | null) ?? null,
    lastResendEmailId: (row.lastResendEmailId as string | null) ?? null,
    lastOutboundId: (row.lastOutboundId as string | null) ?? null,
    createdAt: String(row.createdAt ?? ""),
    updatedAt: String(row.updatedAt ?? ""),
  };
}

export async function getEmailSuppression(
  sb: SupabaseClient,
  email: string,
): Promise<EmailSuppression | null> {
  const key = normaliseEmail(email);
  if (!key) return null;
  const { data, error } = await sb.from("email_suppressions").select("*").eq("email", key).maybeSingle();
  if (error || !data) return null;
  return mapRow(data as Record<string, unknown>);
}

/** True when sends to this address must be skipped. */
export async function isEmailSuppressed(sb: SupabaseClient, email: string): Promise<boolean> {
  const row = await getEmailSuppression(sb, email);
  return !!row?.suppressed;
}

async function upsertSuppression(
  sb: SupabaseClient,
  patch: {
    email: string;
    suppressed: boolean;
    permanent: boolean;
    reason: SuppressionReason | null;
    consecutiveSoftFailures: number;
    lastEventType: string;
    lastResendEmailId?: string | null;
    lastOutboundId?: string | null;
  },
): Promise<EmailSuppression> {
  const now = new Date().toISOString();
  const existing = await getEmailSuppression(sb, patch.email);
  const row = {
    email: normaliseEmail(patch.email),
    suppressed: patch.suppressed,
    permanent: patch.permanent || !!existing?.permanent,
    reason: patch.reason ?? existing?.reason ?? null,
    consecutiveSoftFailures: patch.consecutiveSoftFailures,
    lastEventType: patch.lastEventType,
    lastResendEmailId: patch.lastResendEmailId ?? existing?.lastResendEmailId ?? null,
    lastOutboundId: patch.lastOutboundId ?? existing?.lastOutboundId ?? null,
    updatedAt: now,
    ...(existing ? {} : { createdAt: now }),
  };
  // Once permanently suppressed, never clear.
  if (existing?.permanent) {
    row.suppressed = true;
    row.permanent = true;
    row.reason = existing.reason ?? patch.reason;
  }
  const { data, error } = await sb.from("email_suppressions").upsert(row).select("*").single();
  if (error) throw error;
  return mapRow(data as Record<string, unknown>);
}

/** Sync denormalised bounce flags onto every client row with this email. */
export async function syncClientEmailFlags(
  sb: SupabaseClient,
  email: string,
  flags: {
    emailSuppressed: boolean;
    emailSuppressionReason: SuppressionReason | null;
    emailSoftBounceCount: number;
  },
): Promise<void> {
  const key = normaliseEmail(email);
  if (!key) return;
  await sb
    .from("clients")
    .update({
      emailSuppressed: flags.emailSuppressed,
      emailSuppressionReason: flags.emailSuppressionReason,
      emailSoftBounceCount: flags.emailSoftBounceCount,
      emailLastDeliveryEventAt: new Date().toISOString(),
    })
    .eq("email", key);
}

/** Complaint: permanent suppress + marketing opt-out on matching clients. */
export async function applyComplaint(
  sb: SupabaseClient,
  opts: {
    email: string;
    resendEmailId?: string | null;
    outboundId?: string | null;
  },
): Promise<EmailSuppression> {
  const suppression = await upsertSuppression(sb, {
    email: opts.email,
    suppressed: true,
    permanent: true,
    reason: "complaint",
    consecutiveSoftFailures: 0,
    lastEventType: "email.complained",
    lastResendEmailId: opts.resendEmailId,
    lastOutboundId: opts.outboundId,
  });
  const key = normaliseEmail(opts.email);
  await sb
    .from("clients")
    .update({
      marketingOptOut: true,
      emailSuppressed: true,
      emailSuppressionReason: "complaint",
      emailSoftBounceCount: 0,
      emailLastDeliveryEventAt: new Date().toISOString(),
    })
    .eq("email", key);

  // Best-effort audit for each matching client.
  try {
    const { createAuditEvent } = await import("@/lib/db/queries");
    const { data: clients } = await sb.from("clients").select("id, techId").eq("email", key);
    for (const c of clients ?? []) {
      await createAuditEvent(sb, {
        techId: c.techId,
        actor: "system",
        action: "marketing_opt_out",
        entityType: "client",
        entityId: c.id,
        metadata: { source: "resend_complaint", email: key },
      }).catch(() => undefined);
    }
  } catch {
    // Audit is best-effort.
  }

  return suppression;
}

export async function applyHardBounce(
  sb: SupabaseClient,
  opts: {
    email: string;
    resendEmailId?: string | null;
    outboundId?: string | null;
  },
): Promise<EmailSuppression> {
  const suppression = await upsertSuppression(sb, {
    email: opts.email,
    suppressed: true,
    permanent: true,
    reason: "hard_bounce",
    consecutiveSoftFailures: 0,
    lastEventType: "email.bounced",
    lastResendEmailId: opts.resendEmailId,
    lastOutboundId: opts.outboundId,
  });
  await syncClientEmailFlags(sb, opts.email, {
    emailSuppressed: true,
    emailSuppressionReason: "hard_bounce",
    emailSoftBounceCount: 0,
  });
  return suppression;
}

export async function applySoftBounce(
  sb: SupabaseClient,
  opts: {
    email: string;
    resendEmailId?: string | null;
    outboundId?: string | null;
  },
): Promise<{ suppression: EmailSuppression; newlySuppressed: boolean }> {
  const existing = await getEmailSuppression(sb, opts.email);
  if (existing?.permanent && existing.suppressed) {
    await syncClientEmailFlags(sb, opts.email, {
      emailSuppressed: true,
      emailSuppressionReason: existing.reason,
      emailSoftBounceCount: existing.consecutiveSoftFailures,
    });
    return { suppression: existing, newlySuppressed: false };
  }
  const decision = applySoftBounceCount({
    consecutiveSoftFailures: existing?.consecutiveSoftFailures ?? 0,
    suppressed: !!existing?.suppressed,
    permanent: !!existing?.permanent,
  });
  const newlySuppressed = decision.action === "suppress" && !existing?.suppressed;
  const suppression = await upsertSuppression(sb, {
    email: opts.email,
    suppressed: decision.suppressed,
    permanent: decision.action === "suppress",
    reason: decision.action === "suppress" ? "soft_bounce" : existing?.reason ?? null,
    consecutiveSoftFailures: decision.consecutiveSoftFailures,
    lastEventType: "email.bounced",
    lastResendEmailId: opts.resendEmailId,
    lastOutboundId: opts.outboundId,
  });
  await syncClientEmailFlags(sb, opts.email, {
    emailSuppressed: suppression.suppressed,
    emailSuppressionReason: suppression.reason,
    emailSoftBounceCount: suppression.consecutiveSoftFailures,
  });
  return { suppression, newlySuppressed };
}

/** Update outbound_sends delivery fields by Resend email id (best-effort). */
export async function markOutboundDelivery(
  sb: SupabaseClient,
  opts: {
    resendEmailId: string;
    deliveryStatus: string;
    bounceType?: string | null;
    error?: string | null;
  },
): Promise<{ id: string } | null> {
  if (!opts.resendEmailId) return null;
  const { data, error } = await sb
    .from("outbound_sends")
    .update({
      deliveryStatus: opts.deliveryStatus,
      bounceType: opts.bounceType ?? null,
      deliveryUpdatedAt: new Date().toISOString(),
      ...(opts.error ? { error: opts.error } : {}),
    })
    .eq("resendEmailId", opts.resendEmailId)
    .select("id")
    .maybeSingle();
  if (error || !data) return null;
  return { id: String((data as { id: string }).id) };
}
