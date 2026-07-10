import PDFDocument from "pdfkit";

type PdfCtx = {
  doc: PDFKit.PDFDocument;
  left: number;
  right: number;
  contentWidth: number;
  y: number;
};

type Section = {
  title: string;
  intro?: string;
  bullets?: string[];
  table?: { headers: string[]; rows: string[][] };
};

const BRAND = "#db2777";
const INK = "#1f1726";
const SOFT = "#564a5e";
const FAINT = "#8a7f91";

const SECTIONS: Section[] = [
  {
    title: "Platform & business model",
    bullets: [
      "UK-focused booking platform for solo lash, nail and brow techs",
      "Flat pricing: £9.50 first month, then £19/mo (or £180/year); 0% commission on client payments",
      "No marketplace — clients book your branded page, not a directory",
      "Stripe Connect — deposits and card payments go straight to the tech's bank",
      "Subscription billing via Stripe (monthly/annual, tester £1 offer, referral credits)",
      "Referral programme — refer a tech, get a free month when they subscribe",
      "Plan gating — live online bookings require an active plan/trial",
      "GDPR data export and account closure request from Settings",
      "Owner/admin panel — accounts, MRR, testers, closure requests, site traffic analytics",
      "Feedback / feature requests page and in-app Help guide",
      "Demo studio (Bella Rose) with reset option",
    ],
  },
  {
    title: "Public booking page (/{handle})",
    bullets: [
      "Branded mini-site: business name, bio, location, brand colour",
      "Cover banner, profile photo, service gallery photos, portfolio gallery",
      "Services grouped by category; optional add-ons at checkout",
      "Opening hours, approved reviews, Instagram/TikTok links, sticky Book now CTA",
      "Real-time availability slots (15-min steps; respects hours, time off, existing bookings)",
      "Consultation form at checkout (custom questions: text, long text, yes/no)",
      "Patch test gating — blocks booking if no valid pass",
      "Infill rules — returning clients only, within your window",
      "Blocked clients cannot book online",
      "Booking approval flow — approve/decline before deposit (manual or rules-based)",
      "Risk-tiered deposits — low/medium/high based on client history",
      "Paired patch test + treatment — book test and treatment in one flow",
      "Loyalty discount applied automatically for repeat/VIP clients",
      "Waitlist — join when fully booked; emailed when a slot opens",
      "Deposit payment via Stripe; balance pay link before the appointment",
      "Booking confirmation and approval-pending pages",
      "DM quote deep link — ?service=…&quote=… pre-fills from a quote link",
      "Privacy-friendly page view tracking (no cookies)",
    ],
  },
  {
    title: "Dashboard areas",
    table: {
      headers: ["Area", "What it does"],
      rows: [
        ["Home", "Today's overview, income, outstanding balances, insights, onboarding, running late"],
        ["Calendar", "All bookings, status changes, manual bookings, running late"],
        ["Messages", "Client messaging threads + DM quote panel"],
        ["Clients", "Profiles, patch tests, photos, reactions, evidence pack"],
        ["Services", "Categories, services, add-ons, products/batches, product change, retest queue, price rise"],
        ["Opening hours", "Weekly schedule + time off"],
        ["Forms", "Consultation questions"],
        ["Reminders", "Scheduled/sent reminders, reaction check-ins, infill nudges, pre-care"],
        ["Reviews", "Approve/reject; show on public page"],
        ["Income", "Tax & income reports, CSV export, tax pack PDF"],
        ["Get paid", "Stripe Connect onboarding"],
        ["My plan", "Subscribe, manage billing, referral link"],
        ["Move to Glow", "CSV import (services, clients, appointments)"],
        ["Settings", "Branding, protection policy, Google Calendar, iCal feed, loyalty, pre-care toggle"],
        ["Help", "How-to guide"],
        ["Owner", "Platform admin (owner only)"],
      ],
    },
  },
  {
    title: "Booking & diary",
    bullets: [
      "Online bookings from public page; manual bookings from dashboard",
      "Statuses: pending approval, pending, confirmed, completed, cancelled, no-show",
      "Deposit forfeiture on late cancel / no-show (configurable cancellation window)",
      "No-show counter on client profile; balance tracking (unpaid/paid/refunded/forfeited)",
      "Booking detail page with full actions",
      "Google Calendar sync — create/update/cancel appointments automatically",
      "iCal feed — subscribe in Apple Calendar etc.",
      "Business insights on home (quiet week, outstanding balances, no-show risk, top service)",
    ],
  },
  {
    title: "Booking rules engine",
    bullets: [
      "Patch test validity per category (expiry days, minimum lead time before appointment)",
      "Patch test pass/fail recording with expiry dates",
      "Infill max gap days — must have completed visit within window",
      "Full set vs infill linking",
      "Blacklist / warning notes — block or flag risky clients",
      "VIP flag — trusted client + loyalty always on",
      "Booking approval modes — off, manual, or rules-based",
      "Auto-approve returning clients after N visits",
      "Risk tiers — low / medium / high with tiered deposit %",
    ],
  },
  {
    title: "Payments & protection",
    bullets: [
      "Per-service deposits — % or fixed or none",
      "Risk-based deposit tiers (medium/high % configurable)",
      "Stripe Connect deposits and balance payments",
      "Pay balance link (tokenised URL)",
      "Refund logic on cancellation (inside/outside window)",
      "No-show deposit forfeit; payment history per booking",
      "Income reporting — total, deposits, balances, forfeited, by month, by service",
    ],
  },
  {
    title: "Automations & reminders (cron every 15 min)",
    bullets: [
      "Booking confirmation — on book",
      "24-hour reminder — day before (email + SMS when configured)",
      "Balance due reminder — before appointment",
      "Aftercare email — on mark completed",
      "Review request — on mark completed",
      "Rebooking nudge — 30+ days since last visit, no upcoming booking",
      "Waitlist alert — when a slot opens from cancellation",
      "Patch test re-test notification — after product change",
      "48h reaction check-in — after patch test / chemical treatment",
      "Infill deadline nudge — before infill window closes",
      "Pre-care confirmation — 48h before appointment",
      "Running late cascade — one-tap notify remaining clients today",
      "Reminders preview page with Run due now button",
      "Marketing opt-out (PECR) — rebooking emails respect unsubscribe",
      "Pre-care toggle in Settings",
    ],
  },
  {
    title: "Client management",
    bullets: [
      "Client profiles — contact details, notes, visit history",
      "Patch tests — pass/fail, expiry, category, product batch used",
      "Client photos — upload with consent (before/after etc.)",
      "Consultation form responses stored on profile",
      "Adverse reactions — severity, symptoms, linked batch/booking",
      "Reaction check-in responses from client link",
      "VIP / blocked / no-show badges; private warning notes",
      "Loyalty discount — after N visits (VIP always qualifies)",
      "Client messaging — private thread via /m/{token} (no client app needed)",
      "Evidence pack PDF — full compliance export per client",
    ],
  },
  {
    title: "Compliance & ops features (1–12)",
    table: {
      headers: ["#", "Feature", "Summary"],
      rows: [
        ["1", "Product-change re-flag", "Log product switch → invalidate patch tests → retest queue + notifications"],
        ["2", "Risk approval + tiered deposits", "Rules-based approval; deposit % scales with client risk"],
        ["3", "Paired patch test bookings", "Book patch test + treatment together in one flow"],
        ["4", "Product batches + reaction tracing", "Products, lot numbers, batch usage, adverse reaction logging"],
        ["5", "48h reaction check-in", "Auto email/SMS; client replies via /checkin/{token}"],
        ["6", "Evidence pack PDF", "One-click compliance PDF per client"],
        ["7", "Infill deadline nudge", "Reminds clients to book infill before window closes"],
        ["8", "Running late cascade", "One tap → email + SMS all remaining clients today"],
        ["9", "Pre-care confirmations", "Prep instructions 48h before; client confirms via /precare/{token}"],
        ["10", "Self Assessment tax pack", "UK tax year PDF: turnover, breakdowns, transactions"],
        ["11", "Price rise assistant", "Preview % or £ increase, copy email/SMS/social, bulk apply"],
        ["12", "DM quote links", "Generate quote → copy IG/WhatsApp text → client opens /q/{token} → Book now"],
      ],
    },
  },
  {
    title: "Messaging & social selling",
    bullets: [
      "Inbox with unread badge; per-client conversation thread",
      "DM quote panel — service, add-ons, price, deposit, note, copy + link",
      "Public quote page (/q/{token}) with Book now CTA",
    ],
  },
  {
    title: "Reviews & reputation",
    bullets: [
      "Review requests after completed appointments",
      "Star ratings from clients; approve before publish",
      "Show on booking page toggle; reviews displayed on public page",
    ],
  },
  {
    title: "Tax, reports & imports",
    bullets: [
      "Income dashboard — totals, completed, no-shows, forfeited",
      "Monthly and per-service breakdown; CSV export of payment data",
      "Tax pack PDF by UK tax year (6 Apr – 5 Apr)",
      "CSV import — services, clients, appointments (Square, Booksy, Timely, Fresha)",
      "Import preview before saving; platform-specific export guides in dashboard",
    ],
  },
  {
    title: "Settings & account",
    bullets: [
      "Business profile, handle, bio, location, brand colour, Instagram, TikTok",
      "Default deposit %, cancellation window, no-show fee %",
      "Loyalty threshold and discount %",
      "Booking approval mode and risk deposit tiers",
      "Infill nudges on/off; pre-care confirmations on/off",
      "Google Calendar connect/disconnect; iCal calendar feed URL",
      "Password change; GDPR full account export; account closure request",
      "Page branding photo uploads",
    ],
  },
  {
    title: "Auth & onboarding",
    bullets: [
      "Sign up / log in (Supabase Auth); password reset flow",
      "Onboarding checklist on home (services → hours → go live → payments)",
      "Signup offers (50% off, tester £1); referral attribution on signup",
    ],
  },
  {
    title: "Technical platform",
    bullets: [
      "Next.js App Router, TypeScript, Tailwind",
      "Supabase (Postgres, Auth, Storage, RLS)",
      "Stripe (subscriptions + Connect); Resend (email) + Twilio (SMS)",
      "Vercel Cron for reminder scheduler",
      "Rate limiting, monitoring hooks; 25 SQL migrations (0001–0025)",
      "Mobile-first dashboard (bottom nav + sidebar)",
    ],
  },
];

function ensureSpace(ctx: PdfCtx, needed: number): void {
  const bottom = ctx.doc.page.height - 60;
  if (ctx.y + needed > bottom) {
    ctx.doc.addPage();
    ctx.y = 50;
  }
}

function sectionTitle(ctx: PdfCtx, title: string): void {
  ensureSpace(ctx, 40);
  ctx.y += 6;
  ctx.doc.font("Helvetica-Bold").fontSize(12).fillColor(INK).text(title, ctx.left, ctx.y);
  ctx.y += 18;
  ctx.doc.moveTo(ctx.left, ctx.y).lineTo(ctx.right, ctx.y).strokeColor("#e8e0e8").stroke();
  ctx.y += 10;
}

function bodyText(ctx: PdfCtx, text: string, opts: { bold?: boolean; size?: number; color?: string; gap?: number } = {}): void {
  ensureSpace(ctx, 20);
  ctx.doc
    .font(opts.bold ? "Helvetica-Bold" : "Helvetica")
    .fontSize(opts.size ?? 9.5)
    .fillColor(opts.color ?? SOFT)
    .text(text, ctx.left, ctx.y, { width: ctx.contentWidth });
  ctx.y += ctx.doc.heightOfString(text, { width: ctx.contentWidth }) + (opts.gap ?? 5);
}

function bulletList(ctx: PdfCtx, items: string[]): void {
  for (const item of items) {
    ensureSpace(ctx, 18);
    const bulletX = ctx.left;
    const textX = ctx.left + 12;
    const textWidth = ctx.contentWidth - 12;
    ctx.doc.font("Helvetica").fontSize(9.5).fillColor(SOFT).text("•", bulletX, ctx.y);
    ctx.doc.text(item, textX, ctx.y, { width: textWidth });
    ctx.y += ctx.doc.heightOfString(item, { width: textWidth }) + 4;
  }
  ctx.y += 4;
}

function simpleTable(ctx: PdfCtx, headers: string[], rows: string[][]): void {
  const colCount = headers.length;
  const colWidths =
    colCount === 2
      ? [ctx.contentWidth * 0.28, ctx.contentWidth * 0.72]
      : [ctx.contentWidth * 0.06, ctx.contentWidth * 0.28, ctx.contentWidth * 0.66];

  const rowHeight = (cells: string[], bold = false) => {
    ctx.doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(8.5);
    let maxH = 14;
    for (let i = 0; i < cells.length; i++) {
      const h = ctx.doc.heightOfString(cells[i] ?? "", { width: colWidths[i]! - 6 });
      maxH = Math.max(maxH, h + 6);
    }
    return maxH;
  };

  ensureSpace(ctx, rowHeight(headers, true) + 8);
  let x = ctx.left;
  for (let i = 0; i < headers.length; i++) {
    ctx.doc
      .font("Helvetica-Bold")
      .fontSize(8.5)
      .fillColor(INK)
      .text(headers[i]!, x + 3, ctx.y + 3, { width: colWidths[i]! - 6 });
    x += colWidths[i]!;
  }
  ctx.y += rowHeight(headers, true);
  ctx.doc.moveTo(ctx.left, ctx.y).lineTo(ctx.right, ctx.y).strokeColor("#e8e0e8").stroke();
  ctx.y += 2;

  for (const row of rows) {
    const h = rowHeight(row);
    ensureSpace(ctx, h + 4);
    x = ctx.left;
    for (let i = 0; i < row.length; i++) {
      ctx.doc
        .font("Helvetica")
        .fontSize(8.5)
        .fillColor(SOFT)
        .text(row[i] ?? "", x + 3, ctx.y + 3, { width: colWidths[i]! - 6 });
      x += colWidths[i]!;
    }
    ctx.y += h;
    ctx.doc.moveTo(ctx.left, ctx.y).lineTo(ctx.right, ctx.y).strokeColor("#f0eaf0").stroke();
  }
  ctx.y += 8;
}

export function featureListFilename(generatedAt = new Date()): string {
  const date = generatedAt.toISOString().slice(0, 10);
  return `Glow-Feature-List-${date}.pdf`;
}

export function buildFeatureListPdf(generatedAt = new Date()): Promise<Buffer> {
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

    doc.font("Helvetica-Bold").fontSize(20).fillColor(BRAND).text("Glow", left, ctx.y);
    ctx.y += 26;
    doc.font("Helvetica-Bold").fontSize(16).fillColor(INK).text("Full feature list", left, ctx.y);
    ctx.y += 22;
    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor(SOFT)
      .text("Booking system for UK solo lash, nail and brow techs", left, ctx.y);
    ctx.y += 14;
    doc.text(`Generated ${generatedAt.toISOString().slice(0, 10)} · glow-uk.com`, left, ctx.y);
    ctx.y += 18;
    bodyText(
      ctx,
      "Everything included in the flat £19/mo plan (0% commission). Features 1–12 are numbered compliance and operations tools shipped on main.",
      { gap: 10 },
    );

    for (const section of SECTIONS) {
      sectionTitle(ctx, section.title);
      if (section.intro) bodyText(ctx, section.intro);
      if (section.bullets) bulletList(ctx, section.bullets);
      if (section.table) simpleTable(ctx, section.table.headers, section.table.rows);
    }

    ensureSpace(ctx, 40);
    ctx.y += 8;
    doc
      .font("Helvetica")
      .fontSize(8.5)
      .fillColor(FAINT)
      .text(
        "© Glow. Made for UK beauty techs. This document is a product reference, not a contract. Features and pricing may change.",
        left,
        ctx.y,
        { width: contentWidth, align: "center" },
      );

    doc.end();
  });
}
