"use server";

import { redirect } from "next/navigation";
import { supabaseService } from "@/lib/supabase/service";
import {
  bookingsForClient,
  findOrCreateClient,
  getCategory,
  getClientByEmail,
  getService,
  getTechByHandle,
  listBlockingBookingsInRange,
  listQuestions,
  listServices,
  listTimeOff,
  listWorkingHours,
  listRotaHours,
  patchTestsForClient,
  createFormResponse,
  addonsForService,
} from "@/lib/db/queries";
import { isUniqueViolation } from "@/lib/db/errors";
import type { BookingAddon, FormAnswer } from "@/lib/db/types";
import {
  basketAmounts,
  basketDurationMin,
  basketStartTimes,
  bookingAmounts,
  daySlots,
  daySlotsForDuration,
  withTechAvailability,
  dateStrInTz,
  evaluateEligibility,
  findPatchTestService,
  bufferMapFromServices,
  intersectWeekdays,
  needsManualApproval,
  scoreClientRisk,
  treatmentSlotsAfterPatchTest,
  validatePairedPatchTestTiming,
  type AvailabilityCtx,
} from "@/lib/rules";
import { rateLimit } from "@/lib/rate-limit";
import { createWaitlistEntry } from "@/lib/db/queries";
import { addDaysToDateStr, currentWeekStartLondon } from "@/lib/rota";
import {
  createBasketBookings,
  createConfirmedBooking,
  createPairedPatchTestBooking,
  createPendingApprovalBooking,
  createPendingOnlineBooking,
  linkPairedBookings,
  loyaltyDiscountFor,
} from "@/lib/bookings";
import { resolveBasketExtras } from "@/lib/booking/basket";
import { ANY_STAFF, capableStaff } from "@/lib/booking/staff";
import { timeOffAppliesToStaff } from "@/lib/booking/staff-day";
import { listStaff, staffServiceMap } from "@/lib/db/queries";
import type { StaffMember, Tech } from "@/lib/db/types";

/** Client asks to be told when a cancellation frees up a slot. */
export async function joinWaitlistAction(formData: FormData) {
  const handle = String(formData.get("handle") ?? "");
  const serviceId = String(formData.get("serviceId") ?? "");
  if (!(await rateLimit("join-waitlist", { limit: 5, windowMs: 60_000 })).ok) {
    redirect(`/${handle}?service=${serviceId}&err=rate`);
  }
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const dateStr = String(formData.get("date") ?? "").trim();

  const sb = supabaseService();
  const tech = await getTechByHandle(sb, handle);
  if (!tech || !name || !email) redirect(`/${handle}?service=${serviceId}`);

  await createWaitlistEntry(sb, {
    techId: tech!.id,
    serviceId: serviceId || null,
    name,
    email,
    phone,
    dateStr: /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? dateStr : "",
  });
  redirect(`/${handle}?service=${serviceId}&wl=1`);
}

import { createCardCaptureCheckout, createDepositCheckout } from "@/lib/payments";
import { isPaymentsReady, usesCardCapture, acceptsOnlineBookings } from "@/lib/subscriptions";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

async function loadAvailability(
  sb: ReturnType<typeof supabaseService>,
  tech: Pick<
    Tech,
    | "id"
    | "flexibleHoursEnabled"
    | "flexibleStartMinutes"
    | "flexibleEndMinutes"
    | "flexibleLastStartMinutes"
  >,
): Promise<AvailabilityCtx> {
  const rangeEnd = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();
  const rotaFrom = currentWeekStartLondon();
  const rotaTo = addDaysToDateStr(rotaFrom, 7 * 12);
  const [workingHours, timeOff, bookings, rotaHours, services] = await Promise.all([
    listWorkingHours(sb, tech.id),
    listTimeOff(sb, tech.id),
    listBlockingBookingsInRange(sb, tech.id, new Date().toISOString(), rangeEnd),
    listRotaHours(sb, tech.id, { fromWeek: rotaFrom, toWeek: rotaTo }),
    listServices(sb, tech.id),
  ]);
  return {
    ...withTechAvailability({ workingHours, timeOff, bookings }, tech),
    rotaHours,
    bufferByServiceId: bufferMapFromServices(services),
  };
}

/** Rows belonging to one staff member (legacy null rows count as the owner's). */
function rowsForStaff<T extends { staffId?: string | null }>(rows: T[], staff: StaffMember): T[] {
  return rows.filter(
    (r) => r.staffId === staff.id || (r.staffId == null && staff.role === "owner"),
  );
}

/**
 * Who takes this visit? Returns the chosen (or auto-assigned) staff member, or
 * null for pre-migration accounts with no staff rows, or "invalid" when the
 * requested person can't perform the visit.
 */
async function resolveBookingStaff(
  sb: ReturnType<typeof supabaseService>,
  techId: string,
  serviceIds: string[],
  requested: string,
  slotIso: string,
  totalDurationMin: number,
  availability: AvailabilityCtx,
  allowedWeekdays?: number[] | null,
): Promise<{ staff: StaffMember | null; legacy: boolean } | "invalid"> {
  const staffList = await listStaff(sb, techId, { activeOnly: true }).catch(
    () => [] as StaffMember[],
  );
  if (staffList.length === 0) return { staff: null, legacy: true };

  const restrictions = await staffServiceMap(sb, staffList.map((s) => s.id)).catch(
    () => ({}) as Record<string, string[]>,
  );
  const capable = capableStaff(staffList, restrictions, serviceIds);
  if (capable.length === 0) return "invalid";

  const dateStr = dateStrInTz(new Date(slotIso));
  const freeFor = (staff: StaffMember) =>
    daySlotsForDuration(totalDurationMin, dateStr, {
      workingHours: rowsForStaff(availability.workingHours, staff),
      timeOff: timeOffAppliesToStaff(availability.timeOff, staff.id),
      bookings: rowsForStaff(availability.bookings, staff),
      flexibleHours: availability.flexibleHours,
      rotaHours: rowsForStaff(availability.rotaHours ?? [], staff),
      allowedWeekdays,
      bufferByServiceId: availability.bufferByServiceId,
    }).includes(slotIso);

  if (requested && requested !== ANY_STAFF) {
    const staff = capable.find((s) => s.id === requested);
    if (!staff) return "invalid";
    return freeFor(staff) ? { staff, legacy: false } : "invalid";
  }

  // "Any available": first capable person free at this exact time.
  for (const staff of capable) {
    if (freeFor(staff)) return { staff, legacy: false };
  }
  return "invalid";
}

/** Scope an availability context to one staff member when one is chosen. */
async function scopeCtxToStaff(
  sb: ReturnType<typeof supabaseService>,
  techId: string,
  ctx: AvailabilityCtx,
  staffId: string | null | undefined,
): Promise<AvailabilityCtx> {
  if (!staffId) return ctx;
  const staffList = await listStaff(sb, techId, { activeOnly: true }).catch(
    () => [] as StaffMember[],
  );
  const staff = staffList.find((s) => s.id === staffId);
  if (!staff) return ctx;
  return {
    workingHours: rowsForStaff(ctx.workingHours, staff),
    timeOff: timeOffAppliesToStaff(ctx.timeOff, staff.id),
    bookings: rowsForStaff(ctx.bookings, staff),
    flexibleHours: ctx.flexibleHours,
    rotaHours: rowsForStaff(ctx.rotaHours ?? [], staff),
    bufferByServiceId: ctx.bufferByServiceId,
    allowedWeekdays: ctx.allowedWeekdays,
  };
}

/** Treatment slots valid after a chosen patch-test time (client-side step 2). */
export async function loadTreatmentSlotsAfterPatchAction(
  handle: string,
  treatmentServiceId: string,
  patchSlotIso: string,
  staffId?: string | null,
): Promise<{ dateStr: string; slots: string[] }[]> {
  const sb = supabaseService();
  const tech = await getTechByHandle(sb, handle);
  const treatmentService = await getService(sb, treatmentServiceId);
  if (!tech || !treatmentService || !patchSlotIso) return [];

  const [category, services, fullCtx] = await Promise.all([
    getCategory(sb, treatmentService.categoryId),
    listServices(sb, tech.id),
    loadAvailability(sb, tech),
  ]);
  const patchTestService = findPatchTestService(services, treatmentService.categoryId);
  if (!patchTestService) return [];

  const ctx = await scopeCtxToStaff(sb, tech.id, fullCtx, staffId);
  return treatmentSlotsAfterPatchTest(
    treatmentService,
    patchTestService,
    patchSlotIso,
    category,
    ctx,
  );
}

export async function createPairedPublicBookingAction(formData: FormData) {
  const handle = String(formData.get("handle") ?? "");
  const serviceId = String(formData.get("serviceId") ?? "");
  const pairStaffId = String(formData.get("staffId") ?? "").trim() || null;
  const patchSlotIso = String(formData.get("patchSlot") ?? "");
  const treatmentSlotIso = String(formData.get("slot") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const policyAccepted = formData.get("policyAccepted") === "on";

  const base = `/${handle}?service=${serviceId}&pair=1&patchSlot=${encodeURIComponent(patchSlotIso)}&slot=${encodeURIComponent(treatmentSlotIso)}`;

  if (!(await rateLimit("public-booking", { limit: 5, windowMs: 60_000 })).ok) {
    redirect(`${base}&err=rate`);
  }

  const sb = supabaseService();
  const tech = await getTechByHandle(sb, handle);
  const service = serviceId ? await getService(sb, serviceId) : null;
  if (!tech || !service || !patchSlotIso || !treatmentSlotIso || !name || !email) {
    redirect(`${base}&err=missing`);
  }
  if (!acceptsOnlineBookings(tech)) redirect(`/${tech.handle}?service=${serviceId}&err=not_live`);
  if (!policyAccepted) redirect(`${base}&err=form`);

  const [category, services, fullCtx] = await Promise.all([
    getCategory(sb, service.categoryId),
    listServices(sb, tech.id),
    loadAvailability(sb, tech),
  ]);
  const patchTestService = findPatchTestService(services, service.categoryId);
  if (!patchTestService) redirect(`/${handle}?service=${serviceId}&err=patch`);

  // Paired bookings stay with one person; scope the diary when one is set.
  const ctx = await scopeCtxToStaff(sb, tech!.id, fullCtx, pairStaffId);

  const timing = validatePairedPatchTestTiming(
    patchTestService,
    patchSlotIso,
    treatmentSlotIso,
    category,
  );
  if (!timing.ok) redirect(`${base}&err=pair_timing`);

  const patchDateStr = dateStrInTz(new Date(patchSlotIso));
  const patchFree = daySlots(patchTestService, patchDateStr, ctx).includes(patchSlotIso);
  const treatmentDays = treatmentSlotsAfterPatchTest(
    service,
    patchTestService,
    patchSlotIso,
    category,
    ctx,
  );
  const treatmentFree = treatmentDays.some((d) => d.slots.includes(treatmentSlotIso));
  if (!patchFree || !treatmentFree) redirect(`${base}&err=slot`);

  const existing = await getClientByEmail(sb, tech.id, email);
  const categoryByServiceId: Record<string, string> = {};
  for (const s of services) categoryByServiceId[s.id] = s.categoryId;
  const priorBookings = existing ? await bookingsForClient(sb, tech.id, existing.id) : [];
  const infill = evaluateEligibility(service, existing, treatmentSlotIso, {
    category,
    patchTests: [],
    priorBookings,
    categoryByServiceId,
  });
  if (infill.blacklisted) redirect(`${base}&err=blocked`);
  if (!infill.infill.ok) redirect(`${base}&err=infill`);

  const client = await findOrCreateClient(sb, tech.id, { name, email, phone });
  const available = await addonsForService(sb, service.id, { activeOnly: true });
  const addons: BookingAddon[] = available
    .filter((a) => formData.get(`addon_${a.id}`) === "on")
    .map((a) => ({ name: a.name, pricePennies: a.pricePennies }));

  const completedVisits = priorBookings.filter((b) => b.status === "completed").length;
  const gross = service.pricePennies + addons.reduce((s, a) => s + a.pricePennies, 0);
  const discountPennies = loyaltyDiscountFor(tech, completedVisits, gross, client.isVip);

  const questions = await listQuestions(sb, tech.id, { activeOnly: true });
  const answers: FormAnswer[] = questions
    .map((q) => {
      const answer = String(formData.get(`q_${q.id}`) ?? "").trim();
      const detail = String(formData.get(`q_${q.id}_detail`) ?? "").trim();
      return { prompt: q.prompt, answer: detail ? `${answer} - ${detail}` : answer };
    })
    .filter((a) => a.answer);
  const missingRequiredAnswer = questions.some((q) => {
    if (!q.required) return false;
    return !String(formData.get(`q_${q.id}`) ?? "").trim();
  });
  if (missingRequiredAnswer) redirect(`${base}&err=form`);

  const patchBooking = await (async () => {
    try {
      return await createPairedPatchTestBooking({
        sb,
        tech,
        client,
        treatmentService: service,
        patchTestService,
        category,
        patchSlotIso,
        staffId: pairStaffId,
      });
    } catch (e) {
      if (isUniqueViolation(e)) redirect(`${base}&err=slot`);
      throw e;
    }
  })();

  const saveAnswers = async (bookingId: string) => {
    if (answers.length) {
      await createFormResponse(sb, { techId: tech.id, clientId: client.id, bookingId, answers });
    }
  };

  const riskTier = scoreClientRisk(client, { completedVisits }, tech);
  const manualApproval = needsManualApproval(tech, riskTier);
  const autoApproved = !manualApproval && tech.approvalMode === "rules";
  const cardCapture = usesCardCapture(tech);

  if (manualApproval) {
    let pending;
    try {
      pending = await createPendingApprovalBooking({
        sb,
        tech,
        service,
        client,
        startIso: treatmentSlotIso,
        staffId: pairStaffId,
        addons,
        discountPennies,
        riskTier,
        pairedBookingId: patchBooking.id,
        depositOverridePennies: cardCapture ? 0 : null,
      });
    } catch (e) {
      if (isUniqueViolation(e)) redirect(`${base}&err=slot`);
      throw e;
    }
    await linkPairedBookings(sb, patchBooking.id, pending.id);
    await saveAnswers(pending.id);
    const { notifyTechOfBookingRequest } = await import("@/lib/notify");
    await notifyTechOfBookingRequest(sb, pending, { completedVisits });
    redirect(`/${tech.handle}/requested/${pending.balanceToken}`);
  }

  const deposit = cardCapture
    ? 0
    : bookingAmounts(service, tech, riskTier, addons, discountPennies).deposit;

  if ((deposit > 0 || cardCapture) && isPaymentsReady(tech)) {
    let pending;
    try {
      pending = await createPendingOnlineBooking({
        sb,
        tech,
        service,
        client,
        startIso: treatmentSlotIso,
        staffId: pairStaffId,
        addons,
        discountPennies,
        riskTier,
        autoApproved,
        pairedBookingId: patchBooking.id,
        depositOverridePennies: cardCapture ? 0 : null,
      });
    } catch (e) {
      if (isUniqueViolation(e)) redirect(`${base}&err=slot`);
      throw e;
    }
    await linkPairedBookings(sb, patchBooking.id, pending.id);
    await saveAnswers(pending.id);
    const url = cardCapture
      ? await createCardCaptureCheckout(tech, service, pending, client, APP_URL)
      : await createDepositCheckout(tech, service, pending, APP_URL);
    redirect(url);
  }

  let treatmentBooking;
  try {
    treatmentBooking = await createConfirmedBooking({
      sb,
      tech,
      service,
      client,
      startIso: treatmentSlotIso,
        staffId: pairStaffId,
      addons,
      discountPennies,
      riskTier,
      autoApproved,
      pairedBookingId: patchBooking.id,
    });
  } catch (e) {
    if (isUniqueViolation(e)) redirect(`${base}&err=slot`);
    throw e;
  }
  await linkPairedBookings(sb, patchBooking.id, treatmentBooking.id);
  await saveAnswers(treatmentBooking.id);
  redirect(`/${tech.handle}/booked/${treatmentBooking.balanceToken}`);
}

export async function createPublicBookingAction(formData: FormData) {
  const handle = String(formData.get("handle") ?? "");
  const serviceId = String(formData.get("serviceId") ?? "");
  const alsoParam = String(formData.get("also") ?? "");
  const requestedStaff = String(formData.get("staff") ?? ANY_STAFF);
  const slotIso = String(formData.get("slot") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const policyAccepted = formData.get("policyAccepted") === "on";

  // Generous for real clients, hostile to scripts hammering the booking form.
  if (!(await rateLimit("public-booking", { limit: 5, windowMs: 60_000 })).ok) {
    redirect(`/${handle}?service=${serviceId}&err=rate`);
  }

  const sb = supabaseService();
  const tech = await getTechByHandle(sb, handle);
  const service = serviceId ? await getService(sb, serviceId) : null;
  if (!tech || !service || !slotIso || !name || !email) {
    redirect(`/${handle}?service=${serviceId}&slot=${encodeURIComponent(slotIso)}&err=missing`);
  }

  // Gating: the studio must have an active subscription to take online bookings.
  if (!acceptsOnlineBookings(tech!)) {
    redirect(`/${tech!.handle}?service=${serviceId}&err=not_live`);
  }

  const alsoQs = alsoParam ? `&also=${encodeURIComponent(alsoParam)}` : "";
  const base = `/${tech!.handle}?service=${serviceId}${alsoQs}&slot=${encodeURIComponent(slotIso)}`;
  if (!policyAccepted) redirect(`${base}&err=form`);

  // Re-check the slot is still free (respects flexible hours when enabled).
  const availability = await loadAvailability(sb, tech!);

  // Client history + full service list (needed for rules and the basket).
  const existing = await getClientByEmail(sb, tech!.id, email);
  const [category, services] = await Promise.all([
    getCategory(sb, service!.categoryId),
    listServices(sb, tech!.id),
  ]);

  // Basket: extra treatments booked back-to-back in the same visit. The whole
  // visit needs one continuous free window.
  const extras = resolveBasketExtras(services, service!.id, alsoParam);
  const basket = [service!, ...extras];
  const totalDuration = basketDurationMin(basket);
  const allowedWeekdays = intersectWeekdays(basket);

  // Resolve who takes the visit (salon mode) and re-check their diary is
  // still free. Pre-migration accounts fall back to the whole-diary check.
  const resolved = await resolveBookingStaff(
    sb,
    tech!.id,
    basket.map((s) => s.id),
    requestedStaff,
    slotIso,
    totalDuration,
    availability,
    allowedWeekdays,
  );
  if (resolved === "invalid") {
    redirect(`/${tech!.handle}?service=${serviceId}${alsoQs}&err=slot`);
  }
  const bookingStaff = (resolved as { staff: StaffMember | null }).staff;

  if (!bookingStaff) {
    const dateStr = dateStrInTz(new Date(slotIso));
    const stillFree = daySlotsForDuration(totalDuration, dateStr, {
      ...availability,
      allowedWeekdays,
    }).includes(slotIso);
    if (!stillFree) {
      redirect(`/${tech!.handle}?service=${serviceId}${alsoQs}&err=slot`);
    }
  }

  const categoryByServiceId: Record<string, string> = {};
  for (const s of services) categoryByServiceId[s.id] = s.categoryId;

  const [patchTests, priorBookings] = existing
    ? await Promise.all([
        patchTestsForClient(sb, tech!.id, existing.id),
        bookingsForClient(sb, tech!.id, existing.id),
      ])
    : [[], []];

  // Evaluate patch-test / infill / blacklist rules for EVERY treatment in the
  // visit, each at its own start time.
  const starts = basketStartTimes(basket, slotIso);
  const categoriesById = new Map([[category?.id ?? "", category]]);
  for (let i = 0; i < basket.length; i++) {
    const svc = basket[i];
    let svcCategory = categoriesById.get(svc.categoryId) ?? null;
    if (!svcCategory && !categoriesById.has(svc.categoryId)) {
      svcCategory = await getCategory(sb, svc.categoryId);
      categoriesById.set(svc.categoryId, svcCategory);
    }
    const eligibility = evaluateEligibility(svc, existing, starts[i], {
      category: svcCategory,
      patchTests,
      priorBookings,
      categoryByServiceId,
    });

    if (eligibility.blacklisted) redirect(`${base}&err=blocked`);
    if (!eligibility.patch.ok) {
      // Single-service bookings can switch to the paired patch-test flow;
      // baskets can't, so the client books that treatment separately.
      const patchTestService = findPatchTestService(services, svc.categoryId);
      if (basket.length === 1 && patchTestService && svc.requiresPatchTest) {
        redirect(`/${tech!.handle}?service=${serviceId}&pair=1`);
      }
      redirect(`${base}&err=${basket.length > 1 ? "basket_patch" : "patch"}`);
    }
    if (!eligibility.infill.ok) redirect(`${base}&err=infill`);
  }

  const client = await findOrCreateClient(sb, tech!.id, { name, email, phone });

  // Extras chosen by the client (validated against the service's real add-ons).
  const available = await addonsForService(sb, service!.id, { activeOnly: true });
  const addons: BookingAddon[] = available
    .filter((a) => formData.get(`addon_${a.id}`) === "on")
    .map((a) => ({ name: a.name, pricePennies: a.pricePennies }));

  // Loyalty reward: VIPs and returning clients past the visit threshold.
  const completedVisits = priorBookings.filter((b) => b.status === "completed").length;
  const gross =
    basket.reduce((s, svc) => s + svc.pricePennies, 0) +
    addons.reduce((s, a) => s + a.pricePennies, 0);
  const discountPennies = loyaltyDiscountFor(tech!, completedVisits, gross, client.isVip);

  // Collect consultation answers (if the tech has questions).
  const questions = await listQuestions(sb, tech!.id, { activeOnly: true });
  const answers: FormAnswer[] = questions
    .map((q) => {
      const answer = String(formData.get(`q_${q.id}`) ?? "").trim();
      // Yes/No questions can carry a follow-up detail ("Yes - nut allergy").
      const detail = String(formData.get(`q_${q.id}_detail`) ?? "").trim();
      return { prompt: q.prompt, answer: detail ? `${answer} - ${detail}` : answer };
    })
    .filter((a) => a.answer);
  const missingRequiredAnswer = questions.some((q) => {
    if (!q.required) return false;
    return !String(formData.get(`q_${q.id}`) ?? "").trim();
  });
  if (missingRequiredAnswer) redirect(`${base}&err=form`);
  const saveAnswers = async (bookingId: string) => {
    if (answers.length) {
      await createFormResponse(sb, { techId: tech!.id, clientId: client.id, bookingId, answers });
    }
  };

  const riskTier = scoreClientRisk(client, { completedVisits }, tech!);
  const manualApproval = needsManualApproval(tech!, riskTier);
  const autoApproved = !manualApproval && tech!.approvalMode === "rules";
  const isBasket = basket.length > 1;

  // Card capture mode: no deposit is taken; the client saves a card instead
  // and the tech can charge their no-show fee if the client doesn't turn up.
  const cardCapture = usesCardCapture(tech!);

  // Stripe line-item label: name the whole visit, not just the first treatment.
  const checkoutService = isBasket
    ? { ...service!, name: `${service!.name} + ${extras.length} more treatment${extras.length > 1 ? "s" : ""}` }
    : service!;

  if (manualApproval) {
    let pending;
    try {
      if (isBasket) {
        const created = await createBasketBookings({
          sb,
          tech: tech!,
          services: basket,
          client,
          startIso: slotIso,
          staffId: bookingStaff?.id ?? null,
          status: "pending_approval",
          addons,
          discountPennies,
          riskTier,
          depositOverridePennies: cardCapture ? 0 : null,
        });
        pending = created.primary;
      } else {
        pending = await createPendingApprovalBooking({
          sb,
          tech: tech!,
          service: service!,
          client,
          startIso: slotIso,
          staffId: bookingStaff?.id ?? null,
          addons,
          discountPennies,
          riskTier,
          depositOverridePennies: cardCapture ? 0 : null,
        });
      }
    } catch (e) {
      if (isUniqueViolation(e)) redirect(`/${tech!.handle}?service=${serviceId}${alsoQs}&err=slot`);
      throw e;
    }
    await saveAnswers(pending.id);
    const { notifyTechOfBookingRequest } = await import("@/lib/notify");
    await notifyTechOfBookingRequest(sb, pending, { completedVisits });
    redirect(`/${tech!.handle}/requested/${pending.balanceToken}`);
  }

  const deposit = cardCapture
    ? 0
    : isBasket
      ? basketAmounts(basket, tech!, riskTier, addons, discountPennies).deposit
      : bookingAmounts(service!, tech!, riskTier, addons, discountPennies).deposit;

  // If money (deposit) or a saved card is needed and the tech can take card
  // payments, send the client to Stripe Checkout on the tech's connected
  // account. Otherwise confirm now (deposit settled in person).
  if ((deposit > 0 || cardCapture) && isPaymentsReady(tech!)) {
    let pending;
    try {
      if (isBasket) {
        const created = await createBasketBookings({
          sb,
          tech: tech!,
          services: basket,
          client,
          startIso: slotIso,
          staffId: bookingStaff?.id ?? null,
          status: "pending",
          addons,
          discountPennies,
          riskTier,
          autoApproved,
          depositOverridePennies: cardCapture ? 0 : null,
        });
        pending = created.primary;
      } else {
        pending = await createPendingOnlineBooking({
          sb,
          tech: tech!,
          service: service!,
          client,
          startIso: slotIso,
          staffId: bookingStaff?.id ?? null,
          addons,
          discountPennies,
          riskTier,
          autoApproved,
          depositOverridePennies: cardCapture ? 0 : null,
        });
      }
    } catch (e) {
      if (isUniqueViolation(e)) redirect(`/${tech!.handle}?service=${serviceId}${alsoQs}&err=slot`);
      throw e;
    }
    await saveAnswers(pending.id);
    try {
      const { notifySalonOfNewBooking } = await import("@/lib/notify");
      await notifySalonOfNewBooking(sb, pending);
    } catch {
      // Notify is best-effort.
    }
    const url = cardCapture
      ? await createCardCaptureCheckout(tech!, checkoutService, pending, client, APP_URL)
      : await createDepositCheckout(tech!, checkoutService, pending, APP_URL);
    redirect(url);
  }

  let booking;
  try {
    if (isBasket) {
      const created = await createBasketBookings({
        sb,
        tech: tech!,
        services: basket,
        client,
        startIso: slotIso,
          staffId: bookingStaff?.id ?? null,
        status: "confirmed",
        addons,
        discountPennies,
        riskTier,
        autoApproved,
      });
      booking = created.primary;
    } else {
      booking = await createConfirmedBooking({
        sb,
        tech: tech!,
        service: service!,
        client,
        startIso: slotIso,
          staffId: bookingStaff?.id ?? null,
        addons,
        discountPennies,
        riskTier,
        autoApproved,
      });
    }
  } catch (e) {
    if (isUniqueViolation(e)) redirect(`/${tech!.handle}?service=${serviceId}${alsoQs}&err=slot`);
    throw e;
  }
  await saveAnswers(booking.id);
  try {
    const { notifySalonOfNewBooking } = await import("@/lib/notify");
    await notifySalonOfNewBooking(sb, booking);
  } catch {
    // Notify is best-effort.
  }
  redirect(`/${tech!.handle}/booked/${booking.balanceToken}`);
}
