"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import type { ApprovalMode } from "@/lib/db/types";
import { fromZonedTime } from "date-fns-tz";
import { TZ, poundsToPennies } from "@/lib/format";
import { getDashboardContext, invalidateDashboardTech } from "@/lib/auth/session";
import { supabaseService } from "@/lib/supabase/service";
import { slugify } from "@/lib/utils";
import { randomId, randomToken } from "@/lib/ids";
import {
  createAccountClosureRequest,
  createAuditEvent,
  createCategory,
  createClient,
  createPatchTest,
  createService,
  createTimeOff,
  deleteService,
  deleteTimeOff,
  findOrCreateClient,
  getBooking,
  getCategory,
  getClient,
  getService,
  getTechByHandle,
  getTechById,
  listBookings,
  listCategories,
  listServices,
  createPayment,
  paymentsForBooking,
  replaceWorkingHours,
  updateBooking,
  updateClient,
  updateService,
  updateTech,
} from "@/lib/db/queries";
import { isUniqueViolation } from "@/lib/db/errors";
import {
  createClientPhoto,
  createQuestion,
  deleteClientPhoto,
  deleteQuestion,
  getClientPhoto,
} from "@/lib/db/queries";
import { uploadPhoto, removePhoto } from "@/lib/storage";
import { createConfirmedBooking } from "@/lib/bookings";
import {
  deleteGoogleEventForBooking,
  googleConnected,
  syncBookingToGoogle,
  syncUpcomingBookingsToGoogle,
} from "@/lib/google-calendar";
import { refundOnConnect } from "@/lib/payments";
import { processDueReminders } from "@/lib/scheduler";
import type { PhotoKind, Service } from "@/lib/db/types";
import type { BookingStatus, DepositType, QuestionType, WorkingHour } from "@/lib/db/types";
import type { SupabaseClient } from "@supabase/supabase-js";

async function ctx() {
  const c = await getDashboardContext();
  if (!c) redirect("/login");
  return c;
}

async function audit(
  sb: Awaited<ReturnType<typeof ctx>>["sb"],
  techId: string,
  action: string,
  entityType: string,
  entityId: string,
  metadata: Record<string, unknown> = {},
  actor: "tech" | "client" | "system" = "tech",
) {
  try {
    await createAuditEvent(sb, { techId, actor, action, entityType, entityId, metadata });
  } catch {
    // Audit logging must never block the primary workflow if a migration is pending.
  }
}

export async function changePasswordAction(formData: FormData) {
  const { sb, tech } = await ctx();
  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (next.length < 8) redirect("/dashboard/settings?pwerr=short");
  if (next !== confirm) redirect("/dashboard/settings?pwerr=match");

  // Verify the current password with a throwaway client so a hijacked
  // session alone can't silently change the password.
  const { createClient: createBareClient } = await import("@supabase/supabase-js");
  const bare = createBareClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: authErr } = await bare.auth.signInWithPassword({
    email: tech.email,
    password: current,
  });
  if (authErr) redirect("/dashboard/settings?pwerr=wrong");

  const { error } = await sb.auth.updateUser({ password: next });
  if (error) redirect("/dashboard/settings?pwerr=failed");
  redirect("/dashboard/settings?pw=1");
}

function toIso(localValue: string): string {
  return fromZonedTime(localValue, TZ).toISOString();
}

function clampInt(v: string, min: number, max: number, fallback: number): number {
  const n = parseInt(v, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function safeDashboardReturn(
  formData: FormData,
  fallback = "/dashboard/bookings",
): string {
  const returnTo = String(formData.get("returnTo") ?? fallback).trim();
  return returnTo.startsWith("/dashboard") ? returnTo : fallback;
}

function hhmmToMin(s: string): number {
  const [h, m] = s.split(":").map((x) => parseInt(x, 10));
  return (h || 0) * 60 + (m || 0);
}

// ---------------- Settings ----------------
export async function updateSettingsAction(formData: FormData) {
  const { sb, tech } = await ctx();
  const get = (k: string) => String(formData.get(k) ?? "").trim();

  let handle = slugify(get("handle"));
  if (handle && handle !== tech.handle) {
    // Handle uniqueness is global: check with the service client.
    const admin = supabaseService();
    let candidate = handle;
    let n = 1;
    while (true) {
      const clash = await getTechByHandle(admin, candidate);
      if (!clash || clash.id === tech.id) break;
      candidate = `${handle}${n++}`;
    }
    handle = candidate;
  } else {
    handle = tech.handle;
  }

  const approvalRaw = get("approvalMode");
  const approvalMode: ApprovalMode =
    approvalRaw === "manual" || approvalRaw === "rules" ? approvalRaw : "off";

  const parsePolicy = (
    typeKey: string,
    valueKey: string,
    opts: { allowNone?: boolean; percentMax?: number; fallbackPct: number; fallbackType?: DepositType | "percent" | "fixed" },
  ) => {
    const allowNone = opts.allowNone ?? false;
    const rawType = get(typeKey);
    const type: DepositType | "percent" | "fixed" =
      rawType === "fixed" || rawType === "percent" || (allowNone && rawType === "none")
        ? (rawType as DepositType)
        : (opts.fallbackType ?? "percent");
    const raw = get(valueKey);
    if (type === "none") return { type: "none" as const, value: 0, pctMirror: 0 };
    if (type === "fixed") {
      const pennies = poundsToPennies(raw);
      return { type: "fixed" as const, value: pennies, pctMirror: opts.fallbackPct };
    }
    const pct = clampInt(raw, 0, opts.percentMax ?? 100, opts.fallbackPct);
    return { type: "percent" as const, value: pct, pctMirror: pct };
  };

  const defaultDeposit = parsePolicy("defaultDepositType", "defaultDepositValue", {
    allowNone: true,
    fallbackPct: tech.defaultDepositPct,
    fallbackType: tech.defaultDepositType ?? "percent",
  });
  const noShowFee = parsePolicy("noShowFeeType", "noShowFeeValue", {
    fallbackPct: tech.noShowFeePct,
    fallbackType: tech.noShowFeeType ?? "percent",
  });
  const mediumTier = parsePolicy("depositTierMediumType", "depositTierMediumValue", {
    fallbackPct: tech.depositTierMediumPct ?? 50,
    fallbackType: tech.depositTierMediumType ?? "percent",
  });
  const highTier = parsePolicy("depositTierHighType", "depositTierHighValue", {
    fallbackPct: tech.depositTierHighPct ?? 100,
    fallbackType: tech.depositTierHighType ?? "percent",
  });
  const loyalty = parsePolicy("loyaltyDiscountType", "loyaltyDiscountValue", {
    percentMax: 50,
    fallbackPct: tech.loyaltyDiscountPct,
    fallbackType: tech.loyaltyDiscountType ?? "percent",
  });

  await updateTech(sb, tech.id, {
    businessName: get("businessName") || tech.businessName,
    name: get("name"),
    handle,
    bio: get("bio"),
    tagline: get("tagline"),
    brandColor: get("brandColor") || tech.brandColor,
    instagram: get("instagram").replace(/^@/, ""),
    tiktok: get("tiktok").replace(/^@/, ""),
    location: get("location"),
    defaultDepositType: defaultDeposit.type,
    defaultDepositValue: defaultDeposit.value,
    defaultDepositPct: defaultDeposit.type === "percent" ? defaultDeposit.value : tech.defaultDepositPct,
    cancellationWindowHours: clampInt(get("cancellationWindowHours"), 0, 336, tech.cancellationWindowHours),
    loyaltyVisitThreshold: clampInt(get("loyaltyVisitThreshold"), 0, 100, tech.loyaltyVisitThreshold),
    loyaltyDiscountType: loyalty.type === "none" ? "percent" : loyalty.type,
    loyaltyDiscountValue: loyalty.value,
    loyaltyDiscountPct: loyalty.type === "percent" ? loyalty.value : tech.loyaltyDiscountPct,
    noShowFeeType: noShowFee.type === "none" ? "percent" : noShowFee.type,
    noShowFeeValue: noShowFee.value,
    noShowFeePct: noShowFee.type === "percent" ? noShowFee.value : tech.noShowFeePct,
    // Only present on settings forms that render the control (marker field),
    // so stale tabs from before the deploy can't silently reset the choice.
    ...(formData.get("noShowProtectionField") === "1"
      ? {
          noShowProtection:
            formData.get("noShowProtection") === "card_capture"
              ? ("card_capture" as const)
              : ("deposit" as const),
        }
      : {}),
    rebookNudgesEnabled: formData.get("rebookNudgesEnabled") === "on",
    infillNudgesEnabled: formData.get("infillNudgesEnabled") === "on",
    preCareConfirmationsEnabled: formData.get("preCareConfirmationsEnabled") === "on",
    // Only present when the Settings SMS control is shown (platform Twilio on).
    ...(formData.get("smsRemindersField") === "1"
      ? { smsRemindersEnabled: formData.get("smsRemindersEnabled") === "on" }
      : {}),
    approvalMode,
    requiresBookingApproval: approvalMode === "manual",
    autoApproveMinVisits: clampInt(get("autoApproveMinVisits"), 1, 20, tech.autoApproveMinVisits ?? 2),
    depositTierMediumType: mediumTier.type === "none" ? "percent" : mediumTier.type,
    depositTierMediumValue: mediumTier.value,
    depositTierMediumPct: mediumTier.type === "percent" ? mediumTier.value : tech.depositTierMediumPct ?? 50,
    depositTierHighType: highTier.type === "none" ? "percent" : highTier.type,
    depositTierHighValue: highTier.value,
    depositTierHighPct: highTier.type === "percent" ? highTier.value : tech.depositTierHighPct ?? 100,
  });
  revalidatePath("/dashboard/settings");
  revalidatePath(`/${handle}`);
  invalidateDashboardTech(tech.authUserId);
  redirect("/dashboard/settings?saved=1");
}

// Uploads are resized in the browser first (see lib/image-prepare.ts); this is
// the server-side backstop, kept under the server action body size limit.
const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

async function uploadBrandImage(
  tech: { id: string; handle: string; authUserId: string | null },
  file: File,
  kind: "cover" | "profile",
): Promise<string> {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `brand/${tech.id}/${kind}.${ext}`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  await uploadPhoto(path, bytes, file.type || "image/jpeg", { upsert: true });
  return path;
}

export async function uploadBrandCoverAction(formData: FormData) {
  const { sb, tech } = await ctx();
  const file = formData.get("cover") as File | null;
  if (!file || file.size === 0) redirect("/dashboard/settings?photoerr=1");
  if (file.size > MAX_PHOTO_BYTES) redirect("/dashboard/settings?photoerr=size");
  try {
    if (tech.coverPhotoPath) await removePhoto(tech.coverPhotoPath).catch(() => {});
    const path = await uploadBrandImage(tech, file, "cover");
    await updateTech(sb, tech.id, { coverPhotoPath: path });
    revalidatePath("/dashboard/settings");
    revalidatePath(`/${tech.handle}`);
    invalidateDashboardTech(tech.authUserId);
    redirect("/dashboard/settings?cover=1");
  } catch {
    redirect("/dashboard/settings?photoerr=1");
  }
}

export async function uploadBrandProfileAction(formData: FormData) {
  const { sb, tech } = await ctx();
  const file = formData.get("profile") as File | null;
  if (!file || file.size === 0) redirect("/dashboard/settings?photoerr=1");
  if (file.size > MAX_PHOTO_BYTES) redirect("/dashboard/settings?photoerr=size");
  try {
    if (tech.profilePhotoPath) await removePhoto(tech.profilePhotoPath).catch(() => {});
    const path = await uploadBrandImage(tech, file, "profile");
    await updateTech(sb, tech.id, { profilePhotoPath: path });
    revalidatePath("/dashboard/settings");
    revalidatePath(`/${tech.handle}`);
    invalidateDashboardTech(tech.authUserId);
    redirect("/dashboard/settings?profile=1");
  } catch {
    redirect("/dashboard/settings?photoerr=1");
  }
}

export async function removeBrandCoverAction() {
  const { sb, tech } = await ctx();
  if (tech.coverPhotoPath) {
    await removePhoto(tech.coverPhotoPath).catch(() => {});
    await updateTech(sb, tech.id, { coverPhotoPath: null });
  }
  revalidatePath("/dashboard/settings");
  revalidatePath(`/${tech.handle}`);
  invalidateDashboardTech(tech.authUserId);
  redirect("/dashboard/settings?cover=removed");
}

export async function removeBrandProfileAction() {
  const { sb, tech } = await ctx();
  if (tech.profilePhotoPath) {
    await removePhoto(tech.profilePhotoPath).catch(() => {});
    await updateTech(sb, tech.id, { profilePhotoPath: null });
  }
  revalidatePath("/dashboard/settings");
  revalidatePath(`/${tech.handle}`);
  invalidateDashboardTech(tech.authUserId);
  redirect("/dashboard/settings?profile=removed");
}

export async function ensureCalendarTokenAction() {
  const { sb, tech } = await ctx();
  if (!tech.calendarToken) {
    await updateTech(sb, tech.id, { calendarToken: randomToken() });
    await audit(sb, tech.id, "calendar_token_created", "tech", tech.id);
  }
  revalidatePath("/dashboard/settings");
  redirect("/dashboard/settings?calendar=1");
}

export async function requestAccountClosureAction(formData: FormData) {
  const c = await ctx();
  // Only the owner can ask to close the whole account.
  if (c.role !== "owner") redirect("/dashboard");
  const { sb, tech } = c;
  const reason = String(formData.get("reason") ?? "").trim();
  const requestedAt = new Date().toISOString();
  await updateTech(sb, tech.id, { closureRequestedAt: requestedAt, closureReason: reason });
  await createAccountClosureRequest(sb, { techId: tech.id, reason });
  await audit(sb, tech.id, "account_closure_requested", "tech", tech.id, { reason });
  revalidatePath("/dashboard/settings");
  redirect("/dashboard/settings?closure=1");
}

// ---------------- Feedback / ideas ----------------
export async function submitFeedbackAction(formData: FormData) {
  const { sb, tech } = await ctx();
  const { rateLimit } = await import("@/lib/rate-limit");
  if (!(await rateLimit("feedback", { limit: 5, windowMinutes: 60 })).ok) {
    redirect("/dashboard/feedback?sent=1");
  }

  const topic = String(formData.get("topic") ?? "idea").slice(0, 40);
  const message = String(formData.get("message") ?? "").trim().slice(0, 4000);
  if (!message) redirect("/dashboard/feedback");

  const TOPIC_LABEL: Record<string, string> = {
    idea: "Feature idea",
    annoying: "Annoying / confusing",
    broken: "Looks broken",
    other: "Other",
  };
  const label = TOPIC_LABEL[topic] ?? "Feedback";
  const to = process.env.FEEDBACK_EMAIL ?? process.env.OPS_ALERT_EMAIL ?? "support@glow-uk.com";
  const { sendEmail } = await import("@/lib/email");
  await sendEmail({
    to,
    replyTo: tech.email,
    subject: `[Glow feedback] ${label} from ${tech.businessName || tech.handle}`,
    html: `<p><strong>${label}</strong> from <strong>${tech.businessName}</strong> (${tech.name || "no name"} · ${tech.email} · glow.app/${tech.handle})</p><p style="white-space:pre-wrap">${message
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")}</p>`,
    text: `${label} from ${tech.businessName} (${tech.name} · ${tech.email} · glow.app/${tech.handle})\n\n${message}`,
  });
  await audit(sb, tech.id, "feedback_submitted", "tech", tech.id, { topic });
  redirect("/dashboard/feedback?sent=1");
}

// ---------------- Waitlist ----------------
export async function deleteWaitlistEntryAction(formData: FormData) {
  const { sb } = await ctx();
  const id = String(formData.get("id") ?? "");
  const { deleteWaitlistEntry } = await import("@/lib/db/queries");
  await deleteWaitlistEntry(sb, id);
  revalidatePath("/dashboard/bookings");
  redirect("/dashboard/bookings");
}

// ---------------- Reviews ----------------
export async function setReviewStatusAction(formData: FormData) {
  const { sb, tech } = await ctx();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (status === "approved" || status === "hidden" || status === "pending") {
    const { updateReview } = await import("@/lib/db/queries");
    await updateReview(sb, id, { status });
    await audit(sb, tech.id, "review_status_changed", "review", id, { status });
    revalidatePath("/dashboard/reviews");
    revalidatePath(`/${tech.handle}`);
  }
  redirect("/dashboard/reviews");
}

export async function deleteReviewAction(formData: FormData) {
  const { sb, tech } = await ctx();
  const id = String(formData.get("id") ?? "");
  const { deleteReview } = await import("@/lib/db/queries");
  await deleteReview(sb, id);
  await audit(sb, tech.id, "review_deleted", "review", id);
  revalidatePath("/dashboard/reviews");
  revalidatePath(`/${tech.handle}`);
  redirect("/dashboard/reviews");
}

export async function disconnectGoogleCalendarAction() {
  const { sb, tech } = await ctx();
  await updateTech(sb, tech.id, {
    googleRefreshToken: null,
    googleCalendarId: null,
    googleCalendarEmail: null,
    googleConnectedAt: null,
  });
  await audit(sb, tech.id, "google_calendar_disconnected", "tech", tech.id);
  revalidatePath("/dashboard/settings");
  redirect("/dashboard/settings?google=disconnected");
}

/** Push all upcoming confirmed bookings to Google Calendar (backfill + repair). */
export async function syncGoogleCalendarAction() {
  const { sb, tech } = await ctx();
  const fresh = (await getTechById(sb, tech.id)) ?? tech;
  if (!googleConnected(fresh)) redirect("/dashboard/settings?google=not_connected");
  try {
    const result = await syncUpcomingBookingsToGoogle(sb, fresh);
    await audit(sb, tech.id, "google_calendar_sync", "tech", tech.id, result);
    invalidateDashboardTech(tech.authUserId);
    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard/bookings");
    redirect(
      `/dashboard/settings?google=synced&synced=${result.synced}&failed=${result.failed}&skipped=${result.skipped}`,
    );
  } catch (err) {
    const message = encodeURIComponent(err instanceof Error ? err.message : "sync_failed");
    redirect(`/dashboard/settings?google=sync_error&reason=${message}`);
  }
}

/** Push one booking to Google Calendar. */
export async function syncBookingGoogleAction(formData: FormData) {
  const { sb, tech } = await ctx();
  const id = String(formData.get("id") ?? "");
  const booking = await getBooking(sb, id);
  if (!booking || booking.techId !== tech.id) redirect("/dashboard/bookings");
  if (!googleConnected(tech)) redirect(`/dashboard/bookings/${id}?google=not_connected`);

  const result = await syncBookingToGoogle(sb, tech, booking);
  await audit(sb, tech.id, "google_calendar_booking_sync", "booking", id, {
    ok: result.ok,
    reason: "reason" in result ? result.reason : undefined,
    eventId: "eventId" in result ? result.eventId : undefined,
  });
  revalidatePath(`/dashboard/bookings/${id}`);
  redirect(
    `/dashboard/bookings/${id}?google=${result.ok ? "synced" : "failed"}${!result.ok && "reason" in result ? `&reason=${encodeURIComponent(result.reason)}` : ""}`,
  );
}

// ---------------- Availability ----------------
export async function saveAvailabilityAction(formData: FormData) {
  const { sb, tech } = await ctx();
  // The "Opening hours" page edits the OWNER's diary; other staff members'
  // hours are managed from the Team page.
  const { getOrCreateOwnerStaff } = await import("@/lib/booking/staff");
  const owner = await getOrCreateOwnerStaff(supabaseService(), tech).catch(() => null);
  const flexibleHoursEnabled = formData.get("flexibleHoursEnabled") === "on";
  const flexLastRaw = String(formData.get("flexibleLast") ?? "").trim();
  let flexibleStartMinutes = hhmmToMin(String(formData.get("flexibleStart") ?? "09:00"));
  let flexibleEndMinutes = hhmmToMin(String(formData.get("flexibleEnd") ?? "20:00"));
  if (!(flexibleEndMinutes > flexibleStartMinutes)) {
    flexibleStartMinutes = 9 * 60;
    flexibleEndMinutes = 20 * 60;
  }
  const rows: WorkingHour[] = [];
  for (let weekday = 0; weekday <= 6; weekday++) {
    const lastRaw = String(formData.get(`last_${weekday}`) ?? "").trim();
    rows.push({
      id: randomId("wh"),
      techId: tech.id,
      staffId: owner?.id ?? null,
      weekday,
      startMinutes: hhmmToMin(String(formData.get(`start_${weekday}`) ?? "09:00")),
      endMinutes: hhmmToMin(String(formData.get(`end_${weekday}`) ?? "17:00")),
      lastStartMinutes: lastRaw ? hhmmToMin(lastRaw) : null,
      enabled: formData.get(`enabled_${weekday}`) === "on",
    });
  }
  await updateTech(sb, tech.id, {
    flexibleHoursEnabled,
    flexibleStartMinutes,
    flexibleEndMinutes,
    flexibleLastStartMinutes: flexLastRaw ? hhmmToMin(flexLastRaw) : null,
  });
  await replaceWorkingHours(sb, tech.id, rows, owner?.id);
  invalidateDashboardTech(tech.authUserId);
  revalidatePath("/dashboard/availability");
  revalidatePath(`/${tech.handle}`);
  redirect("/dashboard/availability?saved=1");
}

export async function addTimeOffAction(formData: FormData) {
  const { sb, tech } = await ctx();
  const start = String(formData.get("start") ?? "");
  const end = String(formData.get("end") ?? "");
  if (start && end) {
    await createTimeOff(sb, {
      techId: tech.id,
      startIso: toIso(start),
      endIso: toIso(end),
      reason: String(formData.get("reason") ?? "").trim(),
    });
  }
  revalidatePath("/dashboard/availability");
  redirect("/dashboard/availability");
}

export async function deleteTimeOffAction(formData: FormData) {
  const { sb } = await ctx();
  await deleteTimeOff(sb, String(formData.get("id") ?? ""));
  revalidatePath("/dashboard/availability");
  redirect("/dashboard/availability");
}

// ---------------- Categories ----------------
export async function addCategoryAction(formData: FormData) {
  const { sb, tech } = await ctx();
  const name = String(formData.get("name") ?? "").trim();
  if (name) {
    // Double-click guard: one category per name.
    const existing = await listCategories(sb, tech.id);
    if (!existing.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      await createCategory(sb, {
        techId: tech.id,
        name,
        patchTestValidityDays: clampInt(String(formData.get("validityDays") ?? ""), 1, 3650, 180),
        patchTestMinLeadHours: clampInt(String(formData.get("minLeadHours") ?? ""), 0, 336, 24),
      });
    }
  }
  revalidatePath("/dashboard/services");
  redirect("/dashboard/services");
}

// ---------------- Services ----------------
export async function saveServiceAction(formData: FormData) {
  const { sb, tech } = await ctx();
  const id = String(formData.get("id") ?? "");
  const depositType = String(formData.get("depositType") ?? "percent") as DepositType;
  const depositRaw = String(formData.get("depositValue") ?? "0");
  const depositValue =
    depositType === "fixed" ? poundsToPennies(depositRaw) : clampInt(depositRaw, 0, 100, 0);
  const fullSet = String(formData.get("fullSetServiceId") ?? "");

  const data = {
    techId: tech.id,
    categoryId: String(formData.get("categoryId") ?? ""),
    name: String(formData.get("name") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim(),
    durationMin: clampInt(String(formData.get("durationMin") ?? "60"), 5, 600, 60),
    pricePennies: poundsToPennies(String(formData.get("price") ?? "0")),
    depositType,
    depositValue,
    requiresPatchTest: formData.get("requiresPatchTest") === "on",
    isPatchTestService: formData.get("isPatchTestService") === "on",
    isInfill: formData.get("isInfill") === "on",
    fullSetServiceId: fullSet || null,
    infillMaxGapDays: clampInt(String(formData.get("infillMaxGapDays") ?? "21"), 1, 365, 21),
    active: formData.get("active") === "on",
    sortOrder: clampInt(String(formData.get("sortOrder") ?? "0"), 0, 999, 0),
    aftercareText: String(formData.get("aftercareText") ?? "").trim(),
    precareText: String(formData.get("precareText") ?? "").trim(),
  };

  if (!data.name || !data.categoryId) {
    redirect("/dashboard/services?error=missing");
  }

  const existing = id ? await getService(sb, id) : null;
  let serviceId = id;
  if (existing) {
    await updateService(sb, id, data);
  } else {
    const created = await createService(sb, data);
    serviceId = created.id;
  }

  // Optional photo included with the form (create flow offers it inline).
  const photo = formData.get("photo") as File | null;
  if (serviceId && photo && photo.size > 0 && photo.size <= MAX_PHOTO_BYTES) {
    try {
      const ext = (photo.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
      const path = `svc/${tech.id}/${serviceId}.${ext}`;
      const bytes = new Uint8Array(await photo.arrayBuffer());
      await uploadPhoto(path, bytes, photo.type || "image/jpeg", { upsert: true });
      await updateService(sb, serviceId, { photoPath: path });
    } catch {
      // The service is saved either way; the photo can be added from the edit panel.
    }
  }

  revalidatePath("/dashboard/services");
  revalidatePath(`/${tech.handle}`);
  redirect(existing ? `/dashboard/services?saved=1&open=${id}` : "/dashboard/services?saved=1");
}

/** Move a service up/down in the list (dashboard + public booking page order). */
export async function moveServiceAction(formData: FormData) {
  const { sb, tech } = await ctx();
  const id = String(formData.get("id") ?? "");
  const dir = formData.get("dir") === "up" ? -1 : 1;

  const services = await listServices(sb, tech.id);
  const idx = services.findIndex((s) => s.id === id);
  const target = idx + dir;
  if (idx !== -1 && target >= 0 && target < services.length) {
    const order = services.map((s) => s.id);
    [order[idx], order[target]] = [order[target], order[idx]];
    await applyServiceOrder(sb, tech.id, order, services);
    revalidatePath("/dashboard/services");
    revalidatePath(`/${tech.handle}`);
  }
  redirect("/dashboard/services");
}

/** Drag-and-drop reorder — no page reload. */
export async function reorderServicesAction(order: string[]): Promise<{ ok: boolean }> {
  const { sb, tech } = await ctx();
  const services = await listServices(sb, tech.id);
  const owned = new Set(services.map((s) => s.id));
  if (order.length !== services.length || order.some((id) => !owned.has(id))) {
    return { ok: false };
  }
  await applyServiceOrder(sb, tech.id, order, services);
  revalidatePath("/dashboard/services");
  revalidatePath(`/${tech.handle}`);
  return { ok: true };
}

async function applyServiceOrder(
  sb: SupabaseClient,
  techId: string,
  order: string[],
  services: Service[],
) {
  await Promise.all(
    order.map((sid, i) => {
      const service = services.find((s) => s.id === sid);
      if (!service || service.techId !== techId || service.sortOrder === i) return null;
      return updateService(sb, sid, { sortOrder: i });
    }),
  );
}

export async function deleteServiceAction(formData: FormData) {
  const { sb, tech } = await ctx();
  const id = String(formData.get("id") ?? "");
  const service = await getService(sb, id);
  if (!service || service.techId !== tech.id) redirect("/dashboard/services");
  await deleteService(sb, id);
  revalidatePath("/dashboard/services");
  revalidatePath("/dashboard/bookings");
  revalidatePath(`/${tech.handle}`);
  redirect("/dashboard/services");
}

// ---------------- Clients ----------------
export async function addClientAction(formData: FormData) {
  const { sb, tech } = await ctx();
  const name = String(formData.get("name") ?? "").trim();
  if (name) {
    await createClient(sb, {
      techId: tech.id,
      name,
      email: String(formData.get("email") ?? "").trim(),
      phone: String(formData.get("phone") ?? "").trim(),
      notes: String(formData.get("notes") ?? "").trim(),
    });
  }
  revalidatePath("/dashboard/clients");
  redirect("/dashboard/clients");
}

export async function updateClientAction(formData: FormData) {
  const { sb } = await ctx();
  const id = String(formData.get("id") ?? "");
  const client = await getClient(sb, id);
  if (client) {
    await updateClient(sb, id, {
      name: String(formData.get("name") ?? client.name).trim() || client.name,
      email: String(formData.get("email") ?? "").trim(),
      phone: String(formData.get("phone") ?? "").trim(),
      notes: String(formData.get("notes") ?? "").trim(),
      warningNote: String(formData.get("warningNote") ?? "").trim(),
      isBlacklisted: formData.get("isBlacklisted") === "on",
      isVip: formData.get("isVip") === "on",
    });
  }
  revalidatePath(`/dashboard/clients/${id}`);
  revalidatePath("/dashboard/clients");
  redirect(`/dashboard/clients/${id}`);
}

export async function toggleBlacklistAction(formData: FormData) {
  const { sb } = await ctx();
  const id = String(formData.get("id") ?? "");
  const client = await getClient(sb, id);
  if (client) await updateClient(sb, id, { isBlacklisted: !client.isBlacklisted });
  revalidatePath(`/dashboard/clients/${id}`);
  redirect(`/dashboard/clients/${id}`);
}

// ---------------- Patch tests ----------------
export async function productChangeAction(formData: FormData) {
  const { sb, tech } = await ctx();
  const { executeProductChange } = await import("@/lib/product-change");
  const categoryIds = formData.getAll("categoryId").map(String).filter(Boolean);
  const serviceIds = formData.getAll("serviceId").map(String).filter(Boolean);
  const note = String(formData.get("note") ?? "").trim();
  const newProductId = String(formData.get("newBatchProductId") ?? "").trim();
  const lotNumber = String(formData.get("newBatchLot") ?? "").trim();
  const expiresAt = String(formData.get("newBatchExpires") ?? "").trim();
  try {
    const result = await executeProductChange(sb, tech, {
      categoryIds,
      serviceIds,
      note,
      newBatch: newProductId
        ? {
            productId: newProductId,
            lotNumber: lotNumber || undefined,
            expiresAtIso: expiresAt ? fromZonedTime(`${expiresAt}T23:59:59`, TZ).toISOString() : undefined,
          }
        : undefined,
    });
    revalidatePath("/dashboard/services");
    revalidatePath("/dashboard/reminders");
    redirect(
      `/dashboard/services?retest=1&affected=${result.affectedClients}&notified=${result.clientsNotified}&invalidated=${result.invalidatedCount}`,
    );
  } catch (err) {
    redirect(`/dashboard/services?retesterr=${encodeURIComponent((err as Error).message)}`);
  }
}

export async function addPatchTestAction(formData: FormData) {
  const { sb, tech } = await ctx();
  const clientId = String(formData.get("clientId") ?? "");
  const categoryId = String(formData.get("categoryId") ?? "");
  const performedDate = String(formData.get("performedAt") ?? "");
  const result = String(formData.get("result") ?? "pass") as "pending" | "pass" | "fail";
  const batchId = String(formData.get("batchId") ?? "").trim();
  const category = categoryId ? await getCategory(sb, categoryId) : null;
  if (clientId && category && performedDate) {
    const performed = fromZonedTime(`${performedDate}T12:00:00`, TZ);
    const expires = new Date(performed.getTime() + category.patchTestValidityDays * 24 * 60 * 60 * 1000);
    const patchTest = await createPatchTest(sb, {
      techId: tech.id,
      clientId,
      categoryId,
      performedAtIso: performed.toISOString(),
      expiresAtIso: expires.toISOString(),
      result,
      bookingId: null,
      notes: String(formData.get("notes") ?? "").trim(),
      invalidatedAtIso: null,
      invalidationEventId: null,
    });
    if (batchId) {
      const { logProductUsage } = await import("@/lib/product-batches");
      await logProductUsage(sb, tech.id, {
        batchId,
        clientId,
        patchTestId: patchTest.id,
        usedAtIso: performed.toISOString(),
      });
    }
    if (result === "pass" || result === "pending") {
      try {
        const { scheduleReactionCheckin } = await import("@/lib/reaction-checkin");
        await scheduleReactionCheckin(sb, {
          techId: tech.id,
          clientId,
          categoryId,
          anchorIso: performed.toISOString(),
          patchTestId: patchTest.id,
        });
      } catch {
        // Check-in scheduling is best-effort if migration is pending.
      }
    }
    const { resolveRetestsAfterPatchPass, markRetestsTestBooked } = await import("@/lib/product-change");
    if (result === "pass") {
      await resolveRetestsAfterPatchPass(sb, tech.id, clientId, categoryId);
    } else if (result === "pending") {
      await markRetestsTestBooked(sb, tech.id, clientId, categoryId);
    }
  }
  revalidatePath(`/dashboard/clients/${clientId}`);
  revalidatePath("/dashboard/services");
  redirect(`/dashboard/clients/${clientId}`);
}

// ---------------- Bookings ----------------
export async function setBookingStatusAction(formData: FormData) {
  const { sb, tech } = await ctx();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "") as BookingStatus;
  const returnTo = safeDashboardReturn(formData);
  const booking = await getBooking(sb, id);
  if (!booking) redirect(`${returnTo}?saved=1`);

  const patch: Partial<typeof booking> = { status };
  const becomingCompleted = status === "completed" && booking.status !== "completed";
  const batchId = becomingCompleted ? String(formData.get("batchId") ?? "").trim() : "";

  // Outcome of a card-capture no-show charge, surfaced on the bookings page.
  let noShowCharge: "charged" | "declined" | null = null;
  let noShowChargePennies = 0;

  if (status === "no_show") {
    patch.depositStatus = booking.depositStatus === "paid" ? "forfeited" : booking.depositStatus;
    const client = await getClient(sb, booking.clientId);
    if (client) await updateClient(sb, client.id, { noShowCount: client.noShowCount + 1 });

    // Card capture: charge the configured no-show fee against the saved card.
    // Off-session charges can be declined by the client's bank, so a failure
    // is reported to the tech rather than blocking the status change.
    if (
      booking.status !== "no_show" &&
      booking.cardPaymentMethodId &&
      tech.stripeConnectAccountId
    ) {
      const { noShowFeeFor } = await import("@/lib/rules");
      const fee = noShowFeeFor(tech, booking.pricePennies);
      if (fee > 0) {
        const { chargeNoShowFee } = await import("@/lib/payments");
        const result = await chargeNoShowFee(tech, booking, fee);
        noShowChargePennies = fee;
        if (result.ok) {
          noShowCharge = "charged";
          await createPayment(sb, {
            techId: tech.id,
            bookingId: booking.id,
            kind: "no_show_fee",
            amountPennies: fee,
            status: "succeeded",
            provider: "stripe",
            providerRef: result.paymentIntentId,
          }).catch(() => {});
          await audit(sb, tech.id, "no_show_fee_charged", "booking", id, {
            amountPennies: fee,
            paymentIntentId: result.paymentIntentId,
          });
        } else {
          noShowCharge = "declined";
          await audit(sb, tech.id, "no_show_fee_failed", "booking", id, {
            amountPennies: fee,
            error: result.error ?? "",
          });
        }
      }
    }
  }
  if (status === "cancelled") {
    const cancelReason = String(formData.get("cancelReason") ?? "client_late_cancel");
    const refundSucceededPayments = async () => {
      if (!tech.stripeConnectAccountId) return;
      const payments = await paymentsForBooking(sb, booking.id);
      for (const p of payments) {
        if (p.status !== "succeeded" || !p.providerRef) continue;
        if (p.kind !== "deposit" && p.kind !== "balance") continue;
        try {
          await refundOnConnect(tech, p.providerRef);
          await createPayment(sb, {
            techId: tech.id,
            bookingId: booking.id,
            kind: "refund",
            amountPennies: p.amountPennies,
            status: "succeeded",
            provider: "stripe",
            providerRef: p.providerRef,
          });
          if (p.kind === "deposit") patch.depositStatus = "refunded";
          if (p.kind === "balance") patch.balanceStatus = "refunded";
        } catch {
          /* leave as paid; tech can refund manually from Stripe */
        }
      }
    };

    if (cancelReason === "tech_cancelled") {
      // Tech initiated: always refund the client; never forfeit the deposit.
      await refundSucceededPayments();
    } else {
      const hoursOut = (new Date(booking.startIso).getTime() - Date.now()) / (1000 * 60 * 60);
      if (hoursOut < tech.cancellationWindowHours) {
        // Inside the window: deposit is forfeited (kept by the tech).
        if (booking.depositStatus === "paid") patch.depositStatus = "forfeited";
      } else {
        // Outside the window: refund everything the client paid (deposit + balance).
        await refundSucceededPayments();
      }
    }
  }

  // Persist status first so the UI can reflect it quickly; side effects run after.
  await updateBooking(sb, id, patch);
  const updated = { ...booking, ...patch };

  await audit(sb, tech.id, "booking_status_changed", "booking", id, {
    from: booking.status,
    to: status,
    depositStatus: patch.depositStatus,
    balanceStatus: patch.balanceStatus,
  });
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/bookings");
  revalidatePath(`/dashboard/clients/${booking.clientId}`);

  // Emails / calendar / nudges continue after the redirect so the menu feels snappy.
  after(async () => {
    const sideEffects: Promise<unknown>[] = [
      syncBookingToGoogle(sb, tech, updated).catch(() => {}),
    ];

    if (becomingCompleted) {
      sideEffects.push(
        (async () => {
          if (batchId) {
            const { logProductUsage } = await import("@/lib/product-batches");
            await logProductUsage(sb, tech.id, {
              batchId,
              clientId: booking.clientId,
              bookingId: booking.id,
            });
          }
        })().catch(() => {}),
        (async () => {
          const service = await getService(sb, booking.serviceId);
          if (service?.requiresPatchTest && !service.isPatchTestService) {
            const { scheduleReactionCheckin } = await import("@/lib/reaction-checkin");
            await scheduleReactionCheckin(sb, {
              techId: tech.id,
              clientId: booking.clientId,
              categoryId: service.categoryId,
              anchorIso: booking.endIso || booking.startIso,
              bookingId: booking.id,
            });
          }
        })().catch(() => {}),
        (async () => {
          const { maybeScheduleInfillNudgeForBooking } = await import("@/lib/infill-nudge");
          await maybeScheduleInfillNudgeForBooking(sb, tech, updated);
        })().catch(() => {}),
        (async () => {
          const { sendAftercareEmail } = await import("@/lib/notify");
          await sendAftercareEmail(sb, updated);
        })().catch(() => {}),
        (async () => {
          const { getReviewByBookingId } = await import("@/lib/db/queries");
          const existing = await getReviewByBookingId(sb, booking.id);
          if (!existing) {
            const { sendReviewRequestEmail } = await import("@/lib/notify");
            await sendReviewRequestEmail(sb, updated);
          }
        })().catch(() => {}),
      );
    }

    if (status === "cancelled") {
      sideEffects.push(
        (async () => {
          const { skipPreCareForBooking } = await import("@/lib/pre-care");
          await skipPreCareForBooking(sb, booking.id);
        })().catch(() => {}),
        (async () => {
          const { notifyWaitlistForCancelledBooking } = await import("@/lib/waitlist");
          await notifyWaitlistForCancelledBooking(sb, updated);
        })().catch(() => {}),
      );
    }

    await Promise.allSettled(sideEffects);
  });

  // ?saved=1 busts the client dashboard cache so the new status is visible.
  const chargeQs = noShowCharge ? `&noshowfee=${noShowCharge}&noshowamt=${noShowChargePennies}` : "";
  redirect(`${returnTo}?saved=1${chargeQs}`);
}

export async function approveBookingRequestDashboardAction(formData: FormData) {
  const { sb, tech } = await ctx();
  const id = String(formData.get("id") ?? "");
  const booking = await getBooking(sb, id);
  if (!booking || booking.techId !== tech.id) redirect("/dashboard/bookings");
  const { approveBookingRequest } = await import("@/lib/bookings");
  await approveBookingRequest(sb, booking);
  revalidatePath("/dashboard/bookings");
  revalidatePath(`/dashboard/bookings/${id}`);
  revalidatePath(`/${tech.handle}`);
  redirect(`/dashboard/bookings/${id}`);
}

export async function declineBookingRequestDashboardAction(formData: FormData) {
  const { sb, tech } = await ctx();
  const id = String(formData.get("id") ?? "");
  const booking = await getBooking(sb, id);
  if (!booking || booking.techId !== tech.id) redirect("/dashboard/bookings");
  const { declineBookingRequest } = await import("@/lib/bookings");
  await declineBookingRequest(sb, booking);
  revalidatePath("/dashboard/bookings");
  revalidatePath(`/dashboard/bookings/${id}`);
  revalidatePath(`/${tech.handle}`);
  redirect(`/dashboard/bookings/${id}`);
}

export async function addManualBookingAction(formData: FormData) {
  const { sb, tech } = await ctx();
  const serviceId = String(formData.get("serviceId") ?? "");
  const service = await getService(sb, serviceId);
  const dateTime = String(formData.get("startsAt") ?? "");
  if (!service || !dateTime) redirect("/dashboard/bookings?error=missing");

  const cid = String(formData.get("clientId") ?? "");
  let client = cid ? await getClient(sb, cid) : null;
  if (!client) {
    client = await findOrCreateClient(sb, tech.id, {
      name: String(formData.get("clientName") ?? "Walk-in").trim() || "Walk-in",
      email: String(formData.get("clientEmail") ?? "").trim(),
      phone: String(formData.get("clientPhone") ?? "").trim(),
    });
  }

  // Duplicate guard: identical client + service + start time already booked
  // (protects against double-taps and repeated form submissions).
  const startIso = toIso(dateTime);
  const { bookingsForClient } = await import("@/lib/db/queries");
  const existing = await bookingsForClient(sb, tech.id, client.id);
  const startMs = new Date(startIso).getTime();
  const duplicate = existing.some(
    (b) =>
      b.serviceId === serviceId &&
      b.status !== "cancelled" &&
      new Date(b.startIso).getTime() === startMs,
  );
  if (duplicate) {
    revalidatePath("/dashboard/bookings");
    redirect("/dashboard/bookings");
  }

  const paymentTaken = String(formData.get("paymentTaken") ?? "none") as "none" | "deposit" | "full";
  const paymentMethod = String(formData.get("paymentMethod") ?? "cash");

  // Optional per-booking deposit override: blank = service default, 0 = none.
  const depositRaw = String(formData.get("depositPounds") ?? "").trim();
  const depositOverridePennies = depositRaw === "" ? null : poundsToPennies(depositRaw);

  // Loyalty reward applies to manual bookings too (VIPs always qualify).
  const { loyaltyDiscountFor } = await import("@/lib/bookings");
  const completedVisits = existing.filter((b) => b.status === "completed").length;
  const discountPennies = loyaltyDiscountFor(tech, completedVisits, service!.pricePennies, client.isVip);

  // Salon mode: manual bookings can name a staff member; default is the owner.
  let manualStaffId = String(formData.get("staffId") ?? "").trim() || null;
  if (!manualStaffId) {
    try {
      const { getOrCreateOwnerStaff } = await import("@/lib/booking/staff");
      manualStaffId = (await getOrCreateOwnerStaff(supabaseService(), tech)).id;
    } catch {
      // Pre-migration environment: book without a staff link.
    }
  }

  let booking;
  try {
    booking = await createConfirmedBooking({
      sb,
      tech,
      service: service!,
      client,
      startIso,
      staffId: manualStaffId,
      notes: String(formData.get("notes") ?? "").trim(),
      paymentTaken,
      paymentMethod,
      depositOverridePennies,
      discountPennies,
    });
  } catch (e) {
    if (isUniqueViolation(e)) {
      revalidatePath("/dashboard/bookings");
      redirect("/dashboard/bookings?error=slot");
    }
    throw e;
  }
  await audit(sb, tech.id, "manual_booking_created", "booking", booking.id, {
    clientId: client.id,
    serviceId: service!.id,
    startIso,
    paymentTaken,
  });

  revalidatePath("/dashboard/bookings");
  redirect("/dashboard/bookings?saved=1");
}

/** Move a booking to a new date/time (and optionally another service). */
export async function rescheduleBookingAction(formData: FormData) {
  const { sb, tech } = await ctx();
  const id = String(formData.get("id") ?? "");
  const dateTime = String(formData.get("startsAt") ?? "");
  const booking = await getBooking(sb, id);
  if (!booking || booking.techId !== tech.id) redirect("/dashboard/bookings");
  if (!dateTime) redirect(`/dashboard/bookings/${id}?err=missing`);

  const newServiceId = String(formData.get("serviceId") ?? booking!.serviceId);
  const service = await getService(sb, newServiceId);
  if (!service) redirect(`/dashboard/bookings/${id}?err=missing`);

  const start = new Date(toIso(dateTime));
  const end = new Date(start.getTime() + service!.durationMin * 60 * 1000);

  const patch: Partial<typeof booking & object> = {
    serviceId: service!.id,
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    notes: String(formData.get("notes") ?? booking!.notes),
    lashMap: String(formData.get("lashMap") ?? booking!.lashMap ?? ""),
    lashCurl: String(formData.get("lashCurl") ?? booking!.lashCurl ?? ""),
    lashLength: String(formData.get("lashLength") ?? booking!.lashLength ?? ""),
  };

  // Price follows the (possibly changed) service.
  const price = service!.id !== booking!.serviceId ? service!.pricePennies : booking!.pricePennies;

  // Deposit is whatever the tech says it is (0 = no deposit). Once a deposit
  // has actually been paid, the amount is locked to protect the records.
  let deposit = booking!.depositPennies;
  const depositRaw = String(formData.get("depositPounds") ?? "").trim();
  if (depositRaw !== "" && booking!.depositStatus !== "paid") {
    deposit = Math.min(Math.max(0, poundsToPennies(depositRaw)), price);
  }

  const balance = Math.max(0, price - deposit);
  Object.assign(patch, {
    pricePennies: price,
    depositPennies: deposit,
    depositStatus: deposit === 0 ? "none" : booking!.depositStatus,
    balancePennies: balance,
    balanceStatus: booking!.balanceStatus === "paid" ? "paid" : balance > 0 ? "unpaid" : "paid",
  });

  await updateBooking(sb, id, patch);
  const updated = await getBooking(sb, id);
  if (updated) {
    const { rescheduleReminders } = await import("@/lib/bookings");
    await rescheduleReminders(sb, updated);
  }
  await audit(sb, tech.id, "booking_rescheduled", "booking", id, {
    from: { serviceId: booking!.serviceId, startIso: booking!.startIso },
    to: { serviceId: service!.id, startIso: start.toISOString() },
  });

  revalidatePath("/dashboard/bookings");
  redirect(`/dashboard/bookings/${id}?saved=1`);
}

/** Record an offline payment (cash, bank transfer, PayPal...) on a booking. */
export async function recordManualPaymentAction(formData: FormData) {
  const { sb, tech } = await ctx();
  const id = String(formData.get("id") ?? "");
  const what = String(formData.get("what") ?? ""); // deposit | balance | full
  const method = String(formData.get("method") ?? "cash");
  const returnTo = safeDashboardReturn(formData, `/dashboard/bookings/${id}`);
  const booking = await getBooking(sb, id);
  if (!booking || booking.techId !== tech.id) redirect(`${returnTo}?saved=1`);

  const { createPayment } = await import("@/lib/db/queries");
  const patch: Record<string, unknown> = {};

  if ((what === "deposit" || what === "full") && booking.depositStatus !== "paid" && booking.depositPennies > 0) {
    await createPayment(sb, {
      techId: tech.id,
      bookingId: id,
      kind: "deposit",
      amountPennies: booking.depositPennies,
      status: "succeeded",
      provider: method,
      providerRef: "",
    });
    patch.depositStatus = "paid";
  }
  if ((what === "balance" || what === "full") && booking.balanceStatus !== "paid" && booking.balancePennies > 0) {
    await createPayment(sb, {
      techId: tech.id,
      bookingId: id,
      kind: "balance",
      amountPennies: booking.balancePennies,
      status: "succeeded",
      provider: method,
      providerRef: "",
    });
    patch.balanceStatus = "paid";
  }

  if (Object.keys(patch).length) {
    await updateBooking(sb, id, patch);
    await audit(sb, tech.id, "manual_payment_recorded", "booking", id, { what, method, patch });
  }
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/bookings");
  redirect(`${returnTo}?saved=1`);
}

/**
 * One-tap wrap-up for past appointments: record unpaid cash/offline payment
 * and mark the booking completed, then return to the dashboard.
 */
export async function settlePastBookingAction(formData: FormData) {
  const { sb, tech } = await ctx();
  const id = String(formData.get("id") ?? "");
  const method = String(formData.get("method") ?? "cash");
  const returnTo = safeDashboardReturn(formData, "/dashboard");
  const booking = await getBooking(sb, id);
  if (!booking || booking.techId !== tech.id) redirect(`${returnTo}?saved=1`);

  const depositDue =
    booking.depositPennies > 0 &&
    booking.depositStatus !== "paid" &&
    booking.depositStatus !== "forfeited" &&
    booking.depositStatus !== "refunded";
  const balanceDue =
    booking.balancePennies > 0 &&
    booking.balanceStatus !== "paid" &&
    booking.balanceStatus !== "refunded";

  const patch: Record<string, unknown> = {};
  if (depositDue) {
    await createPayment(sb, {
      techId: tech.id,
      bookingId: id,
      kind: "deposit",
      amountPennies: booking.depositPennies,
      status: "succeeded",
      provider: method,
      providerRef: "",
    });
    patch.depositStatus = "paid";
  }
  if (balanceDue) {
    await createPayment(sb, {
      techId: tech.id,
      bookingId: id,
      kind: "balance",
      amountPennies: booking.balancePennies,
      status: "succeeded",
      provider: method,
      providerRef: "",
    });
    patch.balanceStatus = "paid";
  }

  const becomingCompleted =
    booking.status !== "completed" &&
    booking.status !== "cancelled" &&
    booking.status !== "no_show";
  if (becomingCompleted) patch.status = "completed";

  if (Object.keys(patch).length) {
    await updateBooking(sb, id, patch);
    if (depositDue || balanceDue) {
      await audit(sb, tech.id, "manual_payment_recorded", "booking", id, {
        what: "full",
        method,
        via: "settle_past",
        patch,
      });
    }
    if (becomingCompleted) {
      await audit(sb, tech.id, "booking_status_changed", "booking", id, {
        from: booking.status,
        to: "completed",
        via: "settle_past",
      });
    }
  }

  const updated = { ...booking, ...patch };
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/bookings");
  revalidatePath(`/dashboard/clients/${booking.clientId}`);

  if (becomingCompleted) {
    after(async () => {
      await Promise.allSettled([
        syncBookingToGoogle(sb, tech, updated).catch(() => {}),
        (async () => {
          const service = await getService(sb, booking.serviceId);
          if (service?.requiresPatchTest && !service.isPatchTestService) {
            const { scheduleReactionCheckin } = await import("@/lib/reaction-checkin");
            await scheduleReactionCheckin(sb, {
              techId: tech.id,
              clientId: booking.clientId,
              categoryId: service.categoryId,
              anchorIso: booking.endIso || booking.startIso,
              bookingId: booking.id,
            });
          }
        })().catch(() => {}),
        (async () => {
          const { maybeScheduleInfillNudgeForBooking } = await import("@/lib/infill-nudge");
          await maybeScheduleInfillNudgeForBooking(sb, tech, updated as typeof booking);
        })().catch(() => {}),
        (async () => {
          const { sendAftercareEmail } = await import("@/lib/notify");
          await sendAftercareEmail(sb, updated as typeof booking);
        })().catch(() => {}),
        (async () => {
          const { getReviewByBookingId } = await import("@/lib/db/queries");
          const existing = await getReviewByBookingId(sb, booking.id);
          if (!existing) {
            const { sendReviewRequestEmail } = await import("@/lib/notify");
            await sendReviewRequestEmail(sb, updated as typeof booking);
          }
        })().catch(() => {}),
      ]);
    });
  }

  redirect(`${returnTo}?saved=1`);
}

/** Hard delete a mistake booking: no strike, no history, reminders removed. */
export async function deleteBookingAction(formData: FormData) {
  const { sb, tech } = await ctx();
  const id = String(formData.get("id") ?? "");
  const booking = await getBooking(sb, id);
  if (booking && booking.techId === tech.id) {
    try {
      await deleteGoogleEventForBooking(tech, booking);
    } catch {
      // Google cleanup is best-effort.
    }
    const { deleteBooking } = await import("@/lib/db/queries");
    await deleteBooking(sb, id);
    await audit(sb, tech.id, "booking_deleted", "booking", id, {
      clientId: booking.clientId,
      serviceId: booking.serviceId,
      startIso: booking.startIso,
    });
  }
  revalidatePath("/dashboard/bookings");
  redirect("/dashboard/bookings?saved=1");
}

// ---------------- Service photos & add-ons ----------------
export async function setServicePhotoAction(formData: FormData) {
  const { sb, tech } = await ctx();
  const serviceId = String(formData.get("serviceId") ?? "");
  const file = formData.get("photo") as File | null;
  const service = await getService(sb, serviceId);
  if (file && file.size > MAX_PHOTO_BYTES) {
    redirect(`/dashboard/services?photoerr=size&open=${serviceId}`);
  }
  if (service && service.techId === tech.id && file && file.size > 0) {
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
    const path = `svc/${tech.id}/${serviceId}.${ext}`;
    const bytes = new Uint8Array(await file.arrayBuffer());
    await uploadPhoto(path, bytes, file.type || "image/jpeg", { upsert: true });
    await updateService(sb, serviceId, { photoPath: path });
  }
  revalidatePath("/dashboard/services");
  redirect(`/dashboard/services?saved=1&open=${serviceId}`);
}

export async function removeServicePhotoAction(formData: FormData) {
  const { sb, tech } = await ctx();
  const serviceId = String(formData.get("serviceId") ?? "");
  const service = await getService(sb, serviceId);
  if (service && service.techId === tech.id && service.photoPath) {
    await removePhoto(service.photoPath);
    await updateService(sb, serviceId, { photoPath: null });
  }
  revalidatePath("/dashboard/services");
  redirect(`/dashboard/services?saved=1&open=${serviceId}`);
}

export async function addAddonAction(formData: FormData) {
  const { sb, tech } = await ctx();
  const serviceId = String(formData.get("serviceId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const price = poundsToPennies(String(formData.get("pricePounds") ?? "0"));
  const service = await getService(sb, serviceId);
  if (service && service.techId === tech.id && name) {
    const { createAddon, addonsForService } = await import("@/lib/db/queries");
    // Double-click guard: one extra per name on a service.
    const existing = await addonsForService(sb, serviceId);
    if (!existing.some((a) => a.active && a.name.toLowerCase() === name.toLowerCase())) {
      await createAddon(sb, {
        techId: tech.id,
        serviceId,
        name,
        pricePennies: Math.max(0, price),
        active: true,
      });
    }
  }
  revalidatePath("/dashboard/services");
  // Land back with this service's panel open so adding several extras flows.
  redirect(`/dashboard/services?saved=1&open=${serviceId}`);
}

export async function deleteAddonAction(formData: FormData) {
  const { sb } = await ctx();
  const id = String(formData.get("id") ?? "");
  const serviceId = String(formData.get("serviceId") ?? "");
  const { deleteAddon } = await import("@/lib/db/queries");
  await deleteAddon(sb, id);
  revalidatePath("/dashboard/services");
  redirect(serviceId ? `/dashboard/services?saved=1&open=${serviceId}` : "/dashboard/services?saved=1");
}

/** Hard delete a client and everything attached (bookings, photos, messages). */
export async function deleteClientAction(formData: FormData) {
  const { sb, tech } = await ctx();
  const id = String(formData.get("id") ?? "");
  const client = await getClient(sb, id);
  if (client && client.techId === tech.id) {
    // Remove stored photo files first (DB rows cascade with the client).
    const { listClientPhotos } = await import("@/lib/db/queries");
    const photos = await listClientPhotos(sb, id);
    for (const p of photos) {
      try {
        await removePhoto(p.path);
      } catch {
        /* storage cleanup is best-effort */
      }
    }
    const { error } = await sb.from("clients").delete().eq("id", id);
    if (error) throw new Error(error.message);
    await audit(sb, tech.id, "client_deleted", "client", id, {
      name: client.name,
      email: client.email,
      photosDeleted: photos.length,
    });
  }
  revalidatePath("/dashboard/clients");
  redirect("/dashboard/clients");
}

/** Delete a category (and its services, which cascade). */
export async function deleteCategoryAction(formData: FormData) {
  const { sb, tech } = await ctx();
  const id = String(formData.get("id") ?? "");
  const category = await getCategory(sb, id);
  if (category && category.techId === tech.id) {
    const { error } = await sb.from("categories").delete().eq("id", id);
    if (error) throw new Error(error.message);
  }
  revalidatePath("/dashboard/services");
  redirect("/dashboard/services");
}

/** Delete a saved consultation response. */
export async function deleteFormResponseAction(formData: FormData) {
  const { sb, tech } = await ctx();
  const id = String(formData.get("id") ?? "");
  const clientId = String(formData.get("clientId") ?? "");
  const { error } = await sb.from("form_responses").delete().eq("id", id);
  if (error) throw new Error(error.message);
  await audit(sb, tech.id, "form_response_deleted", "form_response", id, { clientId });
  revalidatePath(`/dashboard/clients/${clientId}`);
  redirect(`/dashboard/clients/${clientId}`);
}

/** Delete a patch test record. */
export async function deletePatchTestAction(formData: FormData) {
  const { sb, tech } = await ctx();
  const id = String(formData.get("id") ?? "");
  const clientId = String(formData.get("clientId") ?? "");
  const { error } = await sb.from("patch_tests").delete().eq("id", id);
  if (error) throw new Error(error.message);
  await audit(sb, tech.id, "patch_test_deleted", "patch_test", id, { clientId });
  revalidatePath(`/dashboard/clients/${clientId}`);
  redirect(`/dashboard/clients/${clientId}`);
}

// ---------------- Migration imports (clients, services, appointments) ----------------

/** redirect() works by throwing; imports must rethrow it, not treat it as a failure. */
function isNextRedirect(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "digest" in e &&
    String((e as { digest?: unknown }).digest).startsWith("NEXT_REDIRECT")
  );
}

/**
 * Imports parse arbitrary files from other platforms, so anything unexpected
 * lands on a friendly import-page banner (and alerts ops with the stack)
 * instead of the generic crash screen.
 */
async function runImport(work: () => Promise<void>, where: string): Promise<void> {
  try {
    await work();
  } catch (e) {
    if (isNextRedirect(e)) throw e;
    const { reportError } = await import("@/lib/monitor");
    await reportError(e, { where });
    redirect("/dashboard/import?import=failed");
  }
}

export async function importClientsAction(formData: FormData) {
  return runImport(() => importClientsInner(formData), "importClientsAction");
}

async function importClientsInner(formData: FormData) {
  const { sb, tech } = await ctx();
  const back = String(formData.get("back") ?? "/dashboard/import");
  const file = formData.get("csv") as File | null;
  if (!file || file.size === 0) redirect(`${back}?import=empty`);

  const { parseCsv, col } = await import("@/lib/csv");
  const { headers, rows } = parseCsv(await file!.text());
  if (rows.length === 0) redirect(`${back}?import=empty`);

  const iFirst = col(headers, "firstname", "first");
  const iLast = col(headers, "lastname", "last", "surname");
  const iName = col(headers, "name", "fullname", "clientname", "customername");
  const iEmail = col(headers, "email", "emailaddress", "customeremail");
  const iPhone = col(headers, "phone", "phonenumber", "mobile", "mobilenumber", "telephone", "cellphone");
  const iNotes = col(headers, "notes", "note", "comments");

  if (iName === -1 && iFirst === -1) redirect(`${back}?import=badformat`);

  const { createClient: createClientRow, getClientByEmail: findByEmail } = await import("@/lib/db/queries");
  let imported = 0;
  let skipped = 0;

  for (const cols of rows) {
    const name =
      iName !== -1
        ? cols[iName]
        : [cols[iFirst], iLast !== -1 ? cols[iLast] : ""].filter(Boolean).join(" ");
    if (!name) { skipped++; continue; }
    const email = iEmail !== -1 ? (cols[iEmail] ?? "") : "";
    const phone = iPhone !== -1 ? (cols[iPhone] ?? "") : "";
    const notes = iNotes !== -1 ? (cols[iNotes] ?? "") : "";

    if (email) {
      const existing = await findByEmail(sb, tech.id, email);
      if (existing) { skipped++; continue; }
    }
    await createClientRow(sb, { techId: tech.id, name, email, phone, notes });
    imported++;
  }

  await audit(sb, tech.id, "clients_imported", "import", "clients", { imported, skipped, rows: rows.length });
  revalidatePath("/dashboard/clients");
  redirect(`${back}?import=done&what=clients&n=${imported}&s=${skipped}`);
}

export async function importServicesAction(formData: FormData) {
  return runImport(() => importServicesInner(formData), "importServicesAction");
}

async function importServicesInner(formData: FormData) {
  const { sb, tech } = await ctx();
  const file = formData.get("csv") as File | null;
  if (!file || file.size === 0) redirect("/dashboard/import?import=empty");

  const { parseCsv, col, moneyToPennies, toMinutes, safeMinutes, IMPORT_SERVICE_COLS, isPlausibleServiceName, isAcuityAppointmentCsv, acuityServiceNames } = await import("@/lib/csv");
  const { headers, rows } = parseCsv(await file!.text());
  if (rows.length === 0) redirect("/dashboard/import?import=empty");

  const iName = col(headers, ...IMPORT_SERVICE_COLS.name);
  const iPrice = col(headers, ...IMPORT_SERVICE_COLS.price);
  const iDuration = col(headers, ...IMPORT_SERVICE_COLS.duration);
  const iCategory = col(headers, ...IMPORT_SERVICE_COLS.category);
  const iDesc = col(headers, ...IMPORT_SERVICE_COLS.description);

  const existing = await listServices(sb, tech.id);
  const existingNames = new Set(existing.map((s) => s.name.toLowerCase()));
  const cats = await listCategories(sb, tech.id);
  const catIdByName = new Map(cats.map((c) => [c.name.toLowerCase(), c.id]));

  const ensureCategory = async (rawName: string): Promise<string> => {
    const name = rawName.trim() || "Imported";
    const key = name.toLowerCase();
    if (catIdByName.has(key)) return catIdByName.get(key)!;
    const created = await createCategory(sb, {
      techId: tech.id,
      name,
      patchTestValidityDays: 180,
      patchTestMinLeadHours: 24,
    });
    catIdByName.set(key, created.id);
    return created.id;
  };

  let imported = 0;
  let skipped = 0;
  let sortOrder = existing.length;

  // Acuity has no services export, so the services step accepts the Acuity
  // appointments file instead: each unique appointment Type becomes a service
  // with a default price and duration for the tech to fill in afterwards.
  if (iName === -1 && isAcuityAppointmentCsv(headers)) {
    const names = acuityServiceNames(headers, rows);
    if (names.length === 0) redirect("/dashboard/import?import=badformat");
    for (const name of names) {
      if (existingNames.has(name.toLowerCase())) { skipped++; continue; }
      const categoryId = await ensureCategory("");
      await createService(sb, {
        techId: tech.id,
        categoryId,
        name,
        description: "",
        durationMin: 60,
        pricePennies: 0,
        depositType: tech.defaultDepositType ?? "percent",
        depositValue:
          tech.defaultDepositType === "fixed"
            ? tech.defaultDepositValue ?? 0
            : tech.defaultDepositType === "none"
              ? 0
              : tech.defaultDepositValue ?? tech.defaultDepositPct,
        requiresPatchTest: false,
        isPatchTestService: false,
        isInfill: false,
        fullSetServiceId: null,
        infillMaxGapDays: 21,
        active: true,
        sortOrder: sortOrder++,
      });
      existingNames.add(name.toLowerCase());
      imported++;
    }
    await audit(sb, tech.id, "services_imported", "import", "services", { imported, skipped, rows: rows.length, source: "acuity_appointments" });
    revalidatePath("/dashboard/services");
    redirect(`/dashboard/import?import=done&what=services&n=${imported}&s=${skipped}`);
  }

  if (iName === -1) redirect("/dashboard/import?import=badformat");

  for (const cols of rows) {
    const name = (cols[iName] ?? "").trim();
    if (!name || !isPlausibleServiceName(name) || existingNames.has(name.toLowerCase())) {
      skipped++;
      continue;
    }
    const pricePennies = iPrice !== -1 ? moneyToPennies(cols[iPrice] ?? "") : 0;
    const durationMin = safeMinutes(iDuration !== -1 ? toMinutes(cols[iDuration] ?? "") : 60);
    const categoryId = await ensureCategory(iCategory !== -1 ? cols[iCategory] ?? "" : "");

    await createService(sb, {
      techId: tech.id,
      categoryId,
      name,
      description: iDesc !== -1 ? (cols[iDesc] ?? "") : "",
      durationMin: durationMin || 60,
      pricePennies,
      depositType: tech.defaultDepositType ?? "percent",
      depositValue:
        tech.defaultDepositType === "fixed"
          ? tech.defaultDepositValue ?? 0
          : tech.defaultDepositType === "none"
            ? 0
            : tech.defaultDepositValue ?? tech.defaultDepositPct,
      requiresPatchTest: false,
      isPatchTestService: false,
      isInfill: false,
      fullSetServiceId: null,
      infillMaxGapDays: 21,
      active: true,
      sortOrder: sortOrder++,
    });
    existingNames.add(name.toLowerCase());
    imported++;
  }

  await audit(sb, tech.id, "services_imported", "import", "services", { imported, skipped, rows: rows.length });
  revalidatePath("/dashboard/services");
  redirect(`/dashboard/import?import=done&what=services&n=${imported}&s=${skipped}`);
}

export async function importBookingsAction(formData: FormData) {
  return runImport(() => importBookingsInner(formData), "importBookingsAction");
}

async function importBookingsInner(formData: FormData) {
  const { sb, tech } = await ctx();
  const file = formData.get("csv") as File | null;
  if (!file || file.size === 0) redirect("/dashboard/import?import=empty");

  const { parseCsv, col, appointmentWhenRaw, appointmentClientName, appointmentServiceCol, isAcuityAppointmentCsv, IMPORT_COLS, moneyToPennies, safePennies, safeMinutes, toMinutes, parseAppointmentWhen, normalizeImportName, MAX_MINUTES } = await import("@/lib/csv");
  const { headers, rows } = parseCsv(await file!.text());
  if (rows.length === 0) redirect("/dashboard/import?import=empty");

  const iClient = col(headers, ...IMPORT_COLS.appointmentClient);
  const iFirstName = col(headers, "firstname", "first");
  const iEmail = col(headers, ...IMPORT_COLS.appointmentEmail);
  const iService = appointmentServiceCol(headers);
  const iStatus = col(headers, ...IMPORT_COLS.appointmentStatus);
  const iCancelled = col(headers, "canceled", "cancelled");
  const iPrice = col(headers, ...IMPORT_COLS.appointmentPrice);
  const iDuration = col(headers, ...IMPORT_COLS.appointmentDuration);
  const iEndTime = col(headers, "endtime", "end");

  if ((iClient === -1 && iFirstName === -1) || iService === -1) {
    redirect("/dashboard/import?import=badformat");
  }
  const hasDate =
    col(headers, ...IMPORT_COLS.appointmentDate) !== -1 ||
    col(headers, ...IMPORT_COLS.appointmentTime) !== -1;
  if (!hasDate) redirect("/dashboard/import?import=badformat");

  // Acuity exports use US month-first dates (MM/DD/YYYY); never guess DD/MM
  // for those files. Everything else stays day-first as before.
  const monthFirst = isAcuityAppointmentCsv(headers);

  const services = await listServices(sb, tech.id);
  const serviceByName = new Map(services.map((s) => [normalizeImportName(s.name), s]));
  const existingBookings = await listBookings(sb, tech.id);
  const { createBooking: createBookingRow } = await import("@/lib/db/queries");
  const { rescheduleReminders } = await import("@/lib/bookings");
  const { randomToken: newToken } = await import("@/lib/ids");

  // UK exports commonly use dd/mm/yyyy or Fresha "04 Jul 2026, 3:00pm".
  // Times are naive local (Europe/London), not server UTC.

  let imported = 0;
  let skipped = 0;

  for (const cols of rows) {
    const clientName = appointmentClientName(cols, headers);
    const serviceName = normalizeImportName(cols[iService] ?? "");
    const { dateRaw, timeRaw } = appointmentWhenRaw(cols, headers);
    const when = parseAppointmentWhen(dateRaw, timeRaw, { monthFirst });
    const service = serviceByName.get(serviceName);
    if (!clientName || !service || !when) { skipped++; continue; }

    const rowPrice =
      iPrice !== -1 ? moneyToPennies(cols[iPrice] ?? "") : safePennies(service.pricePennies);
    const pricePennies = rowPrice > 0 ? rowPrice : safePennies(service.pricePennies);

    // Duration: explicit column first, then Acuity's End Time, then the service default.
    let endDurationMin = 0;
    if (iEndTime !== -1) {
      const endRaw = (cols[iEndTime] ?? "").trim();
      if (endRaw) {
        const end =
          parseAppointmentWhen(endRaw, "", { monthFirst }) ??
          parseAppointmentWhen(dateRaw, endRaw, { monthFirst });
        if (end) {
          const diff = Math.round((end.getTime() - when.getTime()) / 60000);
          if (diff > 0 && diff <= MAX_MINUTES) endDurationMin = diff;
        }
      }
    }
    const durationMin =
      iDuration !== -1
        ? safeMinutes(toMinutes(cols[iDuration] ?? ""), service.durationMin)
        : endDurationMin > 0
          ? endDurationMin
          : safeMinutes(service.durationMin);

    const client = await findOrCreateClient(sb, tech.id, {
      name: clientName,
      email: iEmail !== -1 ? (cols[iEmail] ?? "").trim() : "",
      phone: "",
    });

    // Skip exact duplicates (same client, same start).
    const startMs = when.getTime();
    if (existingBookings.some((b) => b.clientId === client.id && new Date(b.startIso).getTime() === startMs)) {
      skipped++;
      continue;
    }

    const isPast = startMs < Date.now();
    const rawStatus = iStatus !== -1 ? (cols[iStatus] ?? "").toLowerCase() : "";
    // Acuity marks cancellations in a separate Canceled column ("yes"/"true").
    const rawCancelled = iCancelled !== -1 ? (cols[iCancelled] ?? "").trim().toLowerCase() : "";
    const cancelledFlag = ["yes", "true", "1", "canceled", "cancelled"].includes(rawCancelled);
    const status: BookingStatus = cancelledFlag || rawStatus.includes("cancel")
      ? "cancelled"
      : rawStatus.includes("no") && rawStatus.includes("show")
        ? "no_show"
        : isPast
          ? "completed"
          : "confirmed";

    const booking = await createBookingRow(sb, {
      techId: tech.id,
      clientId: client.id,
      serviceId: service.id,
      startIso: when.toISOString(),
      endIso: new Date(startMs + durationMin * 60 * 1000).toISOString(),
      status,
      pricePennies,
      depositPennies: 0,
      depositStatus: "none",
      balancePennies: isPast ? 0 : pricePennies,
      balanceStatus: isPast ? "paid" : "unpaid",
      balanceToken: newToken(),
      pairedBookingId: null,
      riskTier: null,
      autoApproved: false,
      isPatchTest: false,
      notes: "Imported",
      lashMap: "",
      lashCurl: "",
      lashLength: "",
      addons: [],
      discountPennies: 0,
    });
    // Future imports get quiet reminders (24h etc.) but no confirmation email spam.
    if (!isPast && status === "confirmed") await rescheduleReminders(sb, booking);
    existingBookings.push(booking);
    imported++;
  }

  await audit(sb, tech.id, "appointments_imported", "import", "appointments", { imported, skipped, rows: rows.length });
  revalidatePath("/dashboard/bookings");
  if (imported === 0 && skipped > 0) {
    redirect(`/dashboard/import?import=none&what=appointments&n=0&s=${skipped}`);
  }
  redirect(`/dashboard/import?import=done&what=appointments&n=${imported}&s=${skipped}`);
}

// ---------------- Client photos ----------------
export async function uploadPhotoAction(formData: FormData) {
  const { sb, tech } = await ctx();
  const clientId = String(formData.get("clientId") ?? "");
  const kind = (String(formData.get("kind") ?? "other") as PhotoKind);
  const consent = formData.get("consent") === "on";
  const file = formData.get("photo") as File | null;

  if (clientId && file && file.size > MAX_PHOTO_BYTES) {
    redirect(`/dashboard/clients/${clientId}?photoerr=size`);
  }
  if (clientId && file && file.size > 0) {
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
    const path = `${tech.id}/${clientId}/${randomId("ph")}.${ext}`;
    const bytes = new Uint8Array(await file.arrayBuffer());
    await uploadPhoto(path, bytes, file.type || "image/jpeg");
    await createClientPhoto(sb, {
      techId: tech.id,
      clientId,
      bookingId: null,
      path,
      kind,
      consent,
    });
    await audit(sb, tech.id, "client_photo_uploaded", "client", clientId, { kind, consent });
  }
  revalidatePath(`/dashboard/clients/${clientId}`);
  redirect(`/dashboard/clients/${clientId}`);
}

export async function deletePhotoAction(formData: FormData) {
  const { sb } = await ctx();
  const id = String(formData.get("id") ?? "");
  const clientId = String(formData.get("clientId") ?? "");
  const photo = await getClientPhoto(sb, id);
  if (photo) {
    await removePhoto(photo.path);
    await deleteClientPhoto(sb, id);
    await audit(sb, photo.techId, "client_photo_deleted", "client_photo", id, {
      clientId: photo.clientId,
      kind: photo.kind,
    });
  }
  revalidatePath(`/dashboard/clients/${clientId}`);
  redirect(`/dashboard/clients/${clientId}`);
}

// ---------------- Consultation forms ----------------
export async function addQuestionAction(formData: FormData) {
  const { sb, tech } = await ctx();
  const prompt = String(formData.get("prompt") ?? "").trim();
  if (prompt) {
    await createQuestion(sb, {
      techId: tech.id,
      prompt,
      type: String(formData.get("type") ?? "text") as QuestionType,
      required: formData.get("required") === "on",
      sortOrder: clampInt(String(formData.get("sortOrder") ?? "0"), 0, 999, 0),
      active: true,
    });
  }
  revalidatePath("/dashboard/forms");
  redirect("/dashboard/forms");
}

export async function deleteQuestionAction(formData: FormData) {
  const { sb } = await ctx();
  await deleteQuestion(sb, String(formData.get("id") ?? ""));
  revalidatePath("/dashboard/forms");
  redirect("/dashboard/forms");
}

// ---------------- Products & batches ----------------
export async function addProductAction(formData: FormData) {
  const { sb, tech } = await ctx();
  const { createProduct } = await import("@/lib/db/queries");
  const name = String(formData.get("name") ?? "").trim();
  const categoryId = String(formData.get("categoryId") ?? "");
  if (name && categoryId) {
    const productType = String(formData.get("productType") ?? "other");
    const valid = ["adhesive", "tint", "lift", "other"].includes(productType)
      ? (productType as "adhesive" | "tint" | "lift" | "other")
      : "other";
    await createProduct(sb, {
      techId: tech.id,
      categoryId,
      name,
      brand: String(formData.get("brand") ?? "").trim(),
      productType: valid,
      active: true,
    });
  }
  revalidatePath("/dashboard/services");
  redirect("/dashboard/services?product=1");
}

export async function deleteProductAction(formData: FormData) {
  const { sb, tech } = await ctx();
  const { deleteProduct, getProduct } = await import("@/lib/db/queries");
  const id = String(formData.get("id") ?? "");
  const product = await getProduct(sb, id);
  if (product && product.techId === tech.id) await deleteProduct(sb, id);
  revalidatePath("/dashboard/services");
  redirect("/dashboard/services");
}

export async function addBatchAction(formData: FormData) {
  const { sb, tech } = await ctx();
  const { openProductBatch } = await import("@/lib/product-batches");
  const productId = String(formData.get("productId") ?? "");
  const openedAt = String(formData.get("openedAt") ?? "").trim();
  const expiresAt = String(formData.get("expiresAt") ?? "").trim();
  if (productId) {
    await openProductBatch(sb, tech.id, {
      productId,
      lotNumber: String(formData.get("lotNumber") ?? "").trim(),
      openedAtIso: openedAt ? fromZonedTime(`${openedAt}T12:00:00`, TZ).toISOString() : undefined,
      expiresAtIso: expiresAt ? fromZonedTime(`${expiresAt}T23:59:59`, TZ).toISOString() : undefined,
      notes: String(formData.get("notes") ?? "").trim(),
    });
  }
  revalidatePath("/dashboard/services");
  redirect("/dashboard/services?batch=1");
}

export async function retireBatchAction(formData: FormData) {
  const { sb, tech } = await ctx();
  const { getProductBatch, updateProductBatch } = await import("@/lib/db/queries");
  const id = String(formData.get("id") ?? "");
  const batch = await getProductBatch(sb, id);
  if (batch && batch.techId === tech.id) {
    await updateProductBatch(sb, id, { retiredAtIso: new Date().toISOString() });
  }
  revalidatePath("/dashboard/services");
  redirect("/dashboard/services");
}

export async function logBookingProductUsageAction(formData: FormData) {
  const { sb, tech } = await ctx();
  const bookingId = String(formData.get("bookingId") ?? "");
  const batchId = String(formData.get("batchId") ?? "").trim();
  const booking = await getBooking(sb, bookingId);
  if (booking && booking.techId === tech.id && batchId) {
    const { logProductUsage } = await import("@/lib/product-batches");
    await logProductUsage(sb, tech.id, {
      batchId,
      clientId: booking.clientId,
      bookingId: booking.id,
    });
  }
  revalidatePath(`/dashboard/bookings/${bookingId}`);
  redirect(`/dashboard/bookings/${bookingId}?usage=1`);
}

export async function addReactionAction(formData: FormData) {
  const { sb, tech } = await ctx();
  const { recordClientReaction } = await import("@/lib/product-batches");
  const clientId = String(formData.get("clientId") ?? "");
  const categoryId = String(formData.get("categoryId") ?? "");
  const severity = String(formData.get("severity") ?? "mild");
  const validSeverity = ["mild", "moderate", "severe"].includes(severity)
    ? (severity as "mild" | "moderate" | "severe")
    : "mild";
  const onsetDate = String(formData.get("onsetAt") ?? "").trim();
  const batchId = String(formData.get("batchId") ?? "").trim();
  if (clientId && categoryId) {
    await recordClientReaction(sb, tech.id, {
      clientId,
      categoryId,
      severity: validSeverity,
      symptoms: String(formData.get("symptoms") ?? "").trim(),
      onsetIso: onsetDate ? fromZonedTime(`${onsetDate}T12:00:00`, TZ).toISOString() : undefined,
      batchId: batchId || null,
      patchTestId: String(formData.get("patchTestId") ?? "").trim() || null,
      bookingId: String(formData.get("bookingId") ?? "").trim() || null,
      notes: String(formData.get("notes") ?? "").trim(),
    });
  }
  revalidatePath(`/dashboard/clients/${clientId}`);
  redirect(`/dashboard/clients/${clientId}?reaction=1`);
}

export async function deleteReactionAction(formData: FormData) {
  const { sb, tech } = await ctx();
  const { deleteClientReaction } = await import("@/lib/db/queries");
  const id = String(formData.get("id") ?? "");
  const clientId = String(formData.get("clientId") ?? "");
  await deleteClientReaction(sb, id);
  revalidatePath(`/dashboard/clients/${clientId}`);
  redirect(`/dashboard/clients/${clientId}`);
}

// ---------------- Running late cascade ----------------
export async function runningLateCascadeAction(formData: FormData) {
  const { sb, tech } = await ctx();
  const { executeRunningLateCascade } = await import("@/lib/running-late");
  const minutesLate = clampInt(String(formData.get("minutesLate") ?? "15"), 1, 240, 15);
  const note = String(formData.get("note") ?? "").trim();
  const returnTo = String(formData.get("returnTo") ?? "/dashboard/bookings").trim();
  const safeReturn = returnTo.startsWith("/dashboard") ? returnTo : "/dashboard/bookings";

  try {
    const result = await executeRunningLateCascade(sb, tech, { minutesLate, note });
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/bookings");
    redirect(
      `${safeReturn}?late=1&notified=${result.clientsNotified}&targeted=${result.bookingsTargeted}&minutes=${minutesLate}`,
    );
  } catch (err) {
    redirect(`${safeReturn}?lateerr=${encodeURIComponent((err as Error).message)}`);
  }
}

// ---------------- Price rise assistant ----------------
export async function applyPriceRiseAction(formData: FormData) {
  const { sb, tech } = await ctx();
  type Update = { id: string; pricePennies: number };
  let updates: Update[] = [];
  try {
    updates = JSON.parse(String(formData.get("updates") ?? "[]")) as Update[];
  } catch {
    redirect("/dashboard/services?priceriseerr=invalid");
  }
  if (!Array.isArray(updates) || updates.length === 0) {
    redirect("/dashboard/services?priceriseerr=empty");
  }

  const services = await listServices(sb, tech.id);
  const serviceById = new Map(services.map((s) => [s.id, s]));
  const applied: { id: string; from: number; to: number; name: string }[] = [];

  for (const row of updates) {
    const service = serviceById.get(row.id);
    if (!service || service.techId !== tech.id) continue;
    const pricePennies = Math.max(0, Math.round(row.pricePennies));
    if (pricePennies === service.pricePennies) continue;
    await updateService(sb, service.id, { pricePennies });
    applied.push({
      id: service.id,
      name: service.name,
      from: service.pricePennies,
      to: pricePennies,
    });
  }

  if (applied.length === 0) {
    redirect("/dashboard/services?priceriseerr=empty");
  }

  await audit(sb, tech.id, "price_rise_applied", "tech", tech.id, {
    mode: String(formData.get("mode") ?? ""),
    value: String(formData.get("value") ?? ""),
    effectiveDate: String(formData.get("effectiveDate") ?? ""),
    services: applied,
  });

  revalidatePath("/dashboard/services");
  revalidatePath(`/${tech.handle}`);
  redirect(`/dashboard/services?pricerise=1&count=${applied.length}`);
}

// ---------------- DM quote links ----------------
export async function createDmQuoteAction(formData: FormData) {
  const { sb, tech } = await ctx();
  const serviceId = String(formData.get("serviceId") ?? "");
  const clientId = String(formData.get("clientId") ?? "").trim() || null;
  const clientName = String(formData.get("clientName") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();
  const returnTo = String(formData.get("returnTo") ?? "/dashboard/messages").trim();
  const safeReturn = returnTo.startsWith("/dashboard") ? returnTo : "/dashboard/messages";
  const addonIds = new Set(formData.getAll("addonId").map(String));

  const service = await getService(sb, serviceId);
  if (!service || service.techId !== tech.id) redirect(safeReturn);

  const { addonsForService } = await import("@/lib/db/queries");
  const { bookingAmounts } = await import("@/lib/rules");
  const { createDmQuoteLink } = await import("@/lib/db/queries");

  const available = await addonsForService(sb, serviceId, { activeOnly: true });
  const addons = available
    .filter((a) => addonIds.has(a.id))
    .map((a) => ({ name: a.name, pricePennies: a.pricePennies }));
  const { price, deposit } = bookingAmounts(service, tech, "medium", addons);

  const quote = await createDmQuoteLink(sb, {
    techId: tech.id,
    clientId,
    serviceId: service.id,
    token: randomToken(),
    clientName,
    addons,
    note,
    pricePennies: price,
    depositPennies: deposit,
    viewedAtIso: null,
  });

  await audit(sb, tech.id, "dm_quote_created", "dm_quote_link", quote.id, {
    serviceId: service.id,
    clientId,
    pricePennies: price,
  });

  revalidatePath("/dashboard/messages");
  redirect(`${safeReturn}?qt=${quote.token}`);
}

// ---------------- Reminders ----------------
export async function runRemindersAction() {
  const { sb } = await ctx();
  await processDueReminders(sb);
  revalidatePath("/dashboard/reminders");
  redirect("/dashboard/reminders?ran=1");
}
