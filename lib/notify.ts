import type { SupabaseClient } from "@supabase/supabase-js";
import { getBooking, getClient, getService, getTechById, markReminder, createReminder } from "@/lib/db/queries";
import { fmtDate, fmtDateTime, fmtTime, gbp } from "@/lib/format";
import { INFILL_NUDGE_LEAD_DAYS } from "@/lib/infill-nudge";
import { riskTierLabel } from "@/lib/rules";
import { sendEmail, brandedEmail } from "@/lib/email";
import { sendSms, smsConfigured } from "@/lib/sms";
import type { Booking, Client, Reminder, ReminderKind, Service, Tech } from "@/lib/db/types";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

interface Ctx {
  reminder: Reminder;
  booking: Booking;
  client: Client | null;
  service: Service | null;
  tech: Tech | null;
}

export function renderReminderText({ reminder, booking, client, service, tech }: Ctx): string {
  const when = fmtDateTime(booking.startIso);
  const name = client?.name?.split(" ")[0] ?? "there";
  const biz = tech?.businessName ?? "your beauty studio";
  const svc = service?.name ?? "your appointment";
  const payUrl = `${APP_URL}/pay/${booking.balanceToken}`;

  switch (reminder.kind) {
    case "confirmation":
      return `Hi ${name}! Your ${svc} with ${biz} is booked for ${when}. Deposit of ${gbp(booking.depositPennies)} received - thank you. Balance due: ${gbp(booking.balancePennies)}.`;
    case "reminder_24h":
      return `Reminder: ${name}, your ${svc} with ${biz} is tomorrow (${when}). See you then! Need to rearrange? Please give notice.`;
    case "reminder_2h":
      return `Hi ${name}, just a quick reminder your ${svc} is in a couple of hours (${when}). ${biz}`;
    case "balance_request":
      return `Hi ${name}, your remaining balance of ${gbp(booking.balancePennies)} for your ${svc} can be paid here before your appointment: ${payUrl}`;
    case "patch_test_retest":
      return reminder.preview || `Hi ${name}, ${biz} needs you to arrange a patch test before your appointment.`;
    default:
      return `Hi ${name}, a message about your booking with ${biz}.`;
  }
}

function subjectFor(kind: ReminderKind, biz: string): string {
  switch (kind) {
    case "confirmation":
      return `Your booking with ${biz} is confirmed`;
    case "reminder_24h":
      return `Reminder: your appointment tomorrow`;
    case "reminder_2h":
      return `See you soon - your appointment is in 2 hours`;
    case "balance_request":
      return `Your remaining balance for ${biz}`;
    case "patch_test_retest":
      return `Patch test needed at ${biz}`;
  }
}

function renderReminderEmail(ctx: Ctx): { subject: string; html: string } {
  const { reminder, booking, client, service, tech } = ctx;
  const brand = tech?.brandColor || "#db2777";
  const biz = tech?.businessName ?? "your beauty studio";
  const name = client?.name?.split(" ")[0] ?? "there";
  const when = fmtDateTime(booking.startIso);
  const svc = service?.name ?? "your appointment";
  const payUrl = `${APP_URL}/pay/${booking.balanceToken}`;

  let heading = "";
  let bodyHtml = "";
  let buttonLabel: string | undefined;
  let buttonUrl: string | undefined;

  switch (reminder.kind) {
    case "confirmation":
      heading = "You're booked in!";
      bodyHtml = `Hi ${name},<br/><br/>Your <strong>${svc}</strong> is confirmed for <strong>${when}</strong>.<br/><br/>Deposit paid: ${gbp(booking.depositPennies)}<br/>Balance due on the day: <strong>${gbp(booking.balancePennies)}</strong>`;
      if (booking.balancePennies > 0) {
        buttonLabel = "Pay balance early";
        buttonUrl = payUrl;
      }
      break;
    case "reminder_24h":
      heading = "See you tomorrow";
      bodyHtml = `Hi ${name},<br/><br/>Just a reminder that your <strong>${svc}</strong> is tomorrow, <strong>${when}</strong>. Looking forward to seeing you!`;
      break;
    case "reminder_2h":
      heading = "Almost time";
      bodyHtml = `Hi ${name},<br/><br/>Your <strong>${svc}</strong> is in about 2 hours (${when}). See you soon!`;
      break;
    case "balance_request":
      heading = "Your balance is ready to pay";
      bodyHtml = `Hi ${name},<br/><br/>Your remaining balance for <strong>${svc}</strong> is <strong>${gbp(booking.balancePennies)}</strong>. You can pay it securely before your appointment.`;
      buttonLabel = `Pay ${gbp(booking.balancePennies)}`;
      buttonUrl = payUrl;
      break;
  }

  return {
    subject: subjectFor(reminder.kind, biz),
    html: brandedEmail({ brand, businessName: biz, heading, bodyHtml, buttonLabel, buttonUrl }),
  };
}

export function labelForKind(kind: ReminderKind): string {
  switch (kind) {
    case "confirmation":
      return "Booking confirmation";
    case "reminder_24h":
      return "24-hour reminder";
    case "reminder_2h":
      return "2-hour reminder";
    case "balance_request":
      return "Balance request";
    case "patch_test_retest":
      return "Patch test re-test";
  }
}

function truncate(s: string, n = 200): string {
  const t = s.trim();
  return t.length > n ? t.slice(0, n - 1) + "\u2026" : t;
}

/** Unique subject per message so inbox apps don't collapse separate notifications into one thread. */
function messageEmailSubject(senderLabel: string, body: string): string {
  const preview = truncate(body, 55).replace(/\s+/g, " ");
  return `${senderLabel}: "${preview}"`;
}

/** Email a client that their tech sent them a message, linking to their thread. */
export async function notifyClientOfMessage(
  client: Client,
  tech: Tech,
  body: string,
  messageId: string,
): Promise<boolean> {
  if (!client.email?.trim()) return false;
  const biz = tech.businessName || "your beauty studio";
  const brand = tech.brandColor || "#db2777";
  const url = `${APP_URL}/m/${client.messageToken}`;
  const name = client.name?.split(" ")[0] ?? "there";
  const subject = messageEmailSubject(biz, body);
  const html = brandedEmail({
    brand,
    businessName: biz,
    heading: "You have a new message",
    bodyHtml: `Hi ${name},<br/><br/>${biz} sent you a message:<br/><br/><em>&ldquo;${truncate(body)}&rdquo;</em>`,
    buttonLabel: "View & reply",
    buttonUrl: url,
  });
  return sendEmail({
    to: client.email.trim(),
    subject,
    html,
    text: `${biz} sent you a message: "${truncate(body)}"\n\nView & reply: ${url}`,
    idempotencyKey: `message-notify/client/${messageId}`,
  });
}

/** Email a tech that a client replied, linking to the dashboard thread. */
export async function notifyTechOfMessage(
  tech: Tech,
  client: Client,
  body: string,
  messageId: string,
): Promise<void> {
  if (!tech.email) return;
  const brand = tech.brandColor || "#db2777";
  const url = `${APP_URL}/dashboard/messages/${client.id}`;
  const subject = messageEmailSubject(client.name, body);
  const html = brandedEmail({
    brand,
    businessName: tech.businessName || "Glow",
    heading: `New message from ${client.name}`,
    bodyHtml: `${client.name} replied:<br/><br/><em>&ldquo;${truncate(body)}&rdquo;</em>`,
    buttonLabel: "Open in dashboard",
    buttonUrl: url,
  });
  await sendEmail({
    to: tech.email,
    subject,
    html,
    text: `${client.name} replied: "${truncate(body)}"\n\nOpen: ${url}`,
    idempotencyKey: `message-notify/tech/${messageId}`,
  });
}

/** Notify a client their patch test is no longer valid after a product change. */
export async function notifyClientOfPatchTestRetest(opts: {
  sb: SupabaseClient;
  tech: Tech;
  client: Client;
  categoryName: string;
  categoryId: string;
  hasUpcoming: boolean;
  futureBooking: Booking | null;
}): Promise<{ email: boolean; sms: boolean }> {
  const { sb, tech, client, categoryName, categoryId, hasUpcoming, futureBooking } = opts;
  const biz = tech.businessName || "your beauty studio";
  const brand = tech.brandColor || "#db2777";
  const name = client.name?.split(" ")[0] ?? "there";
  const arrangeUrl = `${APP_URL}/${tech.handle}?retest=${categoryId}&pair=1`;
  const messageUrl = `${APP_URL}/m/${client.messageToken}`;

  const upcomingLine = hasUpcoming && futureBooking
    ? `You have an appointment coming up on <strong>${fmtDateTime(futureBooking.startIso)}</strong>. `
    : "";

  const bodyHtml =
    `Hi ${name},<br/><br/>` +
    `${biz} has changed products used for <strong>${categoryName}</strong>. ` +
    `${upcomingLine}You will need a quick patch test before your next treatment with us.<br/><br/>` +
    `Reply on your private message link or get in touch to arrange a convenient time.`;

  const text =
    `Hi ${name}, ${biz} has changed products for ${categoryName}. ` +
    `${hasUpcoming && futureBooking ? `You have an appointment on ${fmtDateTime(futureBooking.startIso)}. ` : ""}` +
    `You need a patch test before your next treatment. Arrange it: ${arrangeUrl} Message: ${messageUrl}`;

  const preview = text.slice(0, 200);
  const nowIso = new Date().toISOString();
  let email = false;
  let sms = false;

  if (client.email?.trim()) {
    const html = brandedEmail({
      brand,
      businessName: biz,
      heading: "Patch test needed",
      bodyHtml,
      buttonLabel: "Arrange your patch test",
      buttonUrl: arrangeUrl,
    });
    email = await sendEmail({
      to: client.email.trim(),
      subject: `${biz}: patch test needed before your appointment`,
      html,
      text,
      idempotencyKey: `patch-retest/${client.id}/${categoryId}/${nowIso.slice(0, 10)}`,
    });
  }

  if (smsConfigured() && client.phone) {
    const smsBody =
      `${biz}: we've changed products for ${categoryName}. ` +
      `${hasUpcoming ? "You have an appointment coming up. " : ""}` +
      `Please arrange a patch test: ${arrangeUrl}`;
    sms = await sendSms(client.phone, smsBody);
  }

  if (email || sms) {
    await createReminder(sb, {
      techId: tech.id,
      bookingId: futureBooking?.id ?? null,
      clientId: client.id,
      channel: sms && !email ? "sms" : "email",
      kind: "patch_test_retest",
      sendAtIso: nowIso,
      status: "sent",
      preview,
      sentAtIso: nowIso,
    });
  }

  return { email, sms };
}

/**
 * Aftercare email sent when an appointment is marked completed: the service's
 * aftercare card plus a one-tap rebook button (infill if one exists).
 */
export async function sendAftercareEmail(
  sb: SupabaseClient,
  booking: Booking,
): Promise<void> {
  const [client, service, tech] = await Promise.all([
    getClient(sb, booking.clientId),
    getService(sb, booking.serviceId),
    getTechById(sb, booking.techId),
  ]);
  if (!client?.email || !service || !tech) return;
  if (!service.aftercareText.trim()) return;

  // Prefer the matching infill service for the rebook button.
  const { listServices } = await import("@/lib/db/queries");
  const all = await listServices(sb, tech.id, { activeOnly: true });
  const infill =
    all.find((s) => s.isInfill && s.fullSetServiceId === service.id) ??
    all.find((s) => s.isInfill && s.categoryId === service.categoryId);
  const rebook = infill ?? service;
  const rebookUrl = `${APP_URL}/${tech.handle}?service=${rebook.id}`;

  const brand = tech.brandColor || "#db2777";
  const biz = tech.businessName || "your beauty studio";
  const name = client.name?.split(" ")[0] ?? "there";
  const aftercareHtml = service.aftercareText
    .split(/\r?\n/)
    .filter((l) => l.trim())
    .map((l) => `<p style="margin:6px 0">${l}</p>`)
    .join("");

  const html = brandedEmail({
    brand,
    businessName: biz,
    heading: `Your ${service.name} aftercare`,
    bodyHtml:
      `Hi ${name},<br/><br/>Thanks for coming in today! To keep your ${service.name.toLowerCase()} looking their best:` +
      `<div style="margin-top:12px;padding:14px 16px;background:#faf6f3;border-radius:12px;color:#564a5e">${aftercareHtml}</div>` +
      `<br/>Ready when you are - book your ${infill ? infill.name.toLowerCase() : "next appointment"} in a couple of taps.`,
    buttonLabel: infill ? `Book ${infill.name}` : "Book again",
    buttonUrl: rebookUrl,
  });
  await sendEmail({
    to: client.email,
    subject: `Aftercare for your ${service.name} + easy rebooking`,
    html,
    text: `Hi ${name}, aftercare for your ${service.name}:\n\n${service.aftercareText}\n\nBook your next appointment: ${rebookUrl}`,
    idempotencyKey: `aftercare/${booking.id}`,
  });
}

/** Render + send a reminder email via Resend, then record it. */
export async function sendReminder(sb: SupabaseClient, reminder: Reminder): Promise<void> {
  if (!reminder.bookingId) return;
  const booking = await getBooking(sb, reminder.bookingId);
  if (!booking) return;
  const [client, service, tech] = await Promise.all([
    getClient(sb, booking.clientId),
    getService(sb, booking.serviceId),
    getTechById(sb, booking.techId),
  ]);
  const ctx: Ctx = { reminder, booking, client, service, tech };
  const text = renderReminderText(ctx);
  const { subject, html } = renderReminderEmail(ctx);

  if (client?.email) {
    await sendEmail({ to: client.email, subject, html, text, idempotencyKey: `reminder/${reminder.id}` });
  }

  // SMS is where no-shows are actually prevented: clients read texts, not email.
  // Sent for the time-critical kinds when Twilio is configured.
  const SMS_KINDS: ReminderKind[] = ["reminder_24h", "reminder_2h", "balance_request"];
  if (smsConfigured() && client?.phone && SMS_KINDS.includes(reminder.kind)) {
    await sendSms(client.phone, text);
  }

  await markReminder(sb, reminder.id, {
    status: "sent",
    sentAtIso: new Date().toISOString(),
    preview: text,
  });
}

/**
 * One-off review request sent when an appointment is completed. Uses the
 * booking's private token so the client never needs an account.
 */
export async function sendReviewRequestEmail(sb: SupabaseClient, booking: Booking): Promise<void> {
  const [client, service, tech] = await Promise.all([
    getClient(sb, booking.clientId),
    getService(sb, booking.serviceId),
    getTechById(sb, booking.techId),
  ]);
  if (!client?.email || !tech) return;

  const biz = tech.businessName || "your beauty studio";
  const name = client.name?.split(" ")[0] ?? "there";
  const url = `${APP_URL}/review/${booking.balanceToken}`;
  const html = brandedEmail({
    brand: tech.brandColor || "#db2777",
    businessName: biz,
    heading: "How did it go?",
    bodyHtml: `Hi ${name},<br/><br/>Thanks for visiting ${biz}! If you have 30 seconds, a quick rating helps other clients find us - and helps ${biz} keep improving.`,
    buttonLabel: "Leave a quick review",
    buttonUrl: url,
  });
  await sendEmail({
    to: client.email,
    subject: `How was your ${service?.name ?? "appointment"}?`,
    html,
    text: `Hi ${name}, thanks for visiting ${biz}! Leave a quick review: ${url}`,
    idempotencyKey: `review-request/${booking.id}`,
  });
}

/** Email the tech when a client submits a booking that needs approval. */
export async function notifyTechOfBookingRequest(
  sb: SupabaseClient,
  booking: Booking,
  ctx?: { completedVisits?: number },
): Promise<void> {
  const [client, service, tech] = await Promise.all([
    getClient(sb, booking.clientId),
    getService(sb, booking.serviceId),
    getTechById(sb, booking.techId),
  ]);
  if (!tech?.email || !client || !service || !booking.approvalToken) return;

  const when = fmtDateTime(booking.startIso);
  const approveUrl = `${APP_URL}/approve/${booking.approvalToken}`;
  const brand = tech.brandColor || "#db2777";
  const riskLine = booking.riskTier
    ? `<br/><br/>Client risk: <strong>${riskTierLabel(booking.riskTier)}</strong>`
    : "";
  const visits = ctx?.completedVisits ?? 0;
  const signalParts: string[] = [];
  if (visits > 0) signalParts.push(`${visits} completed visit${visits === 1 ? "" : "s"}`);
  if (client.noShowCount > 0) signalParts.push(`${client.noShowCount} no-show${client.noShowCount === 1 ? "" : "s"}`);
  if (client.warningNote?.trim()) signalParts.push("warning on file");
  const signalLine = signalParts.length
    ? `<br/>${signalParts.join(" · ")}`
    : "<br/>New or unproven client";
  const html = brandedEmail({
    brand,
    businessName: tech.businessName || "Glow",
    heading: "New booking request",
    bodyHtml:
      `<strong>${client.name}</strong> requested <strong>${service.name}</strong> on <strong>${when}</strong>.` +
      `${riskLine}${signalLine}<br/><br/>Deposit if approved: <strong>${gbp(booking.depositPennies)}</strong> of ${gbp(booking.pricePennies)}.` +
      `<br/><br/>Approve to send them a deposit link (or confirm straight away if no deposit applies).`,
    buttonLabel: "Review & approve",
    buttonUrl: approveUrl,
  });
  await sendEmail({
    to: tech.email,
    subject: `Booking request from ${client.name}`,
    html,
    text: `${client.name} requested ${service.name} on ${when}. Deposit: ${gbp(booking.depositPennies)}. Approve: ${approveUrl}`,
    idempotencyKey: `booking-request/${booking.id}`,
  });
}

/** Client email after approval — deposit link or confirmation. */
export async function notifyClientBookingApproved(
  client: Client,
  tech: Tech,
  service: Service,
  booking: Booking,
): Promise<void> {
  if (!client.email) return;
  const brand = tech.brandColor || "#db2777";
  const biz = tech.businessName || "your beauty studio";
  const name = client.name?.split(" ")[0] ?? "there";
  const when = fmtDateTime(booking.startIso);
  const actionUrl = `${APP_URL}/${tech.handle}/booked/${booking.balanceToken}`;

  const needsDeposit = booking.status === "pending" && booking.depositPennies > 0;
  const html = brandedEmail({
    brand,
    businessName: biz,
    heading: needsDeposit ? "You're approved — pay your deposit" : "You're booked in!",
    bodyHtml: needsDeposit
      ? `Hi ${name},<br/><br/>${biz} approved your <strong>${service.name}</strong> for <strong>${when}</strong>.<br/><br/>Pay your <strong>${gbp(booking.depositPennies)}</strong> deposit now to secure the slot.`
      : `Hi ${name},<br/><br/>${biz} approved your <strong>${service.name}</strong> for <strong>${when}</strong>. See you then!`,
    buttonLabel: needsDeposit ? `Pay ${gbp(booking.depositPennies)} deposit` : "View booking",
    buttonUrl: actionUrl,
  });
  await sendEmail({
    to: client.email,
    subject: needsDeposit
      ? `${biz} approved your booking — deposit due`
      : `Your booking with ${biz} is confirmed`,
    html,
    text: needsDeposit
      ? `Hi ${name}, ${biz} approved your ${service.name} on ${when}. Pay your deposit: ${actionUrl}`
      : `Hi ${name}, your ${service.name} with ${biz} on ${when} is confirmed. ${actionUrl}`,
    idempotencyKey: `booking-approved/${booking.id}`,
  });
}

export async function notifyClientBookingDeclined(
  client: Client,
  tech: Tech,
  service: Service,
  booking: Booking,
): Promise<void> {
  if (!client.email) return;
  const brand = tech.brandColor || "#db2777";
  const biz = tech.businessName || "your beauty studio";
  const name = client.name?.split(" ")[0] ?? "there";
  const when = fmtDateTime(booking.startIso);
  const rebookUrl = `${APP_URL}/${tech.handle}?service=${service.id}`;
  const html = brandedEmail({
    brand,
    businessName: biz,
    heading: "Booking not available",
    bodyHtml: `Hi ${name},<br/><br/>Unfortunately ${biz} couldn't take your <strong>${service.name}</strong> request for <strong>${when}</strong>.<br/><br/>You're welcome to pick another time.`,
    buttonLabel: "Choose another time",
    buttonUrl: rebookUrl,
  });
  await sendEmail({
    to: client.email,
    subject: `Update on your booking request with ${biz}`,
    html,
    text: `Hi ${name}, ${biz} couldn't take your ${service.name} request for ${when}. Pick another time: ${rebookUrl}`,
    idempotencyKey: `booking-declined/${booking.id}`,
  });
}

/** 48-hour reaction check-in email/SMS with link to one-tap response page. */
export async function notifyClientOfReactionCheckin(
  sb: SupabaseClient,
  checkin: import("@/lib/db/types").ReactionCheckin,
): Promise<boolean> {
  const { getCategory } = await import("@/lib/db/queries");
  const [client, tech, category] = await Promise.all([
    getClient(sb, checkin.clientId),
    getTechById(sb, checkin.techId),
    getCategory(sb, checkin.categoryId),
  ]);
  if (!client || !tech) return false;
  if (!client.email?.trim() && !client.phone) return false;

  const biz = tech.businessName || "your beauty studio";
  const brand = tech.brandColor || "#db2777";
  const name = client.name?.split(" ")[0] ?? "there";
  const catName = category?.name?.toLowerCase() ?? "your treatment";
  const url = `${APP_URL}/checkin/${checkin.token}`;

  const bodyHtml =
    `Hi ${name},<br/><br/>` +
    `It's been 48 hours since your ${catName} patch test or treatment at ${biz}. ` +
    `Delayed reactions can sometimes show up around now.<br/><br/>` +
    `Are you experiencing any redness, swelling, itching or irritation?`;

  const text =
    `Hi ${name}, it's been 48 hours since your visit to ${biz}. ` +
    `Any redness, swelling or irritation? Let us know: ${url}`;

  let sent = false;

  if (client.email?.trim()) {
    const html = brandedEmail({
      brand,
      businessName: biz,
      heading: "Quick check-in",
      bodyHtml,
      buttonLabel: "Reply in one tap",
      buttonUrl: url,
    });
    sent = await sendEmail({
      to: client.email.trim(),
      subject: `${biz}: how is your skin after your ${catName} appointment?`,
      html,
      text,
      idempotencyKey: `reaction-checkin/${checkin.id}`,
    });
  }

  if (!sent && smsConfigured() && client.phone) {
    const smsBody =
      `Hi ${name}, ${biz} checking in 48h after your ${catName} appointment. ` +
      `Any redness or irritation? Reply here: ${url}`;
    sent = await sendSms(client.phone, smsBody);
  }

  return sent;
}

/** Alert the tech when a client reports a reaction via the check-in link. */
export async function notifyTechOfReactionReport(
  sb: SupabaseClient,
  checkin: import("@/lib/db/types").ReactionCheckin,
  symptoms: string,
): Promise<void> {
  const [client, tech] = await Promise.all([
    getClient(sb, checkin.clientId),
    getTechById(sb, checkin.techId),
  ]);
  if (!tech?.email || !client) return;

  const brand = tech.brandColor || "#db2777";
  const url = `${APP_URL}/dashboard/clients/${client.id}`;
  const html = brandedEmail({
    brand,
    businessName: tech.businessName || "Glow",
    heading: `${client.name} reported a reaction`,
    bodyHtml:
      `<strong>${client.name}</strong> responded to the 48-hour check-in and reported symptoms:<br/><br/>` +
      `<em>&ldquo;${truncate(symptoms || "Reaction reported")}&rdquo;</em><br/><br/>` +
      `A reaction record has been added to their client file.`,
    buttonLabel: "View client",
    buttonUrl: url,
  });
  await sendEmail({
    to: tech.email,
    subject: `Reaction reported: ${client.name}`,
    html,
    text: `${client.name} reported a reaction via the 48-hour check-in: "${truncate(symptoms)}"\n\nView: ${url}`,
    idempotencyKey: `reaction-checkin-report/${checkin.id}`,
  });
}

/** Remind a client their infill window is closing soon. */
export async function notifyClientOfInfillDeadline(
  tech: Tech,
  client: Client,
  infillService: Service,
  deadlineIso: string,
): Promise<boolean> {
  if (!client.email?.trim()) return false;

  const biz = tech.businessName || "your beauty studio";
  const brand = tech.brandColor || "#db2777";
  const name = client.name?.split(" ")[0] ?? "there";
  const deadline = fmtDate(deadlineIso);
  const url = `${APP_URL}/${tech.handle}?service=${infillService.id}`;
  const unsubUrl = `${APP_URL}/unsubscribe/${client.messageToken}`;
  const gapDays = infillService.infillMaxGapDays || 21;
  const daysSince = Math.max(gapDays - INFILL_NUDGE_LEAD_DAYS, 0);

  const html = brandedEmail({
    brand,
    businessName: biz,
    heading: "Your infill window is closing soon",
    bodyHtml:
      `Hi ${name},<br/><br/>` +
      `It's been about ${daysSince} days since your last appointment at ${biz}. ` +
      `You can still book a <strong>${infillService.name}</strong> until <strong>${deadline}</strong> ` +
      `before a full set is recommended.<br/><br/>` +
      `Grab a slot while infill pricing still applies.` +
      `<br/><br/><span style="font-size:12px;color:#8a7f91">Don't want these reminders? <a href="${unsubUrl}" style="color:#8a7f91">Unsubscribe here</a>. Appointment confirmations are unaffected.</span>`,
    buttonLabel: `Book ${infillService.name}`,
    buttonUrl: url,
  });

  return sendEmail({
    to: client.email.trim(),
    subject: `${biz}: book your infill before ${deadline}`,
    html,
    text:
      `Hi ${name}, your infill window at ${biz} closes on ${deadline}. ` +
      `Book ${infillService.name}: ${url}\n\nUnsubscribe: ${unsubUrl}`,
    idempotencyKey: `infill-deadline/${client.id}/${deadlineIso.slice(0, 10)}`,
  });
}

/** Tell a client their appointment will start later than planned. */
export async function notifyClientRunningLate(opts: {
  tech: Tech;
  client: Client;
  booking: Booking;
  service: Service | null;
  minutesLate: number;
  note?: string;
  eventId: string;
}): Promise<{ email: boolean; sms: boolean }> {
  const { tech, client, booking, service, minutesLate, note, eventId } = opts;
  const biz = tech.businessName || "your beauty studio";
  const brand = tech.brandColor || "#db2777";
  const name = client.name?.split(" ")[0] ?? "there";
  const when = fmtDateTime(booking.startIso);
  const svc = service?.name ?? "your appointment";
  const lateNote = note ? `<br/><br/><em>${truncate(note)}</em>` : "";
  const lateNoteText = note ? `\n\n${note}` : "";

  const bodyHtml =
    `Hi ${name},<br/><br/>` +
    `${biz} is running about <strong>${minutesLate} minutes late</strong> today. ` +
    `Your <strong>${svc}</strong> at <strong>${when}</strong> may start a little later than planned. ` +
    `Sorry for the inconvenience - we're on our way.${lateNote}`;

  const text =
    `Hi ${name}, ${biz} is running about ${minutesLate} minutes late. ` +
    `Your ${svc} at ${when} may start later than planned.${lateNoteText}`;

  let email = false;
  let sms = false;

  if (client.email?.trim()) {
    const html = brandedEmail({
      brand,
      businessName: biz,
      heading: "Running a little late",
      bodyHtml,
    });
    email = await sendEmail({
      to: client.email.trim(),
      subject: `${biz}: running ~${minutesLate} min late for your appointment`,
      html,
      text,
      idempotencyKey: `late-cascade/${eventId}/${booking.id}/email`,
    });
  }

  if (smsConfigured() && client.phone) {
    sms = await sendSms(
      client.phone,
      `${biz}: running ~${minutesLate} min late today. Your ${svc} at ${fmtTime(booking.startIso)} may start later. Sorry!${lateNoteText}`,
    );
  }

  return { email, sms };
}

function precareHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br/>");
}

/** Pre-care instructions email/SMS with link to confirm the client has read them. */
export async function notifyClientOfPreCare(
  tech: Tech,
  client: Client,
  booking: Booking,
  service: Service,
  row: import("@/lib/db/types").PreCareConfirmation,
): Promise<boolean> {
  const instructions = service.precareText?.trim();
  if (!instructions) return false;
  if (!client.email?.trim() && !client.phone) return false;

  const biz = tech.businessName || "your beauty studio";
  const brand = tech.brandColor || "#db2777";
  const name = client.name?.split(" ")[0] ?? "there";
  const when = fmtDateTime(booking.startIso);
  const url = `${APP_URL}/precare/${row.token}`;
  const instructionsHtml = precareHtml(instructions);

  const bodyHtml =
    `Hi ${name},<br/><br/>` +
    `Before your <strong>${service.name}</strong> on <strong>${when}</strong>, please read the preparation notes below.<br/><br/>` +
    `<div style="margin-top:12px;padding:14px 16px;background:#faf6f3;border-radius:12px;color:#564a5e">${instructionsHtml}</div>` +
    `<br/>Tap the button to confirm you&apos;ve read and understood them.`;

  const text =
    `Hi ${name}, prep for your ${service.name} on ${when} at ${biz}:\n\n` +
    `${instructions}\n\nConfirm you've read this: ${url}`;

  let sent = false;

  if (client.email?.trim()) {
    const html = brandedEmail({
      brand,
      businessName: biz,
      heading: "Before your appointment",
      bodyHtml,
      buttonLabel: "I've read and understood",
      buttonUrl: url,
    });
    sent = await sendEmail({
      to: client.email.trim(),
      subject: `${biz}: prep for your ${service.name} appointment`,
      html,
      text,
      idempotencyKey: `precare/${row.id}`,
    });
  }

  if (!sent && smsConfigured() && client.phone) {
    const smsBody =
      `Hi ${name}, ${biz}: prep for your ${service.name} on ${fmtTime(booking.startIso)}. ` +
      `Please read and confirm: ${url}`;
    sent = await sendSms(client.phone, smsBody);
  }

  return sent;
}
