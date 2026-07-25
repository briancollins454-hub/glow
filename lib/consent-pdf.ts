import PDFDocument from "pdfkit";
import { formatInTimeZone } from "date-fns-tz";
import { CONSENT_STATEMENT } from "@/lib/booking/consent";
import { fmtDateTime, TZ } from "@/lib/format";
import type { ConsentRecord, Client, Service, Tech } from "@/lib/db/types";

export type ConsentPdfData = {
  tech: Tech;
  client: Client;
  service: Pick<Service, "id" | "name">;
  record: ConsentRecord;
  appointmentStartIso?: string | null;
};

function sanitizeFilename(s: string): string {
  return s
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

export function consentPdfFilename(client: Client, record: ConsentRecord, generatedAt: Date): string {
  const date = formatInTimeZone(generatedAt, TZ, "yyyy-MM-dd");
  return `signed-consent-${sanitizeFilename(client.name)}-${date}.pdf`;
}

function decodeSignature(image: string): Buffer | null {
  try {
    if (image.startsWith("data:image/")) {
      const comma = image.indexOf(",");
      if (comma < 0) return null;
      return Buffer.from(image.slice(comma + 1), "base64");
    }
    return Buffer.from(image.replace(/\s/g, ""), "base64");
  } catch {
    return null;
  }
}

export function buildConsentRecordPdf(data: ConsentPdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const left = 50;
    const right = doc.page.width - 50;
    const width = right - left;
    let y = 50;

    const business = data.tech.businessName || data.tech.name;
    doc.font("Helvetica-Bold").fontSize(18).fillColor("#1f1726").text("Signed consent record", left, y);
    y += 28;
    doc.font("Helvetica").fontSize(11).fillColor("#564a5e").text(business, left, y);
    y += 18;

    doc.fontSize(10).fillColor("#564a5e");
    const lines = [
      `Client: ${data.client.name}`,
      `Service: ${data.service.name}`,
      data.appointmentStartIso
        ? `Appointment: ${fmtDateTime(data.appointmentStartIso)}`
        : null,
      `Signed (UTC): ${data.record.signedAt}`,
      `Typed name: ${data.record.typedName}`,
    ].filter(Boolean) as string[];

    for (const line of lines) {
      doc.text(line, left, y, { width });
      y += 14;
    }
    y += 8;

    doc.font("Helvetica-Bold").fontSize(12).fillColor("#1f1726").text("Consultation answers", left, y);
    y += 18;
    doc.moveTo(left, y).lineTo(right, y).strokeColor("#e8e0e8").stroke();
    y += 10;

    const snapshot = data.record.questionsSnapshot ?? [];
    if (snapshot.length === 0) {
      doc.font("Helvetica").fontSize(10).fillColor("#8a7f91").text("No consultation answers recorded.", left, y);
      y += 16;
    } else {
      for (const q of snapshot) {
        doc.font("Helvetica-Bold").fontSize(10).fillColor("#564a5e").text(q.prompt, left, y, { width });
        y += doc.heightOfString(q.prompt, { width }) + 2;
        doc.font("Helvetica").fontSize(10).fillColor("#1f1726").text(q.answer || "—", left, y, { width });
        y += doc.heightOfString(q.answer || "—", { width }) + 10;
        if (y > doc.page.height - 180) {
          doc.addPage();
          y = 50;
        }
      }
    }

    y += 4;
    doc.font("Helvetica-Bold").fontSize(12).fillColor("#1f1726").text("Consent", left, y);
    y += 18;
    doc.moveTo(left, y).lineTo(right, y).strokeColor("#e8e0e8").stroke();
    y += 10;

    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor("#564a5e")
      .text(
        `${data.record.consentAccepted ? "Accepted" : "Not accepted"}: ${CONSENT_STATEMENT}`,
        left,
        y,
        { width },
      );
    y += doc.heightOfString(`${data.record.consentAccepted ? "Accepted" : "Not accepted"}: ${CONSENT_STATEMENT}`, {
      width,
    }) + 12;

    doc.font("Helvetica").fontSize(10).fillColor("#564a5e").text(`Typed full name: ${data.record.typedName}`, left, y);
    y += 18;

    doc.font("Helvetica-Bold").fontSize(10).fillColor("#1f1726").text("Signature", left, y);
    y += 14;

    const png = decodeSignature(data.record.signatureImage);
    if (png) {
      try {
        doc.image(png, left, y, { fit: [280, 100] });
        y += 110;
      } catch {
        doc.font("Helvetica").fontSize(10).fillColor("#8a7f91").text("Signature image could not be rendered.", left, y);
        y += 16;
      }
    } else {
      doc.font("Helvetica").fontSize(10).fillColor("#8a7f91").text("Signature image missing.", left, y);
      y += 16;
    }

    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor("#8a7f91")
      .text(
        "Record stored in Glow. Reproduced on demand from the saved signed consent record.",
        left,
        Math.max(y + 8, doc.page.height - 50),
        { width },
      );

    doc.end();
  });
}
