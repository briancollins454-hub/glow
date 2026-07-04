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
  listBookings,
  listQuestions,
  listServices,
  listTimeOff,
  listWorkingHours,
  patchTestsForClient,
  createFormResponse,
  addonsForService,
} from "@/lib/db/queries";
import type { BookingAddon, FormAnswer } from "@/lib/db/types";
import { daySlots, dateStrInTz, depositFor, evaluateEligibility } from "@/lib/rules";
import { createConfirmedBooking, createPendingOnlineBooking, loyaltyDiscountFor } from "@/lib/bookings";
import { createDepositCheckout } from "@/lib/payments";
import { isLive, isPaymentsReady } from "@/lib/subscriptions";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function createPublicBookingAction(formData: FormData) {
  const handle = String(formData.get("handle") ?? "");
  const serviceId = String(formData.get("serviceId") ?? "");
  const slotIso = String(formData.get("slot") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();

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

  // Re-check the slot is still free.
  const [workingHours, timeOff, bookings] = await Promise.all([
    listWorkingHours(sb, tech!.id),
    listTimeOff(sb, tech!.id),
    listBookings(sb, tech!.id),
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
  if (!eligibility.patch.ok) redirect(`${base}&err=patch`);
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
  const saveAnswers = async (bookingId: string) => {
    if (answers.length) {
      await createFormResponse(sb, { techId: tech!.id, clientId: client.id, bookingId, answers });
    }
  };

  // If a deposit applies and the tech can take card payments, send the client to
  // Stripe Checkout on the tech's connected account. Otherwise confirm now
  // (deposit settled in person).
  if (depositFor(service!) > 0 && isPaymentsReady(tech!)) {
    const pending = await createPendingOnlineBooking({
      sb,
      tech: tech!,
      service: service!,
      client,
      startIso: slotIso,
      addons,
      discountPennies,
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
  });
  await saveAnswers(booking.id);
  redirect(`/${tech!.handle}/booked/${booking.balanceToken}`);
}
