import { getDashboardContext } from "@/lib/auth/session";
import { createAuditEvent } from "@/lib/db/queries";
import {
  buildEvidencePackPdf,
  evidencePackFilename,
  loadEvidencePackData,
} from "@/lib/evidence-pack";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const c = await getDashboardContext();
  if (!c) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;
  const data = await loadEvidencePackData(c.sb, c.tech, id);
  if (!data) return new Response("Not found", { status: 404 });

  const pdf = await buildEvidencePackPdf(data);
  const filename = evidencePackFilename(data.client, data.generatedAt);

  try {
    await createAuditEvent(c.sb, {
      techId: c.tech.id,
      actor: "tech",
      action: "client_evidence_pack_exported",
      entityType: "client",
      entityId: data.client.id,
      metadata: { filename },
    });
  } catch {
    // Export should still work if audit logging fails.
  }

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
