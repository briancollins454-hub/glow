import { cookies } from "next/headers";
import { randomId } from "@/lib/ids";
import { supabaseService } from "@/lib/supabase/service";
import { writeOwnerAudit } from "@/lib/owner/owner-audit-log";
import { rateLimit } from "@/lib/rate-limit";
import type { Tech } from "@/lib/db/types";

export const VIEW_AS_COOKIE = "glow_view_as";
const SESSION_TTL_MS = 30 * 60 * 1000;

export type ViewAsSession = {
  id: string;
  ownerEmail: string;
  techId: string;
  startedAt: string;
  endedAt: string | null;
  expiresAt: string;
  readOnly: boolean;
};

export async function startViewAsSession(opts: {
  ownerEmail: string;
  target: Tech;
}): Promise<ViewAsSession> {
  const rl = await rateLimit(`view-as:${opts.ownerEmail}`, { limit: 20, windowMinutes: 60 });
  if (!rl.ok) throw new Error("View-as rate limit exceeded (20/hour)");

  const sb = supabaseService();
  // End any open sessions for this owner.
  await sb
    .from("impersonation_sessions")
    .update({ endedAt: new Date().toISOString() })
    .eq("ownerEmail", opts.ownerEmail.trim().toLowerCase())
    .is("endedAt", null);

  const now = Date.now();
  const row: ViewAsSession = {
    id: randomId("vas"),
    ownerEmail: opts.ownerEmail.trim().toLowerCase(),
    techId: opts.target.id,
    startedAt: new Date(now).toISOString(),
    endedAt: null,
    expiresAt: new Date(now + SESSION_TTL_MS).toISOString(),
    readOnly: true,
  };
  const { error } = await sb.from("impersonation_sessions").insert(row);
  if (error) throw new Error(error.message);

  const jar = await cookies();
  jar.set(VIEW_AS_COOKIE, row.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });

  await writeOwnerAudit({
    actorEmail: opts.ownerEmail,
    action: "view_as_started",
    targetType: "tech",
    targetId: opts.target.id,
    metadata: { sessionId: row.id, handle: opts.target.handle },
  });

  return row;
}

export async function endViewAsSession(ownerEmail: string): Promise<void> {
  const jar = await cookies();
  const sessionId = jar.get(VIEW_AS_COOKIE)?.value;
  jar.delete(VIEW_AS_COOKIE);
  if (!sessionId) return;
  const sb = supabaseService();
  const { data } = await sb
    .from("impersonation_sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle();
  if (data && !data.endedAt) {
    await sb
      .from("impersonation_sessions")
      .update({ endedAt: new Date().toISOString() })
      .eq("id", sessionId);
    await writeOwnerAudit({
      actorEmail: ownerEmail,
      action: "view_as_ended",
      targetType: "tech",
      targetId: data.techId,
      metadata: { sessionId },
    });
  }
}

export async function getActiveViewAsSession(): Promise<ViewAsSession | null> {
  const jar = await cookies();
  const sessionId = jar.get(VIEW_AS_COOKIE)?.value;
  if (!sessionId) return null;
  const sb = supabaseService();
  const { data } = await sb
    .from("impersonation_sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle();
  if (!data || data.endedAt) return null;
  if (new Date(data.expiresAt).getTime() <= Date.now()) {
    await sb
      .from("impersonation_sessions")
      .update({ endedAt: new Date().toISOString() })
      .eq("id", sessionId);
    jar.delete(VIEW_AS_COOKIE);
    return null;
  }
  return data as ViewAsSession;
}

/**
 * Paths allowed to POST while view-as is active (exit only).
 * Everything else must be rejected — hiding UI is insufficient.
 */
export const VIEW_AS_POST_ALLOWLIST = [
  "/dashboard/admin/accounts/view-as-exit",
  "/dashboard/admin/accounts/", // exit action via form under account id — narrowed below
] as const;

export function isViewAsPostAllowed(pathname: string): boolean {
  if (pathname === "/dashboard/admin/accounts/view-as-exit") return true;
  if (pathname.endsWith("/view-as-exit")) return true;
  // Server action for endViewAs — Next posts to the page URL; allow exit action route only.
  if (pathname.includes("/view-as") && pathname.includes("exit")) return true;
  return false;
}

export class ViewAsMutationBlockedError extends Error {
  constructor() {
    super("Read-only view-as session: mutations are blocked");
    this.name = "ViewAsMutationBlockedError";
  }
}

/** Call at the top of any mutating server action. */
export async function assertNotViewAs(): Promise<void> {
  const session = await getActiveViewAsSession();
  if (session) throw new ViewAsMutationBlockedError();
}
