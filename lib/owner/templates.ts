/**
 * Email/SMS template previewer (Phase 3.3) — render without sending.
 */

import { renderReminderText, labelForKind } from "@/lib/reminder-copy";
import type { Booking, Client, Reminder, ReminderKind, Service, Tech } from "@/lib/db/types";

export type TemplatePreview = {
  kind: string;
  classification: "transactional" | "marketing";
  from: string;
  replyTo: string;
  subject: string;
  text: string;
  html: string;
  channel: "email" | "sms";
};

const MARKETING = new Set(["rebook_nudge", "onboarding_nudge"]);

export function classifyKind(kind: string): "transactional" | "marketing" {
  return MARKETING.has(kind) ? "marketing" : "transactional";
}

function previewFromAddress(): string {
  return process.env.RESEND_FROM ?? "Glow <onboarding@resend.dev>";
}

/** Minimal branded HTML for preview only (avoids importing send stack from lib/email). */
function previewBrandedHtml(opts: {
  brand: string;
  businessName: string;
  heading: string;
  bodyHtml: string;
}): string {
  return `<!doctype html><html><body style="font-family:Georgia,serif;background:#faf7f4;padding:24px">
  <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e8e0d8;padding:24px">
    <div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:${opts.brand}">${escapeHtml(opts.businessName)}</div>
    <h1 style="font-size:22px;margin:12px 0">${escapeHtml(opts.heading)}</h1>
    ${opts.bodyHtml}
  </div></body></html>`;
}

/** Build a preview for a reminder kind using real account rows (no send). */
export function previewReminderTemplate(opts: {
  kind: ReminderKind;
  tech: Tech;
  booking: Booking;
  client: Client | null;
  service: Service | null;
  channel?: "email" | "sms";
}): TemplatePreview {
  const reminder = {
    id: "preview",
    techId: opts.tech.id,
    bookingId: opts.booking.id,
    clientId: opts.client?.id ?? null,
    channel: opts.channel ?? "email",
    kind: opts.kind,
    sendAtIso: new Date().toISOString(),
    status: "scheduled" as const,
    preview: "",
    sentAtIso: null,
    createdAt: new Date().toISOString(),
  } satisfies Reminder;

  const text = renderReminderText({
    reminder,
    booking: opts.booking,
    client: opts.client,
    service: opts.service,
    tech: opts.tech,
  });
  const subject = `${labelForKind(opts.kind)} — ${opts.tech.businessName}`;
  const html = previewBrandedHtml({
    brand: opts.tech.brandColor || "#C4785A",
    businessName: opts.tech.businessName,
    heading: subject,
    bodyHtml: `<p style="white-space:pre-wrap">${escapeHtml(text)}</p>`,
  });

  return {
    kind: opts.kind,
    classification: classifyKind(opts.kind),
    from: previewFromAddress(),
    replyTo: opts.tech.email,
    subject,
    text,
    html,
    channel: opts.channel ?? "email",
  };
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Assert preview helpers never call providers — used in tests via source scan. */
export const PREVIEW_SENDS_NOTHING = true;
