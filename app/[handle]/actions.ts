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
  listServices,
  listTimeOff,
  listWorkingHours,
  patchTestsForClient,
} from "@/lib/db/queries";
import { daySlots, dateStrInTz, evaluateEligibility } from "@/lib/rules";
import { createConfirmedBooking } from "@/lib/bookings";

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
  const booking = await createConfirmedBooking({
    sb,
    tech: tech!,
    service: service!,
    client,
    startIso: slotIso,
    takeDeposit: true,
  });

  redirect(`/${tech!.handle}/booked/${booking.balanceToken}`);
}
