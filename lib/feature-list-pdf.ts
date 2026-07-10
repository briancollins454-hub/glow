import PDFDocument from "pdfkit";
import { CAMPAIGN_THEMES, CHAPTERS, POSITIONING } from "./feature-list-content";

type PdfCtx = {
  doc: PDFKit.PDFDocument;
  left: number;
  right: number;
  contentWidth: number;
  y: number;
  pageNum: number;
};

const BRAND = "#db2777";
const INK = "#1f1726";
const SOFT = "#564a5e";
const FAINT = "#8a7f91";
const ACCENT_BG = "#fdf2f8";

function ensureSpace(ctx: PdfCtx, needed: number): void {
  const bottom = ctx.doc.page.height - 55;
  if (ctx.y + needed > bottom) {
    ctx.doc.addPage();
    ctx.pageNum++;
    ctx.y = 50;
    pageFooter(ctx);
  }
}

function pageFooter(ctx: PdfCtx): void {
  const y = ctx.doc.page.height - 40;
  ctx.doc
    .font("Helvetica")
    .fontSize(7.5)
    .fillColor(FAINT)
    .text(`Glow Feature Guide · glow-uk.com · Page ${ctx.pageNum}`, ctx.left, y, {
      width: ctx.contentWidth,
      align: "center",
    });
}

function bodyText(
  ctx: PdfCtx,
  text: string,
  opts: { bold?: boolean; size?: number; color?: string; gap?: number; indent?: number } = {},
): void {
  ensureSpace(ctx, 18);
  const x = ctx.left + (opts.indent ?? 0);
  const w = ctx.contentWidth - (opts.indent ?? 0);
  ctx.doc
    .font(opts.bold ? "Helvetica-Bold" : "Helvetica")
    .fontSize(opts.size ?? 9.5)
    .fillColor(opts.color ?? SOFT)
    .text(text, x, ctx.y, { width: w });
  ctx.y += ctx.doc.heightOfString(text, { width: w }) + (opts.gap ?? 5);
}

function labelValue(ctx: PdfCtx, label: string, value: string): void {
  ensureSpace(ctx, 24);
  ctx.doc.font("Helvetica-Bold").fontSize(8).fillColor(BRAND).text(label.toUpperCase(), ctx.left, ctx.y);
  ctx.y += 11;
  bodyText(ctx, value, { gap: 8 });
}

function bulletList(ctx: PdfCtx, items: string[], opts: { indent?: number; size?: number } = {}): void {
  const indent = opts.indent ?? 0;
  const textX = ctx.left + indent + 10;
  const textWidth = ctx.contentWidth - indent - 10;
  for (const item of items) {
    ensureSpace(ctx, 16);
    ctx.doc
      .font("Helvetica")
      .fontSize(opts.size ?? 9)
      .fillColor(SOFT)
      .text("•", ctx.left + indent, ctx.y);
    ctx.doc.text(item, textX, ctx.y, { width: textWidth });
    ctx.y += ctx.doc.heightOfString(item, { width: textWidth }) + 3;
  }
  ctx.y += 4;
}

function chapterDivider(ctx: PdfCtx, part: number, title: string, subtitle: string): void {
  ctx.doc.addPage();
  ctx.pageNum++;
  ctx.y = 80;
  ctx.doc.font("Helvetica").fontSize(10).fillColor(BRAND).text(`PART ${part}`, ctx.left, ctx.y);
  ctx.y += 20;
  ctx.doc.font("Helvetica-Bold").fontSize(22).fillColor(INK).text(title, ctx.left, ctx.y, { width: ctx.contentWidth });
  ctx.y += ctx.doc.heightOfString(title, { width: ctx.contentWidth }) + 8;
  ctx.doc.font("Helvetica").fontSize(12).fillColor(SOFT).text(subtitle, ctx.left, ctx.y, { width: ctx.contentWidth });
  ctx.y += 36;
  pageFooter(ctx);
}

function featureCard(ctx: PdfCtx, index: number, total: number): void {
  // placeholder - filled by caller via closure pattern in build
  void index;
  void total;
}

function renderFeature(ctx: PdfCtx, num: number, total: number, f: (typeof CHAPTERS)[0]["features"][0]): void {
  ensureSpace(ctx, 120);
  ctx.y += 4;

  // Card header band
  const bandH = 52;
  ensureSpace(ctx, bandH + 20);
  ctx.doc.rect(ctx.left, ctx.y, ctx.contentWidth, bandH).fill(ACCENT_BG);
  ctx.doc
    .font("Helvetica")
    .fontSize(8)
    .fillColor(BRAND)
    .text(`FEATURE ${num} OF ${total}`, ctx.left + 10, ctx.y + 8);
  ctx.doc
    .font("Helvetica-Bold")
    .fontSize(13)
    .fillColor(INK)
    .text(f.name, ctx.left + 10, ctx.y + 20, { width: ctx.contentWidth - 20 });
  ctx.doc
    .font("Helvetica-BoldOblique")
    .fontSize(10)
    .fillColor(BRAND)
    .text(`"${f.headline}"`, ctx.left + 10, ctx.y + 36, { width: ctx.contentWidth - 20 });
  ctx.y += bandH + 12;

  labelValue(ctx, "Poster / reel headline", f.headline);
  labelValue(ctx, "One-line caption", f.tagline);
  labelValue(ctx, "The problem", f.pain);
  labelValue(ctx, "What it is", f.whatItIs);
  labelValue(ctx, "How it works", f.howItWorks);

  ensureSpace(ctx, 20);
  ctx.doc.font("Helvetica-Bold").fontSize(8).fillColor(BRAND).text("KEY BENEFITS", ctx.left, ctx.y);
  ctx.y += 11;
  bulletList(ctx, f.benefits);

  ensureSpace(ctx, 20);
  ctx.doc.font("Helvetica-Bold").fontSize(8).fillColor(BRAND).text("MARKETING HOOKS — copy/paste for posts & scripts", ctx.left, ctx.y);
  ctx.y += 11;
  bulletList(ctx, f.marketingHooks, { size: 9 });

  labelValue(ctx, "Where in Glow", f.whereInApp);
  if (f.competitorAngle) {
    labelValue(ctx, "Vs competitors", f.competitorAngle);
  }

  ctx.y += 6;
  ctx.doc.moveTo(ctx.left, ctx.y).lineTo(ctx.right, ctx.y).strokeColor("#e8e0e8").stroke();
  ctx.y += 14;
}

export const FEATURE_GUIDE_BASENAME = "Glow-Feature-Guide";

export function featureGuideFilename(generatedAt = new Date()): string {
  return `${FEATURE_GUIDE_BASENAME}-${generatedAt.toISOString().slice(0, 10)}.pdf`;
}

/** @deprecated Use featureGuideFilename */
export function featureListFilename(generatedAt = new Date()): string {
  return featureGuideFilename(generatedAt);
}

export function buildFeatureListPdf(generatedAt = new Date()): Promise<Buffer> {
  return buildFeatureGuidePdf(generatedAt);
}

export function buildFeatureGuidePdf(generatedAt = new Date()): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const left = 50;
    const right = doc.page.width - 50;
    const contentWidth = right - left;
    const ctx: PdfCtx = { doc, left, right, contentWidth, y: 50, pageNum: 1 };

    const allFeatures = CHAPTERS.flatMap((c) => c.features);
    const totalFeatures = allFeatures.length;

    // ---- COVER ----
    ctx.y = 120;
    doc.font("Helvetica-Bold").fontSize(32).fillColor(BRAND).text("Glow", left, ctx.y);
    ctx.y += 44;
    doc.font("Helvetica-Bold").fontSize(22).fillColor(INK).text("Feature Guide", left, ctx.y);
    ctx.y += 32;
    doc
      .font("Helvetica")
      .fontSize(12)
      .fillColor(SOFT)
      .text("Marketing & product reference", left, ctx.y);
    ctx.y += 18;
    doc.text("For posters, reels, ads, sales pages and internal planning", left, ctx.y);
    ctx.y += 28;
    doc.font("Helvetica").fontSize(10).fillColor(FAINT);
    doc.text(`Generated ${generatedAt.toISOString().slice(0, 10)}`, left, ctx.y);
    ctx.y += 14;
    doc.text("glow-uk.com · UK lash, nail & brow techs", left, ctx.y);
    ctx.y += 40;
    doc.rect(left, ctx.y, contentWidth, 1).fill("#e8e0e8");
    ctx.y += 20;
    bodyText(ctx, POSITIONING.oneLiner, { size: 11, bold: true, color: INK, gap: 12 });
    bodyText(ctx, POSITIONING.elevator, { size: 10, gap: 8 });
    bodyText(ctx, `Audience: ${POSITIONING.audience}`, { size: 9, color: FAINT });
    bodyText(ctx, `Pricing: ${POSITIONING.pricing}`, { size: 9, color: FAINT, gap: 16 });
    pageFooter(ctx);

    // ---- HOW TO USE ----
    doc.addPage();
    ctx.pageNum++;
    ctx.y = 50;
    doc.font("Helvetica-Bold").fontSize(16).fillColor(INK).text("How to use this guide", left, ctx.y);
    ctx.y += 28;
    bodyText(
      ctx,
      "Each feature is structured the same way so you can lift content straight into marketing assets:",
      { gap: 10 },
    );
    bulletList(ctx, [
      "Headline — bold text for posters, Reels cover, carousel slide 1",
      "Tagline — one sentence for captions, ad subcopy, email subject lines",
      "The problem — the pain point to open a video script or testimonial prompt",
      "What it is / How it works — product explainer copy and demo narration",
      "Key benefits — bullet slides, comparison tables, landing page sections",
      "Marketing hooks — ready-made social lines (edit to your voice)",
      "Where in Glow — for tutorials, onboarding content, and support docs",
    ]);
    ctx.y += 8;
    bodyText(ctx, "Part 8 at the end maps features to campaign themes (no-shows, patch tests, switching platforms, etc.).", {
      gap: 12,
    });
    pageFooter(ctx);

    // ---- POSITIONING PILLARS ----
    doc.addPage();
    ctx.pageNum++;
    ctx.y = 50;
    doc.font("Helvetica-Bold").fontSize(16).fillColor(INK).text("Brand positioning pillars", left, ctx.y);
    ctx.y += 28;
    for (const pillar of POSITIONING.pillars) {
      ensureSpace(ctx, 50);
      doc.font("Helvetica-Bold").fontSize(11).fillColor(BRAND).text(pillar.title, left, ctx.y);
      ctx.y += 16;
      bodyText(ctx, pillar.body, { gap: 12 });
    }
    pageFooter(ctx);

    // ---- TABLE OF CONTENTS ----
    doc.addPage();
    ctx.pageNum++;
    ctx.y = 50;
    doc.font("Helvetica-Bold").fontSize(16).fillColor(INK).text("Contents", left, ctx.y);
    ctx.y += 28;
    CHAPTERS.forEach((ch, i) => {
      ensureSpace(ctx, 20);
      doc.font("Helvetica-Bold").fontSize(10).fillColor(INK).text(`Part ${i + 1}: ${ch.title}`, left, ctx.y);
      ctx.y += 14;
      doc.font("Helvetica").fontSize(9).fillColor(SOFT).text(ch.subtitle, left + 12, ctx.y);
      ctx.y += 12;
      for (const f of ch.features) {
        ensureSpace(ctx, 14);
        doc.font("Helvetica").fontSize(8.5).fillColor(FAINT).text(`· ${f.name}`, left + 12, ctx.y);
        ctx.y += 11;
      }
      ctx.y += 6;
    });
    ensureSpace(ctx, 20);
    doc.font("Helvetica-Bold").fontSize(10).fillColor(INK).text("Part 8: Campaign theme map", left, ctx.y);
    ctx.y += 14;
    doc.font("Helvetica").fontSize(9).fillColor(SOFT).text("Poster and video series ideas grouped by message", left + 12, ctx.y);
    pageFooter(ctx);

    // ---- FEATURE CHAPTERS ----
    let featureNum = 0;
    CHAPTERS.forEach((chapter, chapterIdx) => {
      chapterDivider(ctx, chapterIdx + 1, chapter.title, chapter.subtitle);
      ctx.y = 50;
      bodyText(ctx, chapter.intro, { gap: 16 });

      for (const feature of chapter.features) {
        featureNum++;
        renderFeature(ctx, featureNum, totalFeatures, feature);
      }
    });

    // ---- CAMPAIGN THEMES ----
    chapterDivider(ctx, 8, "Campaign theme map", "Group features into poster series and video scripts");
    ctx.y = 50;
    bodyText(
      ctx,
      "Use these themes to plan content batches. Each row links to feature IDs in this guide — search the feature name for full copy.",
      { gap: 14 },
    );

    for (const campaign of CAMPAIGN_THEMES) {
      ensureSpace(ctx, 60);
      doc.font("Helvetica-Bold").fontSize(11).fillColor(BRAND).text(campaign.theme, left, ctx.y);
      ctx.y += 16;
      bodyText(ctx, `Sample headline: "${campaign.sampleHeadline}"`, { bold: true, gap: 6 });
      const names = campaign.features
        .map((id) => allFeatures.find((f) => f.id === id)?.name)
        .filter(Boolean) as string[];
      bodyText(ctx, `Features: ${names.join(" · ")}`, { size: 8.5, color: FAINT, gap: 12 });
    }

    ctx.y += 10;
    ensureSpace(ctx, 80);
    doc.font("Helvetica-Bold").fontSize(12).fillColor(INK).text("Quick stats for marketing", left, ctx.y);
    ctx.y += 20;
    bulletList(ctx, [
      `${totalFeatures} detailed features documented in this guide`,
      "12 numbered compliance & ops features (product change through DM quotes)",
      "£19/mo flat · 0% commission · all features included",
      "Built for UK self-employed lash, nail and brow technicians",
      "Import from Square, Booksy, Timely and Fresha",
    ]);

    ensureSpace(ctx, 50);
    ctx.y += 16;
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor(FAINT)
      .text(
        "© Glow. Marketing reference document — not a contract. Features and pricing may change. Regenerate from the repo with: npx tsx scripts/generate-feature-list-pdf.ts",
        left,
        ctx.y,
        { width: contentWidth, align: "center" },
      );

    doc.end();
  });
}

// silence unused
void featureCard;
