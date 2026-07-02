"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { fromZonedTime } from "date-fns-tz";
import { TZ, poundsToPennies } from "@/lib/format";
import { getDashboardContext } from "@/lib/auth/session";
import { supabaseService } from "@/lib/supabase/service";
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
  paymentsForBooking,
  replaceWorkingHours,
  updateBooking,
  updateClient,
  updateService,
  updateTech,
} from "@/lib/db/queries";
import {
  createClientPhoto,
  createQuestion,
  deleteClientPhoto,
  deleteQuestion,
  getClientPhoto,
} from "@/lib/db/queries";
import { uploadPhoto, removePhoto } from "@/lib/storage";
import { createConfirmedBooking } from "@/lib/bookings";
import { refundOnConnect } from "@/lib/payments";
import { processDueReminders } from "@/lib/scheduler";
import type { PhotoKind } from "@/lib/db/types";
import type { BookingStatus, DepositType, QuestionType, WorkingHour } from "@/lib/db/types";

async function ctx() {
  const c = await getDashboardContext();
  if (!c) redirect("/login");
  return c;
}

function toIso(localValue: string): string {
  return fromZonedTime(localValue, TZ).toISOString();
}

function clampInt(v: string, min: number, max: number, fallback: number): number {
  const n = parseInt(v, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
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

  await updateTech(sb, tech.id, {
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

// ---------------- Availability ----------------
export async function saveAvailabilityAction(formData: FormData) {
  const { sb, tech } = await ctx();
  const rows: WorkingHour[] = [];
  for (let weekday = 0; weekday <= 6; weekday++) {
    rows.push({
      id: randomId("wh"),
      techId: tech.id,
      weekday,
      startMinutes: hhmmToMin(String(formData.get(`start_${weekday}`) ?? "09:00")),
      endMinutes: hhmmToMin(String(formData.get(`end_${weekday}`) ?? "17:00")),
      enabled: formData.get(`enabled_${weekday}`) === "on",
    });
  }
  await replaceWorkingHours(sb, tech.id, rows);
  revalidatePath("/dashboard/availability");
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
    await createCategory(sb, {
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
    isInfill: formData.get("isInfill") === "on",
    fullSetServiceId: fullSet || null,
    infillMaxGapDays: clampInt(String(formData.get("infillMaxGapDays") ?? "21"), 1, 365, 21),
    active: formData.get("active") === "on",
    sortOrder: clampInt(String(formData.get("sortOrder") ?? "0"), 0, 999, 0),
  };

  if (!data.name || !data.categoryId) {
    redirect("/dashboard/services?error=missing");
  }

  const existing = id ? await getService(sb, id) : null;
  if (existing) {
    await updateService(sb, id, data);
  } else {
    await createService(sb, data);
  }
  revalidatePath("/dashboard/services");
  revalidatePath(`/${tech.handle}`);
  redirect("/dashboard/services");
}

export async function deleteServiceAction(formData: FormData) {
  const { sb, tech } = await ctx();
  await deleteService(sb, String(formData.get("id") ?? ""));
  revalidatePath("/dashboard/services");
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
export async function addPatchTestAction(formData: FormData) {
  const { sb, tech } = await ctx();
  const clientId = String(formData.get("clientId") ?? "");
  const categoryId = String(formData.get("categoryId") ?? "");
  const performedDate = String(formData.get("performedAt") ?? "");
  const category = categoryId ? await getCategory(sb, categoryId) : null;
  if (clientId && category && performedDate) {
    const performed = fromZonedTime(`${performedDate}T12:00:00`, TZ);
    const expires = new Date(performed.getTime() + category.patchTestValidityDays * 24 * 60 * 60 * 1000);
    await createPatchTest(sb, {
      techId: tech.id,
      clientId,
      categoryId,
      performedAtIso: performed.toISOString(),
      expiresAtIso: expires.toISOString(),
      result: String(formData.get("result") ?? "pass") as "pending" | "pass" | "fail",
      bookingId: null,
      notes: String(formData.get("notes") ?? "").trim(),
    });
  }
  revalidatePath(`/dashboard/clients/${clientId}`);
  redirect(`/dashboard/clients/${clientId}`);
}

// ---------------- Bookings ----------------
export async function setBookingStatusAction(formData: FormData) {
  const { sb, tech } = await ctx();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "") as BookingStatus;
  const booking = await getBooking(sb, id);
  if (!booking) redirect("/dashboard/bookings");

  const patch: Partial<typeof booking> = { status };

  if (status === "no_show") {
    patch.depositStatus = booking!.depositStatus === "paid" ? "forfeited" : booking!.depositStatus;
    const client = await getClient(sb, booking!.clientId);
    if (client) await updateClient(sb, client.id, { noShowCount: client.noShowCount + 1 });
  }
  if (status === "cancelled") {
    const hoursOut = (new Date(booking!.startIso).getTime() - Date.now()) / (1000 * 60 * 60);
    if (hoursOut < tech.cancellationWindowHours) {
      // Inside the window: deposit is forfeited (kept by the tech).
      if (booking!.depositStatus === "paid") patch.depositStatus = "forfeited";
    } else if (tech.stripeConnectAccountId) {
      // Outside the window: refund everything the client paid (deposit + balance).
      const payments = await paymentsForBooking(sb, booking!.id);
      for (const p of payments) {
        if (p.status !== "succeeded" || !p.providerRef) continue;
        if (p.kind !== "deposit" && p.kind !== "balance") continue;
        try {
          await refundOnConnect(tech, p.providerRef);
          if (p.kind === "deposit") patch.depositStatus = "refunded";
          if (p.kind === "balance") patch.balanceStatus = "refunded";
        } catch {
          /* leave as paid; tech can refund manually from Stripe */
        }
      }
    }
  }

  await updateBooking(sb, id, patch);
  revalidatePath("/dashboard/bookings");
  revalidatePath(`/dashboard/clients/${booking!.clientId}`);
  redirect("/dashboard/bookings");
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

  await createConfirmedBooking({
    sb,
    tech,
    service: service!,
    client,
    startIso: toIso(dateTime),
    notes: String(formData.get("notes") ?? "").trim(),
  });

  revalidatePath("/dashboard/bookings");
  redirect("/dashboard/bookings");
}

// ---------------- Client photos ----------------
export async function uploadPhotoAction(formData: FormData) {
  const { sb, tech } = await ctx();
  const clientId = String(formData.get("clientId") ?? "");
  const kind = (String(formData.get("kind") ?? "other") as PhotoKind);
  const consent = formData.get("consent") === "on";
  const file = formData.get("photo") as File | null;

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

// ---------------- Reminders ----------------
export async function runRemindersAction() {
  const { sb } = await ctx();
  await processDueReminders(sb);
  revalidatePath("/dashboard/reminders");
  redirect("/dashboard/reminders?ran=1");
}
