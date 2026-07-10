import { NextResponse } from "next/server";
import { getDashboardContext, invalidateDashboardTech } from "@/lib/auth/session";
import { createAuditEvent, getTechById } from "@/lib/db/queries";
import { googleConnected, syncUpcomingBookingsToGoogle } from "@/lib/google-calendar";

export async function POST() {
  const c = await getDashboardContext();
  if (!c) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const tech = (await getTechById(c.sb, c.tech.id)) ?? c.tech;
  if (!googleConnected(tech)) {
    return NextResponse.json({ error: "not_connected" }, { status: 400 });
  }

  try {
    const result = await syncUpcomingBookingsToGoogle(c.sb, tech);
    try {
      await createAuditEvent(c.sb, {
        techId: tech.id,
        actor: "tech",
        action: "google_calendar_sync",
        entityType: "tech",
        entityId: tech.id,
        metadata: result,
      });
    } catch {
      // Audit must not block sync.
    }
    invalidateDashboardTech(c.tech.authUserId);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "sync_failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
