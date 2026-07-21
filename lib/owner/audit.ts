import { createAuditEvent } from "@/lib/db/queries";
import { supabaseService } from "@/lib/supabase/service";

/** Every state-changing owner action must call this. */
export async function ownerAudit(opts: {
  actorTechId: string;
  action: string;
  targetTechId?: string | null;
  entityType?: string;
  entityId?: string | null;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await createAuditEvent(supabaseService(), {
      techId: opts.actorTechId,
      actor: "tech",
      action: opts.action,
      entityType: opts.entityType ?? "tech",
      entityId: opts.entityId ?? opts.targetTechId ?? opts.actorTechId,
      metadata: {
        ...(opts.metadata ?? {}),
        ...(opts.targetTechId ? { targetTechId: opts.targetTechId } : {}),
        ...(opts.before ? { before: opts.before } : {}),
        ...(opts.after ? { after: opts.after } : {}),
        via: "owner_console",
      },
    });
  } catch {
    // Audit is best-effort but should almost never fail.
  }
}
