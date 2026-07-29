import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/owner/require-owner";
import { assertNotViewAs } from "@/lib/owner/view-as";
import { listOwnerAudit } from "@/lib/owner/audit-export";
import { writeOwnerAudit } from "@/lib/owner/owner-audit-log";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { tech: admin } = await requireOwner();
  await assertNotViewAs();
  const url = new URL(req.url);
  const rows = await listOwnerAudit({
    q: url.searchParams.get("q") || undefined,
    action: url.searchParams.get("action") || undefined,
    targetId: url.searchParams.get("targetId") || undefined,
    limit: 2000,
  });
  await writeOwnerAudit({
    actorEmail: admin.email,
    action: "owner_audit_export",
    metadata: { count: rows.length },
  });

  return new NextResponse(JSON.stringify({ exportedAt: new Date().toISOString(), rows }, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="glow-owner-audit.json"`,
      "Cache-Control": "no-store",
    },
  });
}
