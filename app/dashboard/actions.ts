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
  listBookings,
  listCategories,
  listServices,
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
    loyaltyVisitThreshold: clampInt(get("loyaltyVisitThreshold"), 0, 100, tech.loyaltyVisitThreshold),
    loyaltyDiscountPct: clampInt(get("loyaltyDiscountPct"), 0, 50, tech.loyaltyDiscountPct),
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
    aftercareText: String(formData.get("aftercareText") ?? "").trim(),
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

  if (status === "completed" && booking!.status !== "completed") {
    try {
      const { sendAftercareEmail } = await import("@/lib/notify");
      await sendAftercareEmail(sb, booking!);
    } catch {
      // Aftercare email is best-effort; completing the booking always succeeds.
    }
  }

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

  // Loyalty reward applies to manual bookings too.
  const { loyaltyDiscountFor } = await import("@/lib/bookings");
  const completedVisits = existing.filter((b) => b.status === "completed").length;
  const discountPennies = loyaltyDiscountFor(tech, completedVisits, service!.pricePennies);

  await createConfirmedBooking({
    sb,
    tech,
    service: service!,
    client,
    startIso,
    notes: String(formData.get("notes") ?? "").trim(),
    paymentTaken,
    paymentMethod,
    depositOverridePennies,
    discountPennies,
  });

  revalidatePath("/dashboard/bookings");
  redirect("/dashboard/bookings");
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

  revalidatePath("/dashboard/bookings");
  redirect(`/dashboard/bookings/${id}?saved=1`);
}

/** Record an offline payment (cash, bank transfer, PayPal...) on a booking. */
export async function recordManualPaymentAction(formData: FormData) {
  const { sb, tech } = await ctx();
  const id = String(formData.get("id") ?? "");
  const what = String(formData.get("what") ?? ""); // deposit | balance | full
  const method = String(formData.get("method") ?? "cash");
  const booking = await getBooking(sb, id);
  if (!booking || booking.techId !== tech.id) redirect("/dashboard/bookings");

  const { createPayment } = await import("@/lib/db/queries");
  const patch: Record<string, unknown> = {};

  if ((what === "deposit" || what === "full") && booking!.depositStatus !== "paid" && booking!.depositPennies > 0) {
    await createPayment(sb, {
      techId: tech.id,
      bookingId: id,
      kind: "deposit",
      amountPennies: booking!.depositPennies,
      status: "succeeded",
      provider: method,
      providerRef: "",
    });
    patch.depositStatus = "paid";
  }
  if ((what === "balance" || what === "full") && booking!.balanceStatus !== "paid" && booking!.balancePennies > 0) {
    await createPayment(sb, {
      techId: tech.id,
      bookingId: id,
      kind: "balance",
      amountPennies: booking!.balancePennies,
      status: "succeeded",
      provider: method,
      providerRef: "",
    });
    patch.balanceStatus = "paid";
  }

  if (Object.keys(patch).length) await updateBooking(sb, id, patch);
  revalidatePath("/dashboard/bookings");
  redirect(`/dashboard/bookings/${id}?saved=1`);
}

/** Hard delete a mistake booking: no strike, no history, reminders removed. */
export async function deleteBookingAction(formData: FormData) {
  const { sb, tech } = await ctx();
  const id = String(formData.get("id") ?? "");
  const booking = await getBooking(sb, id);
  if (booking && booking.techId === tech.id) {
    const { deleteBooking } = await import("@/lib/db/queries");
    await deleteBooking(sb, id);
  }
  revalidatePath("/dashboard/bookings");
  redirect("/dashboard/bookings");
}

// ---------------- Service photos & add-ons ----------------
export async function setServicePhotoAction(formData: FormData) {
  const { sb, tech } = await ctx();
  const serviceId = String(formData.get("serviceId") ?? "");
  const file = formData.get("photo") as File | null;
  const service = await getService(sb, serviceId);
  if (service && service.techId === tech.id && file && file.size > 0) {
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
    const path = `svc/${tech.id}/${serviceId}.${ext}`;
    const bytes = new Uint8Array(await file.arrayBuffer());
    await uploadPhoto(path, bytes, file.type || "image/jpeg", { upsert: true });
    await updateService(sb, serviceId, { photoPath: path });
  }
  revalidatePath("/dashboard/services");
  redirect("/dashboard/services");
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
  redirect("/dashboard/services");
}

export async function addAddonAction(formData: FormData) {
  const { sb, tech } = await ctx();
  const serviceId = String(formData.get("serviceId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const price = poundsToPennies(String(formData.get("pricePounds") ?? "0"));
  const service = await getService(sb, serviceId);
  if (service && service.techId === tech.id && name) {
    const { createAddon } = await import("@/lib/db/queries");
    await createAddon(sb, {
      techId: tech.id,
      serviceId,
      name,
      pricePennies: Math.max(0, price),
      active: true,
    });
  }
  revalidatePath("/dashboard/services");
  redirect("/dashboard/services");
}

export async function deleteAddonAction(formData: FormData) {
  const { sb } = await ctx();
  const id = String(formData.get("id") ?? "");
  const { deleteAddon } = await import("@/lib/db/queries");
  await deleteAddon(sb, id);
  revalidatePath("/dashboard/services");
  redirect("/dashboard/services");
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
  const { sb } = await ctx();
  const id = String(formData.get("id") ?? "");
  const clientId = String(formData.get("clientId") ?? "");
  const { error } = await sb.from("form_responses").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/clients/${clientId}`);
  redirect(`/dashboard/clients/${clientId}`);
}

/** Delete a patch test record. */
export async function deletePatchTestAction(formData: FormData) {
  const { sb } = await ctx();
  const id = String(formData.get("id") ?? "");
  const clientId = String(formData.get("clientId") ?? "");
  const { error } = await sb.from("patch_tests").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/clients/${clientId}`);
  redirect(`/dashboard/clients/${clientId}`);
}

// ---------------- Migration imports (clients, services, appointments) ----------------
export async function importClientsAction(formData: FormData) {
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

  revalidatePath("/dashboard/clients");
  redirect(`${back}?import=done&what=clients&n=${imported}&s=${skipped}`);
}

export async function importServicesAction(formData: FormData) {
  const { sb, tech } = await ctx();
  const file = formData.get("csv") as File | null;
  if (!file || file.size === 0) redirect("/dashboard/import?import=empty");

  const { parseCsv, col, moneyToPennies, toMinutes } = await import("@/lib/csv");
  const { headers, rows } = parseCsv(await file!.text());
  if (rows.length === 0) redirect("/dashboard/import?import=empty");

  const iName = col(headers, "name", "servicename", "service", "itemname", "treatmentname", "title", "item");
  const iPrice = col(headers, "price", "amount", "cost", "retailprice", "priceamount");
  const iDuration = col(headers, "duration", "durationmin", "durationminutes", "durationmins", "length", "time", "servicelength");
  const iCategory = col(headers, "category", "categoryname", "servicecategory", "group", "type");
  const iDesc = col(headers, "description", "details", "servicedescription");

  if (iName === -1) redirect("/dashboard/import?import=badformat");

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

  for (const cols of rows) {
    const name = (cols[iName] ?? "").trim();
    if (!name || existingNames.has(name.toLowerCase())) { skipped++; continue; }
    const pricePennies = iPrice !== -1 ? moneyToPennies(cols[iPrice] ?? "") : 0;
    const durationMin = iDuration !== -1 ? toMinutes(cols[iDuration] ?? "") : 60;
    const categoryId = await ensureCategory(iCategory !== -1 ? cols[iCategory] ?? "" : "");

    await createService(sb, {
      techId: tech.id,
      categoryId,
      name,
      description: iDesc !== -1 ? (cols[iDesc] ?? "") : "",
      durationMin: durationMin || 60,
      pricePennies,
      depositType: "percent",
      depositValue: tech.defaultDepositPct,
      requiresPatchTest: false,
      isInfill: false,
      fullSetServiceId: null,
      infillMaxGapDays: 21,
      active: true,
      sortOrder: sortOrder++,
    });
    existingNames.add(name.toLowerCase());
    imported++;
  }

  revalidatePath("/dashboard/services");
  redirect(`/dashboard/import?import=done&what=services&n=${imported}&s=${skipped}`);
}

export async function importBookingsAction(formData: FormData) {
  const { sb, tech } = await ctx();
  const file = formData.get("csv") as File | null;
  if (!file || file.size === 0) redirect("/dashboard/import?import=empty");

  const { parseCsv, col } = await import("@/lib/csv");
  const { headers, rows } = parseCsv(await file!.text());
  if (rows.length === 0) redirect("/dashboard/import?import=empty");

  const iClient = col(headers, "client", "clientname", "customer", "customername", "name", "fullname");
  const iEmail = col(headers, "email", "clientemail", "customeremail", "emailaddress");
  const iService = col(headers, "service", "servicename", "item", "treatment", "appointmentservice", "itemname");
  const iDate = col(headers, "datetime", "date", "startsat", "start", "starttime", "appointmentdate", "startdate");
  const iTime = col(headers, "time", "appointmenttime");
  const iStatus = col(headers, "status", "appointmentstatus");

  if (iClient === -1 || iService === -1 || iDate === -1) redirect("/dashboard/import?import=badformat");

  const services = await listServices(sb, tech.id);
  const serviceByName = new Map(services.map((s) => [s.name.toLowerCase(), s]));
  const existingBookings = await listBookings(sb, tech.id);
  const { createBooking: createBookingRow } = await import("@/lib/db/queries");
  const { rescheduleReminders } = await import("@/lib/bookings");
  const { randomToken: newToken } = await import("@/lib/utils");

  // UK exports commonly use dd/mm/yyyy; times are naive local (Europe/London),
  // so interpret them in the tech's timezone rather than the server's (UTC).
  const parseWhen = (dateRaw: string, timeRaw: string): Date | null => {
    let s = dateRaw.trim();
    if (timeRaw?.trim()) s = `${s} ${timeRaw.trim()}`;
    const uk = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(.*)$/);
    if (uk) {
      const yyyy = uk[3].length === 2 ? `20${uk[3]}` : uk[3];
      s = `${yyyy}-${uk[2].padStart(2, "0")}-${uk[1].padStart(2, "0")}${uk[4]}`;
    }
    // Already has an explicit offset/zone: trust it.
    if (/z$|[+-]\d{2}:?\d{2}$/i.test(s)) {
      const d = new Date(s);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[T ]?(\d{1,2})?:?(\d{2})?/);
    if (!m) {
      const d = new Date(s);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    const local = `${m[1]}-${m[2]}-${m[3]}T${(m[4] ?? "9").padStart(2, "0")}:${m[5] ?? "00"}`;
    const d = fromZonedTime(local, TZ);
    return Number.isNaN(d.getTime()) ? null : d;
  };

  let imported = 0;
  let skipped = 0;

  for (const cols of rows) {
    const clientName = (cols[iClient] ?? "").trim();
    const serviceName = (cols[iService] ?? "").trim().toLowerCase();
    const when = parseWhen(cols[iDate] ?? "", iTime !== -1 ? cols[iTime] ?? "" : "");
    const service = serviceByName.get(serviceName);
    if (!clientName || !service || !when) { skipped++; continue; }

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
    const status: BookingStatus = rawStatus.includes("cancel")
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
      endIso: new Date(startMs + service.durationMin * 60 * 1000).toISOString(),
      status,
      pricePennies: service.pricePennies,
      depositPennies: 0,
      depositStatus: "none",
      balancePennies: isPast ? 0 : service.pricePennies,
      balanceStatus: isPast ? "paid" : "unpaid",
      balanceToken: newToken(),
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

  revalidatePath("/dashboard/bookings");
  redirect(`/dashboard/import?import=done&what=appointments&n=${imported}&s=${skipped}`);
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
