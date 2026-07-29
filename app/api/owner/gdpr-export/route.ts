import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/owner/require-owner";
import { assertNotViewAs } from "@/lib/owner/view-as";
import { buildAccountGdprExport } from "@/lib/owner/gdpr";
import { writeOwnerAudit } from "@/lib/owner/owner-audit-log";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { tech: admin } = await requireOwner();
  await assertNotViewAs();
  const url = new URL(req.url);
  const techId = url.searchParams.get("techId")?.trim();
  if (!techId) {
    return NextResponse.json({ error: "techId required" }, { status: 400 });
  }

  const payload = await buildAccountGdprExport(techId);
  await writeOwnerAudit({
    actorEmail: admin.email,
    action: "gdpr_export",
    targetType: "tech",
    targetId: techId,
    metadata: {
      clients: payload.clients.length,
      bookings: payload.bookings.length,
    },
  });

  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="glow-gdpr-${techId}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
