import { getDashboardContext } from "@/lib/auth/session";
import { createAuditEvent, getBooking, getClient, getConsentRecord, getService } from "@/lib/db/queries";
import { buildConsentRecordPdf, consentPdfFilename } from "@/lib/consent-pdf";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; consentId: string }> },
) {
  const c = await getDashboardContext();
  if (!c) return new Response("Unauthorized", { status: 401 });

  const { id, consentId } = await params;
  const [client, record] = await Promise.all([
    getClient(c.sb, id),
    getConsentRecord(c.sb, consentId),
  ]);
  if (!client || client.techId !== c.tech.id || !record || record.techId !== c.tech.id) {
    return new Response("Not found", { status: 404 });
  }
  if (record.clientId !== client.id) {
    return new Response("Not found", { status: 404 });
  }

  const [service, booking] = await Promise.all([
    getService(c.sb, record.serviceId),
    record.bookingId ? getBooking(c.sb, record.bookingId) : Promise.resolve(null),
  ]);
  if (!service || service.techId !== c.tech.id) {
    return new Response("Not found", { status: 404 });
  }

  const pdf = await buildConsentRecordPdf({
    tech: c.tech,
    client,
    service,
    record,
    appointmentStartIso: booking?.startIso ?? null,
  });
  const filename = consentPdfFilename(client, record, new Date());

  try {
    await createAuditEvent(c.sb, {
      techId: c.tech.id,
      actor: "tech",
      action: "consent_record_pdf_exported",
      entityType: "consent_record",
      entityId: record.id,
      metadata: { clientId: client.id, filename },
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
