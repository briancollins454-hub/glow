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
  patchTestsForClient,
  createFormResponse,
  addonsForService,
} from "@/lib/db/queries";
import type { BookingAddon, FormAnswer } from "@/lib/db/types";
import {
  bookingAmounts,
  daySlots,
  dateStrInTz,
  evaluateEligibility,
  findPatchTestService,
  needsManualApproval,
  scoreClientRisk,
  treatmentSlotsAfterPatchTest,
  validatePairedPatchTestTiming,
} from "@/lib/rules";
import { rateLimit } from "@/lib/rate-limit";
import { createWaitlistEntry } from "@/lib/db/queries";
import {
  createConfirmedBooking,
  createPairedPatchTestBooking,
  createPendingApprovalBooking,
  createPendingOnlineBooking,
  linkPairedBookings,
  loyaltyDiscountFor,
} from "@/lib/bookings";

/** Client asks to be told when a cancellation frees up a slot. */
export async function joinWaitlistAction(formData: FormData) {
  const handle = String(formData.get("handle") ?? "");
  const serviceId = String(formData.get("serviceId") ?? "");
  if (!(await rateLimit("join-waitlist", { limit: 5, windowMinutes: 10 }))) {
    redirect(`/${handle}?service=${serviceId}&wl=1`);
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

import { createDepositCheckout } from "@/lib/payments";
import { isLive, isPaymentsReady } from "@/lib/subscriptions";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

async function loadAvailability(sb: ReturnType<typeof supabaseService>, techId: string) {
  const rangeEnd = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();
  const [workingHours, timeOff, bookings] = await Promise.all([
    listWorkingHours(sb, techId),
    listTimeOff(sb, techId),
    listBlockingBookingsInRange(sb, techId, new Date().toISOString(), rangeEnd),
  ]);
  return { workingHours, timeOff, bookings };
}

/** Treatment slots valid after a chosen patch-test time (client-side step 2). */
export async function loadTreatmentSlotsAfterPatchAction(
  handle: string,
  treatmentServiceId: string,
  patchSlotIso: string,
): Promise<{ dateStr: string; slots: string[] }[]> {
  const sb = supabaseService();
  const tech = await getTechByHandle(sb, handle);
  const treatmentService = await getService(sb, treatmentServiceId);
  if (!tech || !treatmentService || !patchSlotIso) return [];

  const [category, services, ctx] = await Promise.all([
    getCategory(sb, treatmentService.categoryId),
    listServices(sb, tech.id),
    loadAvailability(sb, tech.id),
  ]);
  const patchTestService = findPatchTestService(services, treatmentService.categoryId);
  if (!patchTestService) return [];

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
  const patchSlotIso = String(formData.get("patchSlot") ?? "");
  const treatmentSlotIso = String(formData.get("slot") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const policyAccepted = formData.get("policyAccepted") === "on";

  const base = `/${handle}?service=${serviceId}&pair=1&patchSlot=${encodeURIComponent(patchSlotIso)}&slot=${encodeURIComponent(treatmentSlotIso)}`;

  if (!(await rateLimit("public-booking", { limit: 10, windowMinutes: 10 }))) {
    redirect(`${base}&err=slot`);
  }

  const sb = supabaseService();
  const tech = await getTechByHandle(sb, handle);
  const service = serviceId ? await getService(sb, serviceId) : null;
  if (!tech || !service || !patchSlotIso || !treatmentSlotIso || !name || !email) {
    redirect(`${base}&err=missing`);
  }
  if (!isLive(tech)) redirect(`/${tech.handle}?service=${serviceId}&err=not_live`);
  if (!policyAccepted) redirect(`${base}&err=form`);

  const [category, services, ctx] = await Promise.all([
    getCategory(sb, service.categoryId),
    listServices(sb, tech.id),
    loadAvailability(sb, tech.id),
  ]);
  const patchTestService = findPatchTestService(services, service.categoryId);
  if (!patchTestService) redirect(`/${handle}?service=${serviceId}&err=patch`);

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

  const patchBooking = await createPairedPatchTestBooking({
    sb,
    tech,
    client,
    treatmentService: service,
    patchTestService,
    category,
    patchSlotIso,
  });

  const saveAnswers = async (bookingId: string) => {
    if (answers.length) {
      await createFormResponse(sb, { techId: tech.id, clientId: client.id, bookingId, answers });
    }
  };

  const riskTier = scoreClientRisk(client, { completedVisits }, tech);
  const manualApproval = needsManualApproval(tech, riskTier);
  const autoApproved = !manualApproval && tech.approvalMode === "rules";

  if (manualApproval) {
    const pending = await createPendingApprovalBooking({
      sb,
      tech,
      service,
      client,
      startIso: treatmentSlotIso,
      addons,
      discountPennies,
      riskTier,
      pairedBookingId: patchBooking.id,
    });
    await linkPairedBookings(sb, patchBooking.id, pending.id);
    await saveAnswers(pending.id);
    const { notifyTechOfBookingRequest } = await import("@/lib/notify");
    await notifyTechOfBookingRequest(sb, pending, { completedVisits });
    redirect(`/${tech.handle}/requested/${pending.balanceToken}`);
  }

  const deposit = bookingAmounts(service, tech, riskTier, addons, discountPennies).deposit;

  if (deposit > 0 && isPaymentsReady(tech)) {
    const pending = await createPendingOnlineBooking({
      sb,
      tech,
      service,
      client,
      startIso: treatmentSlotIso,
      addons,
      discountPennies,
      riskTier,
      autoApproved,
      pairedBookingId: patchBooking.id,
    });
    await linkPairedBookings(sb, patchBooking.id, pending.id);
    await saveAnswers(pending.id);
    const url = await createDepositCheckout(tech, service, pending, APP_URL);
    redirect(url);
  }

  const treatmentBooking = await createConfirmedBooking({
    sb,
    tech,
    service,
    client,
    startIso: treatmentSlotIso,
    addons,
    discountPennies,
    riskTier,
    autoApproved,
    pairedBookingId: patchBooking.id,
  });
  await linkPairedBookings(sb, patchBooking.id, treatmentBooking.id);
  await saveAnswers(treatmentBooking.id);
  redirect(`/${tech.handle}/booked/${treatmentBooking.balanceToken}`);
}

export async function createPublicBookingAction(formData: FormData) {
  const handle = String(formData.get("handle") ?? "");
  const serviceId = String(formData.get("serviceId") ?? "");
  const slotIso = String(formData.get("slot") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const policyAccepted = formData.get("policyAccepted") === "on";

  // Generous for real clients, hostile to scripts hammering the booking form.
  if (!(await rateLimit("public-booking", { limit: 10, windowMinutes: 10 }))) {
    redirect(`/${handle}?service=${serviceId}&err=slot`);
  }

  const sb = supabaseService();
  const tech = await getTechByHandle(sb, handle);
  const service = serviceId ? await getService(sb, serviceId) : null;
  if (!tech || !service || !slotIso || !name || !email) {
    redirect(`/${handle}?service=${serviceId}&slot=${encodeURIComponent(slotIso)}&err=missing`);
  }

  // Gating: the studio must have an active subscription to take online bookings.
  if (!isLive(tech!)) {
    redirect(`/${tech!.handle}?service=${serviceId}&err=not_live`);
  }

  const base = `/${tech!.handle}?service=${serviceId}&slot=${encodeURIComponent(slotIso)}`;
  if (!policyAccepted) redirect(`${base}&err=form`);

  // Re-check the slot is still free.
  const [workingHours, timeOff, bookings] = await Promise.all([
    listWorkingHours(sb, tech!.id),
    listTimeOff(sb, tech!.id),
    listBlockingBookingsInRange(
      sb,
      tech!.id,
      new Date().toISOString(),
      new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
    ),
  ]);
  const dateStr = dateStrInTz(new Date(slotIso));
  const stillFree = daySlots(service!, dateStr, { workingHours, timeOff, bookings }).includes(slotIso);
  if (!stillFree) {
    redirect(`/${tech!.handle}?service=${serviceId}&err=slot`);
  }

  // Evaluate patch-test / infill / blacklist rules against the client's history.
  const existing = await getClientByEmail(sb, tech!.id, email);
  const [category, services] = await Promise.all([
    getCategory(sb, service!.categoryId),
    listServices(sb, tech!.id),
  ]);
  const categoryByServiceId: Record<string, string> = {};
  for (const s of services) categoryByServiceId[s.id] = s.categoryId;

  const [patchTests, priorBookings] = existing
    ? await Promise.all([
        patchTestsForClient(sb, tech!.id, existing.id),
        bookingsForClient(sb, tech!.id, existing.id),
      ])
    : [[], []];

  const eligibility = evaluateEligibility(service!, existing, slotIso, {
    category,
    patchTests,
    priorBookings,
    categoryByServiceId,
  });

  if (eligibility.blacklisted) redirect(`${base}&err=blocked`);
  if (!eligibility.patch.ok) {
    const patchTestService = findPatchTestService(services, service!.categoryId);
    if (patchTestService && service!.requiresPatchTest) {
      redirect(`/${tech!.handle}?service=${serviceId}&pair=1`);
    }
    redirect(`${base}&err=patch`);
  }
  if (!eligibility.infill.ok) redirect(`${base}&err=infill`);

  const client = await findOrCreateClient(sb, tech!.id, { name, email, phone });

  // Extras chosen by the client (validated against the service's real add-ons).
  const available = await addonsForService(sb, service!.id, { activeOnly: true });
  const addons: BookingAddon[] = available
    .filter((a) => formData.get(`addon_${a.id}`) === "on")
    .map((a) => ({ name: a.name, pricePennies: a.pricePennies }));

  // Loyalty reward: VIPs and returning clients past the visit threshold.
  const completedVisits = priorBookings.filter((b) => b.status === "completed").length;
  const gross = service!.pricePennies + addons.reduce((s, a) => s + a.pricePennies, 0);
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

  if (manualApproval) {
    const pending = await createPendingApprovalBooking({
      sb,
      tech: tech!,
      service: service!,
      client,
      startIso: slotIso,
      addons,
      discountPennies,
      riskTier,
    });
    await saveAnswers(pending.id);
    const { notifyTechOfBookingRequest } = await import("@/lib/notify");
    await notifyTechOfBookingRequest(sb, pending, { completedVisits });
    redirect(`/${tech!.handle}/requested/${pending.balanceToken}`);
  }

  const deposit = bookingAmounts(service!, tech!, riskTier, addons, discountPennies).deposit;

  // If a deposit applies and the tech can take card payments, send the client to
  // Stripe Checkout on the tech's connected account. Otherwise confirm now
  // (deposit settled in person).
  if (deposit > 0 && isPaymentsReady(tech!)) {
    const pending = await createPendingOnlineBooking({
      sb,
      tech: tech!,
      service: service!,
      client,
      startIso: slotIso,
      addons,
      discountPennies,
      riskTier,
      autoApproved,
    });
    await saveAnswers(pending.id);
    const url = await createDepositCheckout(tech!, service!, pending, APP_URL);
    redirect(url);
  }

  const booking = await createConfirmedBooking({
    sb,
    tech: tech!,
    service: service!,
    client,
    startIso: slotIso,
    addons,
    discountPennies,
    riskTier,
    autoApproved,
  });
  await saveAnswers(booking.id);
  redirect(`/${tech!.handle}/booked/${booking.balanceToken}`);
}
