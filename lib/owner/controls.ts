/**
 * Kill switches (Phase 3.2) — enforced at send/execute layer, not UI-only.
 */

import { supabaseService } from "@/lib/supabase/service";
import { writeOwnerAudit, recordPlatformEvent } from "@/lib/owner/owner-audit-log";
import { cachedGet, cachedInvalidate } from "@/lib/owner/cache";

export type KillSwitchKey =
  | "allOutboundPaused"
  | "marketingOutboundPaused"
  | "cronPaused"
  | "signupsPaused"
  | "clientPaymentsPaused";

export type KillSwitchState = {
  key: KillSwitchKey;
  paused: boolean;
  pausedBy: string | null;
  pausedAt: string | null;
  pausedReason: string | null;
};

export const KILL_SWITCH_LABELS: Record<KillSwitchKey, string> = {
  allOutboundPaused: "Pause all client-facing email and SMS",
  marketingOutboundPaused: "Pause marketing / nudge messaging only",
  cronPaused: "Pause cron jobs",
  signupsPaused: "Pause new signups",
  clientPaymentsPaused: "Pause client online payments (emergency)",
};

const KEYS: KillSwitchKey[] = [
  "allOutboundPaused",
  "marketingOutboundPaused",
  "cronPaused",
  "signupsPaused",
  "clientPaymentsPaused",
];

const MARKETING_KINDS = new Set([
  "rebook_nudge",
  "onboarding_nudge",
  "waitlist_offer",
  "loyalty_reward",
  "owner_feedback_shipped",
  "worklist_nudge_setup_help",
  "worklist_nudge_go_live",
  "worklist_nudge_win_back",
  "worklist_nudge_trial_nudge",
  "owner_setup_help",
  "owner_go_live",
  "owner_win_back",
  "owner_trial_nudge",
  "owner_setup_help",
]);

/** Ops / recovery kinds that survive allOutboundPaused. */
const OUTBOUND_ALLOWLIST = new Set([
  "ops_error",
  "ops_account_email",
  "password_reset",
  "owner_signup_alert",
]);

export function isMarketingKind(kind: string | null | undefined): boolean {
  if (!kind) return false;
  if (MARKETING_KINDS.has(kind)) return true;
  if (kind.startsWith("owner_") && kind.includes("nudge")) return true;
  if (kind.startsWith("worklist_nudge")) return true;
  return false;
}

export function isOutboundAllowlisted(kind: string | null | undefined): boolean {
  return !!kind && OUTBOUND_ALLOWLIST.has(kind);
}

function parseSwitch(key: KillSwitchKey, value: unknown): KillSwitchState {
  const v = (value ?? {}) as {
    paused?: boolean;
    pausedBy?: string;
    pausedAt?: string;
    pausedReason?: string;
  };
  return {
    key,
    paused: !!v.paused,
    pausedBy: v.pausedBy ?? null,
    pausedAt: v.pausedAt ?? null,
    pausedReason: v.pausedReason ?? null,
  };
}

async function loadSwitchesUncached(): Promise<Record<KillSwitchKey, KillSwitchState>> {
  const sb = supabaseService();
  const { data } = await sb.from("owner_settings").select("key, value").in("key", KEYS);
  const out = {} as Record<KillSwitchKey, KillSwitchState>;
  for (const key of KEYS) out[key] = parseSwitch(key, null);
  for (const row of data ?? []) {
    if (KEYS.includes(row.key as KillSwitchKey)) {
      out[row.key as KillSwitchKey] = parseSwitch(row.key as KillSwitchKey, row.value);
    }
  }
  return out;
}

export async function getKillSwitches(): Promise<Record<KillSwitchKey, KillSwitchState>> {
  return cachedGet("owner:kill_switches", 15_000, loadSwitchesUncached);
}

export async function getKillSwitch(key: KillSwitchKey): Promise<KillSwitchState> {
  const all = await getKillSwitches();
  return all[key];
}

export async function anyKillSwitchActive(): Promise<KillSwitchState[]> {
  const all = await getKillSwitches();
  return KEYS.map((k) => all[k]).filter((s) => s.paused);
}

export async function setKillSwitch(opts: {
  key: KillSwitchKey;
  paused: boolean;
  byEmail: string;
  reason: string;
}): Promise<void> {
  const sb = supabaseService();
  const value = {
    paused: opts.paused,
    pausedBy: opts.byEmail,
    pausedAt: new Date().toISOString(),
    pausedReason: opts.reason.slice(0, 500),
  };
  await sb.from("owner_settings").upsert({
    key: opts.key,
    value,
    updatedAt: new Date().toISOString(),
    updatedByEmail: opts.byEmail,
  });
  cachedInvalidate("owner:kill_switches");
  await writeOwnerAudit({
    actorEmail: opts.byEmail,
    action: opts.paused ? `kill_switch_on_${opts.key}` : `kill_switch_off_${opts.key}`,
    metadata: { reason: opts.reason },
  });
  await recordPlatformEvent({
    type: "kill_switch",
    severity: opts.paused ? "warn" : "info",
    title: `${KILL_SWITCH_LABELS[opts.key]} — ${opts.paused ? "ON" : "OFF"}`,
    detail: { key: opts.key, reason: opts.reason, by: opts.byEmail },
  });
}

export async function setAccountOutboundPaused(opts: {
  techId: string;
  paused: boolean;
  byEmail: string;
  reason: string;
}): Promise<void> {
  const sb = supabaseService();
  await sb
    .from("techs")
    .update({
      outboundPausedAt: opts.paused ? new Date().toISOString() : null,
      outboundPausedReason: opts.paused ? opts.reason.slice(0, 500) : null,
    })
    .eq("id", opts.techId);
  await writeOwnerAudit({
    actorEmail: opts.byEmail,
    action: opts.paused ? "account_outbound_paused" : "account_outbound_resumed",
    targetType: "tech",
    targetId: opts.techId,
    metadata: { reason: opts.reason },
  });
  await recordPlatformEvent({
    type: "account_outbound_pause",
    techId: opts.techId,
    severity: "warn",
    title: opts.paused ? "Account outbound paused" : "Account outbound resumed",
    detail: { reason: opts.reason, by: opts.byEmail },
  });
}

/**
 * Returns a block reason if this send must not go to a provider.
 * Allowlisted ops/recovery kinds bypass the global pause.
 */
export async function outboundBlockReason(opts: {
  kind?: string | null;
  techId?: string | null;
}): Promise<string | null> {
  try {
    if (isOutboundAllowlisted(opts.kind)) return null;
    const switches = await getKillSwitches();
    if (switches.allOutboundPaused.paused) {
      return `allOutboundPaused: ${switches.allOutboundPaused.pausedReason || "paused"}`;
    }
    if (switches.marketingOutboundPaused.paused && isMarketingKind(opts.kind)) {
      return `marketingOutboundPaused: ${switches.marketingOutboundPaused.pausedReason || "paused"}`;
    }
    if (opts.techId) {
      const { data } = await supabaseService()
        .from("techs")
        .select("outboundPausedAt, outboundPausedReason")
        .eq("id", opts.techId)
        .maybeSingle();
      if (data?.outboundPausedAt) {
        return `accountOutboundPaused: ${data.outboundPausedReason || "paused"}`;
      }
    }
    return null;
  } catch {
    return null;
  }
}

export async function clientPaymentsPaused(): Promise<boolean> {
  try {
    return (await getKillSwitch("clientPaymentsPaused")).paused;
  } catch {
    return false;
  }
}

export async function signupsPaused(): Promise<boolean> {
  try {
    return (await getKillSwitch("signupsPaused")).paused;
  } catch {
    return false;
  }
}

export async function cronJobsPaused(): Promise<boolean> {
  try {
    return (await getKillSwitch("cronPaused")).paused;
  } catch {
    return false;
  }
}
