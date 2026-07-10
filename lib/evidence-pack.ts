import type { SupabaseClient } from "@supabase/supabase-js";
import PDFDocument from "pdfkit";
import { formatInTimeZone } from "date-fns-tz";
import {
  bookingsForClient,
  formResponsesForClient,
  getClient,
  listCategories,
  listClientPhotos,
  listClientReactions,
  listProductBatches,
  listProducts,
  listServices,
  patchTestsForClient,
  productUsagesForClient,
  reactionCheckinsForClient,
} from "@/lib/db/queries";
import { fmtDate, fmtDateTime, gbp, TZ } from "@/lib/format";
import { severityLabel } from "@/lib/product-batches";
import type {
  Booking,
  Client,
  ClientReaction,
  FormResponse,
  PatchTest,
  Product,
  ProductBatch,
  ProductUsage,
  ReactionCheckin,
  Service,
  ServiceCategory,
  Tech,
} from "@/lib/db/types";

export type EvidencePackData = {
  generatedAt: Date;
  tech: Tech;
  client: Client;
  categories: ServiceCategory[];
  patchTests: PatchTest[];
  bookings: Booking[];
  services: Service[];
  formResponses: FormResponse[];
  reactions: ClientReaction[];
  checkins: ReactionCheckin[];
  usages: ProductUsage[];
  products: Product[];
  batches: ProductBatch[];
  photoCount: number;
};

export async function loadEvidencePackData(
  sb: SupabaseClient,
  tech: Tech,
  clientId: string,
): Promise<EvidencePackData | null> {
  const client = await getClient(sb, clientId);
  if (!client || client.techId !== tech.id) return null;

  const [
    categories,
    services,
    patchTests,
    bookings,
    formResponses,
    reactions,
    checkins,
    usages,
    products,
    batches,
    photos,
  ] = await Promise.all([
    listCategories(sb, tech.id),
    listServices(sb, tech.id),
    patchTestsForClient(sb, tech.id, client.id),
    bookingsForClient(sb, tech.id, client.id),
    formResponsesForClient(sb, client.id),
    listClientReactions(sb, tech.id, client.id),
    reactionCheckinsForClient(sb, tech.id, client.id),
    productUsagesForClient(sb, tech.id, client.id),
    listProducts(sb, tech.id),
    listProductBatches(sb, tech.id),
    listClientPhotos(sb, client.id),
  ]);

  return {
    generatedAt: new Date(),
    tech,
    client,
    categories,
    patchTests,
    bookings,
    services,
    formResponses,
    reactions,
    checkins,
    usages,
    products,
    batches,
    photoCount: photos.length,
  };
}

function patchTestStatus(test: PatchTest): string {
  if (test.result === "fail") return "Failed";
  if (test.invalidatedAtIso) return "Invalidated (product change)";
  if (new Date(test.expiresAtIso).getTime() < Date.now()) return "Expired";
  if (test.result === "pending") return "Pending";
  return "Valid";
}

function checkinLabel(c: ReactionCheckin): string {
  if (c.status === "responded") {
    return c.response === "reaction" ? "Reaction reported" : "No reaction";
  }
  if (c.status === "sent") return "Awaiting response";
  if (c.status === "scheduled") return "Scheduled";
  return "Skipped";
}

function sanitizeFilename(s: string): string {
  return s
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

export function evidencePackFilename(client: Client, generatedAt: Date): string {
  const date = formatInTimeZone(generatedAt, TZ, "yyyy-MM-dd");
  return `evidence-pack-${sanitizeFilename(client.name)}-${date}.pdf`;
}

type PdfCtx = {
  doc: PDFKit.PDFDocument;
  left: number;
  right: number;
  contentWidth: number;
  y: number;
};

function ensureSpace(ctx: PdfCtx, needed: number): void {
  const bottom = ctx.doc.page.height - 60;
  if (ctx.y + needed > bottom) {
    ctx.doc.addPage();
    ctx.y = 50;
  }
}

function sectionTitle(ctx: PdfCtx, title: string): void {
  ensureSpace(ctx, 36);
  ctx.doc.font("Helvetica-Bold").fontSize(13).fillColor("#1f1726").text(title, ctx.left, ctx.y);
  ctx.y += 20;
  ctx.doc.moveTo(ctx.left, ctx.y).lineTo(ctx.right, ctx.y).strokeColor("#e8e0e8").stroke();
  ctx.y += 10;
}

function bodyLine(ctx: PdfCtx, text: string, opts: { bold?: boolean; gap?: number } = {}): void {
  ensureSpace(ctx, 16);
  ctx.doc
    .font(opts.bold ? "Helvetica-Bold" : "Helvetica")
    .fontSize(10)
    .fillColor("#564a5e")
    .text(text, ctx.left, ctx.y, { width: ctx.contentWidth });
  ctx.y += ctx.doc.heightOfString(text, { width: ctx.contentWidth }) + (opts.gap ?? 4);
}

function emptyNote(ctx: PdfCtx, text: string): void {
  bodyLine(ctx, text, { gap: 8 });
}

export function buildEvidencePackPdf(data: EvidencePackData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const left = 50;
    const right = doc.page.width - 50;
    const contentWidth = right - left;
    const ctx: PdfCtx = { doc, left, right, contentWidth, y: 50 };

    const catById = new Map(data.categories.map((c) => [c.id, c.name]));
    const serviceById = new Map(data.services.map((s) => [s.id, s]));
    const productById = new Map(data.products.map((p) => [p.id, p]));
    const batchById = new Map(data.batches.map((b) => [b.id, b]));
    const generated = fmtDateTime(data.generatedAt.toISOString());

    // Header
    doc.font("Helvetica-Bold").fontSize(18).fillColor("#db2777").text("Client evidence pack", left, ctx.y);
    ctx.y += 28;
    doc.font("Helvetica").fontSize(11).fillColor("#564a5e");
    doc.text(data.tech.businessName || data.tech.name, left, ctx.y);
    ctx.y += 16;
    doc.text(`Client: ${data.client.name}`, left, ctx.y);
    ctx.y += 14;
    doc.text(`Generated: ${generated}`, left, ctx.y);
    ctx.y += 14;
    doc.fontSize(9).fillColor("#8a7f91").text(
      "Compiled treatment record for insurance, dispute resolution or regulatory reference. " +
        "Data exported from Glow at the time of generation.",
      left,
      ctx.y,
      { width: contentWidth },
    );
    ctx.y += doc.heightOfString(
      "Compiled treatment record for insurance, dispute resolution or regulatory reference. Data exported from Glow at the time of generation.",
      { width: contentWidth },
    ) + 16;

    // Client details
    sectionTitle(ctx, "Client details");
    bodyLine(ctx, `Name: ${data.client.name}`);
    if (data.client.email) bodyLine(ctx, `Email: ${data.client.email}`);
    if (data.client.phone) bodyLine(ctx, `Phone: ${data.client.phone}`);
    if (data.client.isVip) bodyLine(ctx, "VIP client");
    if (data.client.isBlacklisted) bodyLine(ctx, "Blocked from online booking");
    if (data.client.warningNote.trim()) bodyLine(ctx, `Warning note: ${data.client.warningNote.trim()}`);
    if (data.client.notes.trim()) bodyLine(ctx, `Notes: ${data.client.notes.trim()}`);
    if (data.client.noShowCount > 0) {
      bodyLine(ctx, `No-shows on record: ${data.client.noShowCount}`);
    }
    ctx.y += 6;

    // Patch tests
    sectionTitle(ctx, "Patch tests");
    if (data.patchTests.length === 0) {
      emptyNote(ctx, "No patch tests on file.");
    } else {
      for (const t of data.patchTests) {
        bodyLine(
          ctx,
          `${catById.get(t.categoryId) ?? "Category"} · ${fmtDate(t.performedAtIso)} · ${patchTestStatus(t)} · expires ${fmtDate(t.expiresAtIso)}`,
          { bold: true },
        );
        if (t.notes.trim()) bodyLine(ctx, `Notes: ${t.notes.trim()}`);
      }
    }

    // Consultation forms
    sectionTitle(ctx, "Consultation answers");
    if (data.formResponses.length === 0) {
      emptyNote(ctx, "No consultation responses on file.");
    } else {
      for (const fr of data.formResponses) {
        bodyLine(ctx, `Submitted ${fmtDate(fr.createdAt)}`, { bold: true });
        for (const a of fr.answers) {
          bodyLine(ctx, `${a.prompt}: ${a.answer || "—"}`);
        }
        ctx.y += 4;
      }
    }

    // Treatment history
    sectionTitle(ctx, "Treatment history");
    const completed = data.bookings.filter((b) => b.status === "completed");
    if (completed.length === 0) {
      emptyNote(ctx, "No completed treatments on file.");
    } else {
      for (const b of [...completed].reverse()) {
        const svc = serviceById.get(b.serviceId);
        bodyLine(
          ctx,
          `${fmtDateTime(b.startIso)} · ${svc?.name ?? "Service"} · ${gbp(b.pricePennies)}`,
          { bold: true },
        );
        const lash = [b.lashMap, b.lashCurl, b.lashLength].filter(Boolean).join(" · ");
        if (lash) bodyLine(ctx, `Lash record: ${lash}`);
        if (b.notes.trim()) bodyLine(ctx, `Notes: ${b.notes.trim()}`);
      }
    }

    // Products & batches
    sectionTitle(ctx, "Products & batch traceability");
    if (data.usages.length === 0) {
      emptyNote(ctx, "No product batches logged for this client.");
    } else {
      for (const u of data.usages) {
        const batch = batchById.get(u.batchId);
        const product = batch ? productById.get(batch.productId) : null;
        const lot = batch?.lotNumber ? ` · Lot ${batch.lotNumber}` : "";
        const linked = u.patchTestId ? "patch test" : u.bookingId ? "treatment" : "visit";
        bodyLine(
          ctx,
          `${fmtDate(u.usedAtIso)} · ${product?.name ?? "Product"}${lot} (${linked})`,
          { bold: true },
        );
      }
    }

    // Reactions
    sectionTitle(ctx, "Adverse reactions");
    if (data.reactions.length === 0) {
      emptyNote(ctx, "No adverse reactions recorded.");
    } else {
      for (const r of data.reactions) {
        bodyLine(
          ctx,
          `${fmtDate(r.onsetIso)} · ${catById.get(r.categoryId) ?? "Category"} · ${severityLabel(r.severity)}`,
          { bold: true },
        );
        if (r.symptoms.trim()) bodyLine(ctx, `Symptoms: ${r.symptoms.trim()}`);
        if (r.notes.trim()) bodyLine(ctx, `Notes: ${r.notes.trim()}`);
        if (r.batchId) {
          const batch = batchById.get(r.batchId);
          const product = batch ? productById.get(batch.productId) : null;
          const lot = batch?.lotNumber ? ` · Lot ${batch.lotNumber}` : "";
          bodyLine(ctx, `Linked batch: ${product?.name ?? "Product"}${lot}`);
        }
      }
    }

    // 48h check-ins
    sectionTitle(ctx, "48-hour reaction check-ins");
    if (data.checkins.length === 0) {
      emptyNote(ctx, "No automated check-ins on file.");
    } else {
      for (const c of data.checkins) {
        bodyLine(
          ctx,
          `${catById.get(c.categoryId) ?? "Category"} · sent ${c.sentAtIso ? fmtDate(c.sentAtIso) : fmtDate(c.sendAtIso)} · ${checkinLabel(c)}`,
          { bold: true },
        );
        if (c.symptoms.trim()) bodyLine(ctx, `Client reported: ${c.symptoms.trim()}`);
      }
    }

    // Photos note
    sectionTitle(ctx, "Photos");
    if (data.photoCount === 0) {
      emptyNote(ctx, "No before/after photos on file.");
    } else {
      bodyLine(
        ctx,
        `${data.photoCount} photo${data.photoCount === 1 ? "" : "s"} on file in Glow (not embedded in this PDF). View in the client dashboard.`,
      );
    }

    // Footer
    ensureSpace(ctx, 40);
    ctx.doc.font("Helvetica").fontSize(8).fillColor("#8a7f91").text(
      `Evidence pack for ${data.client.name} · ${data.tech.businessName} · Generated ${generated} via Glow (glow-uk.com)`,
      left,
      doc.page.height - 40,
      { width: contentWidth, align: "center" },
    );

    doc.end();
  });
}
