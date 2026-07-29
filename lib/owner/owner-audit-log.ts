import { randomId } from "@/lib/ids";
import { supabaseService } from "@/lib/supabase/service";

/** Immutable platform-owner audit (separate from per-tech audit_events). */
export async function writeOwnerAudit(opts: {
  actorEmail: string;
  action: string;
  targetType?: string;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await supabaseService().from("owner_audit").insert({
      id: randomId("oaud"),
      actorEmail: opts.actorEmail.trim().toLowerCase(),
      action: opts.action,
      targetType: opts.targetType ?? "tech",
      targetId: opts.targetId ?? null,
      metadata: opts.metadata ?? {},
      createdAt: new Date().toISOString(),
    });
  } catch {
    // best-effort
  }
}

export async function recordPlatformEvent(opts: {
  type: string;
  techId?: string | null;
  severity?: "info" | "warn" | "error";
  title: string;
  detail?: Record<string, unknown>;
}): Promise<void> {
  try {
    await supabaseService().from("platform_events").insert({
      id: randomId("pevt"),
      type: opts.type,
      techId: opts.techId ?? null,
      severity: opts.severity ?? "info",
      title: opts.title,
      detail: opts.detail ?? {},
      createdAt: new Date().toISOString(),
    });
  } catch {
    // best-effort
  }
}
