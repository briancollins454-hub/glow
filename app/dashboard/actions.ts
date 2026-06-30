"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { fromZonedTime } from "date-fns-tz";
import { TZ, poundsToPennies } from "@/lib/format";
import { getCurrentTech } from "@/lib/auth/session";
import { slugify, randomId } from "@/lib/utils";
import {
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
  replaceWorkingHours,
  updateBooking,
  updateClient,
  updateService,
  updateTech,
} from "@/lib/db/repo";
import { createConfirmedBooking } from "@/lib/bookings";
import type { BookingStatus, DepositType, WorkingHour } from "@/lib/db/types";

async function requireTech() {
  const tech = await getCurrentTech();
  if (!tech) redirect("/login");
  return tech;
}

function toIso(localValue: string): string {
  // localValue from <input type="datetime-local"> e.g. "2026-07-01T09:00"
  return fromZonedTime(localValue, TZ).toISOString();
}

// ---------------- Settings / branding / policy ----------------
export async function updateSettingsAction(formData: FormData) {
  const tech = await requireTech();
  const get = (k: string) => String(formData.get(k) ?? "").trim();

  let handle = slugify(get("handle"));
  if (handle && handle !== tech.handle) {
    const clash = getTechByHandle(handle);
    if (clash && clash.id !== tech.id) {
      let n = 1;
      let candidate = `${handle}${n}`;
      while (getTechByHandle(candidate)) candidate = `${handle}${++n}`;
      handle = candidate;
    }
  } else {
    handle = tech.handle;
  }

  updateTech(tech.id, {
    businessName: get("businessName") || tech.businessName,
    name: get("name"),
    handle,
    bio: get("bio"),
    brandColor: get("brandColor") || tech.brandColor,
    instagram: get("instagram").replace(/^@/, ""),
    tiktok: get("tiktok").replace(/^@/, ""),
    location: get("location"),
    defaultDepositPct: clampInt(get("defaultDepositPct"), 0, 100, tech.defaultDepositPct),
    cancellationWindowHours: clampInt(get("cancellationWindowHours"), 0, 336, tech.cancellationWindowHours),
    noShowFeePct: clampInt(get("noShowFeePct"), 0, 100, tech.noShowFeePct),
  });
  revalidatePath("/dashboard/settings");
  revalidatePath(`/${handle}`);
  redirect("/dashboard/settings?saved=1");
}

function clampInt(v: string, min: number, max: number, fallback: number): number {
  const n = parseInt(v, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

// ---------------- Availability ----------------
export async function saveAvailabilityAction(formData: FormData) {
  const tech = await requireTech();
  const rows: WorkingHour[] = [];
  for (let weekday = 0; weekday <= 6; weekday++) {
    const enabled = formData.get(`enabled_${weekday}`) === "on";
    const start = String(formData.get(`start_${weekday}`) ?? "09:00");
    const end = String(formData.get(`end_${weekday}`) ?? "17:00");
    rows.push({
      id: randomId("wh"),
      techId: tech.id,
      weekday,
      startMinutes: hhmmToMin(start),
      endMinutes: hhmmToMin(end),
      enabled,
    });
  }
  replaceWorkingHours(tech.id, rows);
  revalidatePath("/dashboard/availability");
  redirect("/dashboard/availability?saved=1");
}

function hhmmToMin(s: string): number {
  const [h, m] = s.split(":").map((x) => parseInt(x, 10));
  return (h || 0) * 60 + (m || 0);
}

export async function addTimeOffAction(formData: FormData) {
  const tech = await requireTech();
  const start = String(formData.get("start") ?? "");
  const end = String(formData.get("end") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (start && end) {
    createTimeOff({
      techId: tech.id,
      startIso: toIso(start),
      endIso: toIso(end),
      reason,
    });
  }
  revalidatePath("/dashboard/availability");
  redirect("/dashboard/availability");
}

export async function deleteTimeOffAction(formData: FormData) {
  await requireTech();
  deleteTimeOff(String(formData.get("id") ?? ""));
  revalidatePath("/dashboard/availability");
  redirect("/dashboard/availability");
}

// ---------------- Categories ----------------
export async function addCategoryAction(formData: FormData) {
  const tech = await requireTech();
  const name = String(formData.get("name") ?? "").trim();
  if (name) {
    createCategory({
      techId: tech.id,
      name,
      patchTestValidityDays: clampInt(String(formData.get("validityDays") ?? ""), 1, 3650, 180),
      patchTestMinLeadHours: clampInt(String(formData.get("minLeadHours") ?? ""), 0, 336, 24),
    });
  }
  revalidatePath("/dashboard/services");
  redirect("/dashboard/services");
}

// ---------------- Services ----------------
export async function saveServiceAction(formData: FormData) {
  const tech = await requireTech();
  const id = String(formData.get("id") ?? "");
  const depositType = (String(formData.get("depositType") ?? "percent") as DepositType);
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
    isInfill: formData.get("isInfill") === "on",
    fullSetServiceId: fullSet || null,
    infillMaxGapDays: clampInt(String(formData.get("infillMaxGapDays") ?? "21"), 1, 365, 21),
    active: formData.get("active") === "on",
    sortOrder: clampInt(String(formData.get("sortOrder") ?? "0"), 0, 999, 0),
  };

  if (!data.name || !data.categoryId) {
    redirect("/dashboard/services?error=missing");
  }

  if (id && getService(id)) {
    updateService(id, data);
  } else {
    createService(data);
  }
  revalidatePath("/dashboard/services");
  revalidatePath(`/${tech.handle}`);
  redirect("/dashboard/services");
}

export async function deleteServiceAction(formData: FormData) {
  const tech = await requireTech();
  deleteService(String(formData.get("id") ?? ""));
  revalidatePath("/dashboard/services");
  revalidatePath(`/${tech.handle}`);
  redirect("/dashboard/services");
}

// ---------------- Clients ----------------
export async function addClientAction(formData: FormData) {
  const tech = await requireTech();
  const name = String(formData.get("name") ?? "").trim();
  if (name) {
    createClient({
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
  await requireTech();
  const id = String(formData.get("id") ?? "");
  const client = getClient(id);
  if (client) {
    updateClient(id, {
      name: String(formData.get("name") ?? client.name).trim() || client.name,
      email: String(formData.get("email") ?? "").trim(),
      phone: String(formData.get("phone") ?? "").trim(),
      notes: String(formData.get("notes") ?? "").trim(),
      warningNote: String(formData.get("warningNote") ?? "").trim(),
      isBlacklisted: formData.get("isBlacklisted") === "on",
    });
  }
  revalidatePath(`/dashboard/clients/${id}`);
  revalidatePath("/dashboard/clients");
  redirect(`/dashboard/clients/${id}`);
}

export async function toggleBlacklistAction(formData: FormData) {
  await requireTech();
  const id = String(formData.get("id") ?? "");
  const client = getClient(id);
  if (client) updateClient(id, { isBlacklisted: !client.isBlacklisted });
  revalidatePath("/dashboard/clients");
  revalidatePath(`/dashboard/clients/${id}`);
  redirect(`/dashboard/clients/${id}`);
}

// ---------------- Patch tests ----------------
export async function addPatchTestAction(formData: FormData) {
  const tech = await requireTech();
  const clientId = String(formData.get("clientId") ?? "");
  const categoryId = String(formData.get("categoryId") ?? "");
  const performedDate = String(formData.get("performedAt") ?? "");
  const category = getCategory(categoryId);
  if (clientId && categoryId && performedDate && category) {
    const performed = fromZonedTime(`${performedDate}T12:00:00`, TZ);
    const expires = new Date(
      performed.getTime() + category.patchTestValidityDays * 24 * 60 * 60 * 1000,
    );
    createPatchTest({
      techId: tech.id,
      clientId,
      categoryId,
      performedAtIso: performed.toISOString(),
      expiresAtIso: expires.toISOString(),
      result: (String(formData.get("result") ?? "pass") as "pending" | "pass" | "fail"),
      bookingId: null,
      notes: String(formData.get("notes") ?? "").trim(),
    });
  }
  revalidatePath(`/dashboard/clients/${clientId}`);
  redirect(`/dashboard/clients/${clientId}`);
}

// ---------------- Bookings ----------------
export async function setBookingStatusAction(formData: FormData) {
  await requireTech();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "") as BookingStatus;
  const booking = getBooking(id);
  if (!booking) redirect("/dashboard/bookings");

  const patch: Parameters<typeof updateBooking>[1] = { status };

  if (status === "no_show") {
    // No-show protection: forfeit deposit + flag the client.
    patch.depositStatus = booking.depositStatus === "paid" ? "forfeited" : booking.depositStatus;
    const client = getClient(booking.clientId);
    if (client) updateClient(client.id, { noShowCount: client.noShowCount + 1 });
  }
  if (status === "cancelled") {
    const hoursOut =
      (new Date(booking.startIso).getTime() - Date.now()) / (1000 * 60 * 60);
    const tech = await getCurrentTech();
    const windowH = tech?.cancellationWindowHours ?? 48;
    if (hoursOut < windowH && booking.depositStatus === "paid") {
      patch.depositStatus = "forfeited";
    }
  }

  updateBooking(id, patch);
  revalidatePath("/dashboard/bookings");
  revalidatePath(`/dashboard/clients/${booking.clientId}`);
  redirect("/dashboard/bookings");
}

export async function addManualBookingAction(formData: FormData) {
  const tech = await requireTech();
  const serviceId = String(formData.get("serviceId") ?? "");
  const service = getService(serviceId);
  const dateTime = String(formData.get("startsAt") ?? "");
  if (!service || !dateTime) redirect("/dashboard/bookings?error=missing");

  let clientId = String(formData.get("clientId") ?? "");
  let client = clientId ? getClient(clientId) : undefined;
  if (!client) {
    client = findOrCreateClient(tech.id, {
      name: String(formData.get("clientName") ?? "Walk-in").trim() || "Walk-in",
      email: String(formData.get("clientEmail") ?? "").trim(),
      phone: String(formData.get("clientPhone") ?? "").trim(),
    });
  }
  clientId = client.id;

  await createConfirmedBooking({
    tech,
    service,
    client,
    startIso: toIso(dateTime),
    notes: String(formData.get("notes") ?? "").trim(),
    takeDeposit: false,
  });

  revalidatePath("/dashboard/bookings");
  redirect("/dashboard/bookings");
}

// ---------------- Reminders ----------------
export async function runRemindersAction() {
  await requireTech();
  const { processDueReminders } = await import("@/lib/scheduler");
  await processDueReminders();
  revalidatePath("/dashboard/reminders");
  redirect("/dashboard/reminders?ran=1");
}

// ---------------- Demo reset ----------------
export async function resetDemoAction() {
  await requireTech();
  const { resetDb } = await import("@/lib/db/store");
  resetDb();
  redirect("/dashboard");
}
