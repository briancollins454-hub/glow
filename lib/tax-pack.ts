import type { SupabaseClient } from "@supabase/supabase-js";
import PDFDocument from "pdfkit";
import { formatInTimeZone } from "date-fns-tz";
import { listBookings, listClients, listPayments, listServices } from "@/lib/db/queries";
import { fmtDate, fmtDateTime, gbp, TZ } from "@/lib/format";
import { inTaxYear, taxYearRange, type TaxYearRange } from "@/lib/tax-year";
import type { Payment, Tech } from "@/lib/db/types";

export type { TaxYearRange } from "@/lib/tax-year";
export { selectableTaxYears, taxYearRange, taxYearStartForDate } from "@/lib/tax-year";

export type TaxPackPaymentRow = {
  dateIso: string;
  kind: Payment["kind"];
  amountPennies: number;
  clientName: string;
  serviceName: string;
  appointmentIso: string;
};

export type TaxPackData = {
  generatedAt: Date;
  tech: Tech;
  taxYear: TaxYearRange;
  totalIncome: number;
  depositsTotal: number;
  balancesTotal: number;
  refundsTotal: number;
  completed: number;
  noShows: number;
  forfeited: number;
  byMonth: [string, number][];
  byService: [string, number][];
  payments: TaxPackPaymentRow[];
};

function signedAmount(kind: Payment["kind"], pennies: number): number {
  return kind === "refund" ? -pennies : pennies;
}

export async function loadTaxPackData(
  sb: SupabaseClient,
  tech: Tech,
  startYear: number,
): Promise<TaxPackData> {
  const taxYear = taxYearRange(startYear);
  const [payments, bookings, clients, services] = await Promise.all([
    listPayments(sb, tech.id),
    listBookings(sb, tech.id),
    listClients(sb, tech.id),
    listServices(sb, tech.id),
  ]);

  const succeeded = payments.filter(
    (p) => p.status === "succeeded" && inTaxYear(p.createdAt, taxYear),
  );
  const bookingById = new Map(bookings.map((b) => [b.id, b]));
  const clientById = new Map(clients.map((c) => [c.id, c.name]));
  const serviceById = new Map(services.map((s) => [s.id, s.name]));

  const yearBookings = bookings.filter((b) => inTaxYear(b.startIso, taxYear));

  const totalIncome = succeeded.reduce((s, p) => s + signedAmount(p.kind, p.amountPennies), 0);
  const depositsTotal = succeeded
    .filter((p) => p.kind === "deposit")
    .reduce((s, p) => s + p.amountPennies, 0);
  const balancesTotal = succeeded
    .filter((p) => p.kind === "balance")
    .reduce((s, p) => s + p.amountPennies, 0);
  const refundsTotal = succeeded
    .filter((p) => p.kind === "refund")
    .reduce((s, p) => s + p.amountPennies, 0);

  const completed = yearBookings.filter((b) => b.status === "completed").length;
  const noShows = yearBookings.filter((b) => b.status === "no_show").length;
  const forfeited = yearBookings
    .filter((b) => b.depositStatus === "forfeited")
    .reduce((s, b) => s + b.depositPennies, 0);

  const byMonth = new Map<string, number>();
  for (const p of succeeded) {
    const key = formatInTimeZone(new Date(p.createdAt), TZ, "yyyy-MM");
    byMonth.set(key, (byMonth.get(key) ?? 0) + signedAmount(p.kind, p.amountPennies));
  }

  const byService = new Map<string, number>();
  for (const p of succeeded) {
    const booking = bookingById.get(p.bookingId);
    if (!booking) continue;
    const name = serviceById.get(booking.serviceId) ?? "Other";
    byService.set(name, (byService.get(name) ?? 0) + signedAmount(p.kind, p.amountPennies));
  }

  const paymentRows: TaxPackPaymentRow[] = succeeded
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((p) => {
      const booking = bookingById.get(p.bookingId);
      return {
        dateIso: p.createdAt,
        kind: p.kind,
        amountPennies: signedAmount(p.kind, p.amountPennies),
        clientName: booking ? clientById.get(booking.clientId) ?? "" : "",
        serviceName: booking ? serviceById.get(booking.serviceId) ?? "" : "",
        appointmentIso: booking?.startIso ?? "",
      };
    });

  return {
    generatedAt: new Date(),
    tech,
    taxYear,
    totalIncome,
    depositsTotal,
    balancesTotal,
    refundsTotal,
    completed,
    noShows,
    forfeited,
    byMonth: [...byMonth.entries()].sort((a, b) => a[0].localeCompare(b[0])),
    byService: [...byService.entries()].sort((a, b) => b[1] - a[1]),
    payments: paymentRows,
  };
}

function sanitizeFilename(s: string): string {
  return s
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}

export function taxPackFilename(tech: Tech, taxYear: TaxYearRange, generatedAt: Date): string {
  const date = formatInTimeZone(generatedAt, TZ, "yyyy-MM-dd");
  const biz = sanitizeFilename(tech.businessName || tech.handle || "glow");
  return `self-assessment-${biz}-${taxYear.label.replace("/", "-")}-${date}.pdf`;
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

function kindLabel(kind: Payment["kind"]): string {
  if (kind === "deposit") return "Deposit";
  if (kind === "balance") return "Balance";
  if (kind === "no_show_fee") return "No-show fee";
  return "Refund";
}

export function buildTaxPackPdf(data: TaxPackData): Promise<Buffer> {
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

    const biz = data.tech.businessName || data.tech.name;
    const periodFrom = fmtDate(data.taxYear.fromIso);
    const periodTo = fmtDate(new Date(new Date(data.taxYear.toIso).getTime() - 1).toISOString());

    doc.font("Helvetica-Bold").fontSize(18).fillColor("#db2777").text("Self Assessment tax pack", left, ctx.y);
    ctx.y += 28;
    doc.font("Helvetica").fontSize(11).fillColor("#564a5e");
    doc.text(biz, left, ctx.y);
    ctx.y += 16;
    doc.text(`Tax year ${data.taxYear.label} (${periodFrom} – ${periodTo})`, left, ctx.y);
    ctx.y += 16;
    doc.text(`Generated ${fmtDateTime(data.generatedAt.toISOString())}`, left, ctx.y);
    ctx.y += 24;

    sectionTitle(ctx, "Income summary");
    bodyLine(ctx, `Total turnover (net of refunds): ${gbp(data.totalIncome)}`, { bold: true, gap: 6 });
    bodyLine(ctx, `Deposits received: ${gbp(data.depositsTotal)}`);
    bodyLine(ctx, `Balances received: ${gbp(data.balancesTotal)}`);
    if (data.refundsTotal > 0) {
      bodyLine(ctx, `Refunds issued: ${gbp(data.refundsTotal)}`);
    }
    bodyLine(ctx, `Completed appointments: ${data.completed}`);
    bodyLine(ctx, `No-shows: ${data.noShows}`);
    if (data.forfeited > 0) {
      bodyLine(ctx, `Forfeited deposits (kept): ${gbp(data.forfeited)}`, { gap: 8 });
    }

    sectionTitle(ctx, "Income by month");
    if (data.byMonth.length === 0) {
      bodyLine(ctx, "No payments recorded in this tax year.");
    } else {
      for (const [month, total] of data.byMonth) {
        const label = formatInTimeZone(new Date(`${month}-01T12:00:00Z`), TZ, "MMMM yyyy");
        bodyLine(ctx, `${label}: ${gbp(total)}`);
      }
    }

    sectionTitle(ctx, "Income by service");
    if (data.byService.length === 0) {
      bodyLine(ctx, "No service income recorded in this tax year.");
    } else {
      for (const [name, total] of data.byService) {
        bodyLine(ctx, `${name}: ${gbp(total)}`);
      }
    }

    sectionTitle(ctx, "Payment transactions");
    bodyLine(
      ctx,
      "All succeeded payments in this tax year. Use alongside your bank statements and expenses for Self Assessment.",
      { gap: 8 },
    );

    if (data.payments.length === 0) {
      bodyLine(ctx, "No transactions in this period.");
    } else {
      for (const row of data.payments) {
        ensureSpace(ctx, 40);
        const date = formatInTimeZone(new Date(row.dateIso), TZ, "dd MMM yyyy");
        const appt = row.appointmentIso
          ? formatInTimeZone(new Date(row.appointmentIso), TZ, "dd MMM yyyy HH:mm")
          : "—";
        const line =
          `${date} · ${kindLabel(row.kind)} · ${gbp(row.amountPennies)}` +
          (row.clientName ? ` · ${row.clientName}` : "") +
          (row.serviceName ? ` · ${row.serviceName}` : "") +
          ` · Appt ${appt}`;
        bodyLine(ctx, line, { gap: 2 });
      }
    }

    ensureSpace(ctx, 40);
    ctx.doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor("#8a7f91")
      .text(
        "This pack summarises income recorded in Glow. It is not tax advice. " +
          "Check figures against your Stripe payouts and keep receipts for allowable expenses. " +
          "Consult an accountant if unsure.",
        ctx.left,
        ctx.y,
        { width: ctx.contentWidth },
      );

    doc.end();
  });
}
