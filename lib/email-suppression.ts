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

export type AccountEmailHit = {
  kind: "tech" | "staff";
  techId: string;
  staffId?: string;
  email: string;
  label: string;
};

export type AccountDeliveryReason =
  | SuppressionReason
  | "restored_from_suppression";

const SOFT_BOUNCE_SUPPRESS_AFTER = 3;
const OPS_EMAIL = process.env.OPS_ALERT_EMAIL ?? "support@glow-uk.com";
const ACCOUNT_ALERT_WINDOW_MS = 15 * 60 * 1000;
const lastAccountAlert = new Map<string, number>();

/**
 * Extract a bare mailbox address from an RFC-style recipient string.
 * Handles `email@x.com`, `Name <email@x.com>`, and `"Name" <email@x.com>`.
 * Returns lowercase trimmed address, or "" if nothing usable.
 */
export function normaliseEmail(email: string): string {
  let s = String(email ?? "").trim();
  if (!s) return "";
  // Prefer the address inside the last pair of angle brackets.
  const angle = s.match(/<([^<>]+)>/);
  if (angle?.[1]) {
    s = angle[1].trim();
  } else {
    // Strip a trailing "(comment)" form sometimes seen in legacy headers.
    s = s.replace(/\s*\([^)]*\)\s*$/, "").trim();
  }
  // Drop surrounding quotes left on a bare address.
  s = s.replace(/^["']+|["']+$/g, "").trim();
  // If spaces remain (display name without brackets), take the last token with @.
  if (s.includes(" ") && s.includes("@")) {
    const token = s
      .split(/\s+/)
      .reverse()
      .find((t) => t.includes("@"));
    if (token) s = token.replace(/^["']+|["']+$/g, "").trim();
  }
  return s.toLowerCase();
}

/** Severity score for merging duplicate suppression rows (higher wins). */
export function suppressionSeverity(row: {
  suppressed?: boolean | null;
  permanent?: boolean | null;
  reason?: string | null;
  consecutiveSoftFailures?: number | null;
}): number {
  let score = 0;
  if (row.suppressed) score += 100;
  if (row.permanent) score += 50;
  if (row.reason === "complaint") score += 30;
  else if (row.reason === "hard_bounce") score += 20;
  else if (row.reason === "soft_bounce") score += 10;
  score += Math.min(Number(row.consecutiveSoftFailures ?? 0), 99);
  return score;
}

type MergeableSuppression = {
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

/**
 * Collapse rows that share the same normalised address into one canonical row.
 * Keeps the most severe state and the highest consecutive soft-failure count.
 */
export function mergeSuppressionDuplicates(
  rows: MergeableSuppression[],
): MergeableSuppression | null {
  if (!rows.length) return null;
  const normalised = rows.map((r) => ({
    ...r,
    email: normaliseEmail(r.email),
  }));
  const key = normalised[0].email;
  if (!key || normalised.some((r) => r.email !== key)) {
    throw new Error("mergeSuppressionDuplicates: rows must share one normalised email");
  }
  let best = normalised[0];
  for (let i = 1; i < normalised.length; i++) {
    const row = normalised[i];
    const bestScore = suppressionSeverity(best);
    const rowScore = suppressionSeverity(row);
    if (
      rowScore > bestScore ||
      (rowScore === bestScore && String(row.updatedAt) > String(best.updatedAt))
    ) {
      best = {
        ...row,
        consecutiveSoftFailures: Math.max(
          best.consecutiveSoftFailures,
          row.consecutiveSoftFailures,
        ),
        createdAt:
          !best.createdAt || (row.createdAt && row.createdAt < best.createdAt)
            ? row.createdAt
            : best.createdAt,
      };
    } else {
      best = {
        ...best,
        consecutiveSoftFailures: Math.max(
          best.consecutiveSoftFailures,
          row.consecutiveSoftFailures,
        ),
        createdAt:
          !best.createdAt || (row.createdAt && row.createdAt < best.createdAt)
            ? row.createdAt
            : best.createdAt,
        lastResendEmailId: best.lastResendEmailId ?? row.lastResendEmailId,
        lastOutboundId: best.lastOutboundId ?? row.lastOutboundId,
        lastEventType: best.lastEventType ?? row.lastEventType,
      };
    }
  }
  return { ...best, email: key };
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

/**
 * Find salon owner (tech) or staff login rows that own this address.
 * Suppression must never apply to these — transactional mail to the account
 * must keep attempting delivery.
 */
export async function findAccountEmailsByAddress(
  sb: SupabaseClient,
  email: string,
): Promise<AccountEmailHit[]> {
  const key = normaliseEmail(email);
  if (!key) return [];
  const hits: AccountEmailHit[] = [];

  const { data: techs } = await sb
    .from("techs")
    .select("id, email, businessName, name, handle")
    .ilike("email", key);
  for (const t of techs ?? []) {
    hits.push({
      kind: "tech",
      techId: String(t.id),
      email: key,
      label: String(t.businessName || t.name || t.handle || t.id),
    });
  }

  const { data: staff } = await sb
    .from("staff_members")
    .select("id, techId, email, name")
    .ilike("email", key);
  for (const s of staff ?? []) {
    hits.push({
      kind: "staff",
      techId: String(s.techId),
      staffId: String(s.id),
      email: key,
      label: String(s.name || s.id),
    });
  }

  return hits;
}

export async function isTechOrStaffEmail(
  sb: SupabaseClient,
  email: string,
): Promise<boolean> {
  const hits = await findAccountEmailsByAddress(sb, email);
  return hits.length > 0;
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

/**
 * Force-clear a suppression row (including permanent). Used when an account
 * address was wrongly suppressed — permanent lock must not block restore.
 */
export async function clearEmailSuppression(
  sb: SupabaseClient,
  email: string,
  lastEventType = "account_unsuppress",
): Promise<void> {
  const key = normaliseEmail(email);
  if (!key) return;
  const now = new Date().toISOString();
  const existing = await getEmailSuppression(sb, key);
  await sb.from("email_suppressions").upsert({
    email: key,
    suppressed: false,
    permanent: false,
    reason: null,
    consecutiveSoftFailures: 0,
    lastEventType,
    lastResendEmailId: existing?.lastResendEmailId ?? null,
    lastOutboundId: existing?.lastOutboundId ?? null,
    updatedAt: now,
    ...(existing ? {} : { createdAt: now }),
  });
}

/** True when sends to this address must be skipped. Account emails never skip. */
export async function isEmailSuppressed(sb: SupabaseClient, email: string): Promise<boolean> {
  const key = normaliseEmail(email);
  if (!key) return false;

  const hits = await findAccountEmailsByAddress(sb, key);
  if (hits.length > 0) {
    const row = await getEmailSuppression(sb, key);
    if (row?.suppressed) {
      // Defensive restore: never leave a tech/staff address on the list.
      await restoreSuppressedAccountEmail(sb, key, hits, { alert: true });
    }
    return false;
  }

  const row = await getEmailSuppression(sb, key);
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
  // Once permanently suppressed, never clear (client addresses only — account
  // restores use clearEmailSuppression which bypasses this).
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

export async function flagAccountEmailDeliveryIssue(
  sb: SupabaseClient,
  hits: AccountEmailHit[],
  reason: AccountDeliveryReason,
): Promise<void> {
  const now = new Date().toISOString();
  for (const hit of hits) {
    const patch = {
      emailDeliveryIssue: true,
      emailDeliveryIssueReason: reason,
      emailDeliveryIssueAt: now,
    };
    if (hit.kind === "tech") {
      await sb.from("techs").update(patch).eq("id", hit.techId);
    } else if (hit.staffId) {
      await sb.from("staff_members").update(patch).eq("id", hit.staffId);
    }
  }
}

async function alertOpsAccountEmailIssue(opts: {
  email: string;
  reason: AccountDeliveryReason;
  hits: AccountEmailHit[];
  event: string;
  force?: boolean;
}): Promise<void> {
  const signature = `account-email:${opts.email}:${opts.reason}`;
  const now = Date.now();
  if (!opts.force) {
    const last = lastAccountAlert.get(signature) ?? 0;
    if (now - last < ACCOUNT_ALERT_WINDOW_MS) return;
  }
  lastAccountAlert.set(signature, now);

  const lines = [
    `Account email delivery issue (NOT suppressed)`,
    `Email: ${opts.email}`,
    `Reason: ${opts.reason}`,
    `Event: ${opts.event}`,
    `Accounts:`,
    ...opts.hits.map(
      (h) =>
        `  - ${h.kind} techId=${h.techId}` +
        (h.staffId ? ` staffId=${h.staffId}` : "") +
        ` (${h.label})`,
    ),
    ``,
    `Glow will keep attempting delivery to this address.`,
    `Please investigate with the salon owner.`,
  ];
  const body = lines.join("\n");

  try {
    const { sendEmail } = await import("@/lib/email");
    await sendEmail({
      to: OPS_EMAIL,
      subject: `[Glow] Account email delivery issue: ${opts.email}`,
      html: `<pre style="font-family:monospace;white-space:pre-wrap">${escapeHtml(body)}</pre>`,
      text: body,
      kind: "ops_account_email",
      techId: opts.hits[0]?.techId ?? null,
    });
  } catch (err) {
    console.error("[email-suppression] ops alert failed:", (err as Error).message);
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Flag account + alert ops. Never writes a suppression row.
 * Also clears any existing suppression for this address.
 */
export async function protectAccountEmailEvent(
  sb: SupabaseClient,
  opts: {
    email: string;
    reason: SuppressionReason;
    event: string;
    hits: AccountEmailHit[];
  },
): Promise<{ suppressed: false; accountProtected: true; accountHits: AccountEmailHit[] }> {
  const key = normaliseEmail(opts.email);
  const existing = await getEmailSuppression(sb, key);
  if (existing?.suppressed) {
    await clearEmailSuppression(sb, key, "account_unsuppress");
  }
  await flagAccountEmailDeliveryIssue(sb, opts.hits, opts.reason);
  await alertOpsAccountEmailIssue({
    email: key,
    reason: opts.reason,
    hits: opts.hits,
    event: opts.event,
  });
  return { suppressed: false, accountProtected: true, accountHits: opts.hits };
}

/** Unsuppress a wrongly listed account address, flag, and alert ops. */
export async function restoreSuppressedAccountEmail(
  sb: SupabaseClient,
  email: string,
  hits: AccountEmailHit[],
  opts?: { alert?: boolean },
): Promise<void> {
  const key = normaliseEmail(email);
  await clearEmailSuppression(sb, key, "account_unsuppress");
  // Clear denormalised client flags if the same address was mirrored.
  await syncClientEmailFlags(sb, key, {
    emailSuppressed: false,
    emailSuppressionReason: null,
    emailSoftBounceCount: 0,
  });
  await flagAccountEmailDeliveryIssue(sb, hits, "restored_from_suppression");
  if (opts?.alert !== false) {
    await alertOpsAccountEmailIssue({
      email: key,
      reason: "restored_from_suppression",
      hits,
      event: "reconcile_suppressed_account_email",
      force: true,
    });
  }
}

/**
 * Scan suppressions for any tech/staff addresses and restore them.
 * Safe to call from cron; alerts ops for each restored address.
 */
export async function reconcileSuppressedAccountEmails(
  sb: SupabaseClient,
): Promise<{ restored: string[] }> {
  const restored: string[] = [];
  const { data: rows, error } = await sb
    .from("email_suppressions")
    .select("email")
    .eq("suppressed", true);
  if (error || !rows?.length) return { restored };

  for (const row of rows) {
    const email = normaliseEmail(String(row.email ?? ""));
    if (!email) continue;
    const hits = await findAccountEmailsByAddress(sb, email);
    if (!hits.length) continue;
    await restoreSuppressedAccountEmail(sb, email, hits, { alert: true });
    restored.push(email);
  }
  return { restored };
}

/** Complaint: permanent suppress + marketing opt-out on matching clients. */
export async function applyComplaint(
  sb: SupabaseClient,
  opts: {
    email: string;
    resendEmailId?: string | null;
    outboundId?: string | null;
  },
): Promise<{
  suppression: EmailSuppression | null;
  suppressed: boolean;
  accountProtected: boolean;
  accountHits: AccountEmailHit[];
}> {
  const hits = await findAccountEmailsByAddress(sb, opts.email);
  if (hits.length > 0) {
    await protectAccountEmailEvent(sb, {
      email: opts.email,
      reason: "complaint",
      event: "email.complained",
      hits,
    });
    return {
      suppression: null,
      suppressed: false,
      accountProtected: true,
      accountHits: hits,
    };
  }

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

  return {
    suppression,
    suppressed: true,
    accountProtected: false,
    accountHits: [],
  };
}

export async function applyHardBounce(
  sb: SupabaseClient,
  opts: {
    email: string;
    resendEmailId?: string | null;
    outboundId?: string | null;
  },
): Promise<{
  suppression: EmailSuppression | null;
  suppressed: boolean;
  accountProtected: boolean;
  accountHits: AccountEmailHit[];
}> {
  const hits = await findAccountEmailsByAddress(sb, opts.email);
  if (hits.length > 0) {
    await protectAccountEmailEvent(sb, {
      email: opts.email,
      reason: "hard_bounce",
      event: "email.bounced",
      hits,
    });
    return {
      suppression: null,
      suppressed: false,
      accountProtected: true,
      accountHits: hits,
    };
  }

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
  return {
    suppression,
    suppressed: true,
    accountProtected: false,
    accountHits: [],
  };
}

export async function applySoftBounce(
  sb: SupabaseClient,
  opts: {
    email: string;
    resendEmailId?: string | null;
    outboundId?: string | null;
  },
): Promise<{
  suppression: EmailSuppression | null;
  newlySuppressed: boolean;
  suppressed: boolean;
  accountProtected: boolean;
  accountHits: AccountEmailHit[];
}> {
  const hits = await findAccountEmailsByAddress(sb, opts.email);
  if (hits.length > 0) {
    await protectAccountEmailEvent(sb, {
      email: opts.email,
      reason: "soft_bounce",
      event: "email.bounced",
      hits,
    });
    return {
      suppression: null,
      newlySuppressed: false,
      suppressed: false,
      accountProtected: true,
      accountHits: hits,
    };
  }

  const existing = await getEmailSuppression(sb, opts.email);
  if (existing?.permanent && existing.suppressed) {
    await syncClientEmailFlags(sb, opts.email, {
      emailSuppressed: true,
      emailSuppressionReason: existing.reason,
      emailSoftBounceCount: existing.consecutiveSoftFailures,
    });
    return {
      suppression: existing,
      newlySuppressed: false,
      suppressed: true,
      accountProtected: false,
      accountHits: [],
    };
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
  return {
    suppression,
    newlySuppressed,
    suppressed: suppression.suppressed,
    accountProtected: false,
    accountHits: [],
  };
}

/** Update outbound_sends delivery fields by Resend email id (best-effort).
 * Falls back to matching a normalised destination when the Resend id is missing
 * or no row has that id yet (e.g. older sends).
 */
export async function markOutboundDelivery(
  sb: SupabaseClient,
  opts: {
    resendEmailId: string;
    deliveryStatus: string;
    bounceType?: string | null;
    error?: string | null;
    destination?: string | null;
  },
): Promise<{ id: string } | null> {
  const patch = {
    deliveryStatus: opts.deliveryStatus,
    bounceType: opts.bounceType ?? null,
    deliveryUpdatedAt: new Date().toISOString(),
    ...(opts.error ? { error: opts.error } : {}),
  };

  if (opts.resendEmailId) {
    const { data, error } = await sb
      .from("outbound_sends")
      .update(patch)
      .eq("resendEmailId", opts.resendEmailId)
      .select("id")
      .maybeSingle();
    if (!error && data) return { id: String((data as { id: string }).id) };
  }

  const dest = normaliseEmail(opts.destination ?? "");
  if (!dest) return null;

  // Destination is stored as a bare lowercase address. Find the latest send.
  const { data: rows, error: findErr } = await sb
    .from("outbound_sends")
    .select("id")
    .eq("channel", "email")
    .eq("destination", dest)
    .order("createdAt", { ascending: false })
    .limit(1);
  if (findErr || !rows?.length) return null;
  const id = String((rows[0] as { id: string }).id);
  const { data, error } = await sb
    .from("outbound_sends")
    .update(patch)
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error || !data) return null;
  return { id: String((data as { id: string }).id) };
}
