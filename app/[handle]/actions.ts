"use server";

import { redirect } from "next/navigation";
import {
  getClientByEmail,
  getService,
  getTechByHandle,
  findOrCreateClient,
} from "@/lib/db/repo";
import { daySlots, dateStrInTz, evaluateEligibility } from "@/lib/rules";
import { createConfirmedBooking } from "@/lib/bookings";
import { hydrate, flush } from "@/lib/db/store";

export async function createPublicBookingAction(formData: FormData) {
  await hydrate();
  const handle = String(formData.get("handle") ?? "");
  const serviceId = String(formData.get("serviceId") ?? "");
  const slotIso = String(formData.get("slot") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();

  const tech = getTechByHandle(handle);
  const service = getService(serviceId);
  if (!tech || !service || !slotIso || !name || !email) {
    redirect(`/${handle}?service=${serviceId}&slot=${encodeURIComponent(slotIso)}&err=missing`);
  }

  const base = `/${tech!.handle}?service=${serviceId}&slot=${encodeURIComponent(slotIso)}`;

  // Re-check the slot is still free (guards against double-booking races).
  const dateStr = dateStrInTz(new Date(slotIso));
  const stillFree = daySlots(tech!.id, service!, dateStr).includes(slotIso);
  if (!stillFree) {
    redirect(`/${tech!.handle}?service=${serviceId}&err=slot`);
  }

  // Identify the client by email to evaluate patch-test / infill / blacklist rules.
  const existing = getClientByEmail(tech!.id, email) ?? null;
  const eligibility = evaluateEligibility(service!, existing, slotIso);

  if (eligibility.blacklisted) {
    redirect(`${base}&err=blocked`);
  }
  if (!eligibility.patch.ok) {
    redirect(`${base}&err=patch`);
  }
  if (!eligibility.infill.ok) {
    redirect(`${base}&err=infill`);
  }

  const client = findOrCreateClient(tech!.id, { name, email, phone });
  const booking = await createConfirmedBooking({
    tech: tech!,
    service: service!,
    client,
    startIso: slotIso,
    takeDeposit: true,
  });

  await flush();
  redirect(`/${tech!.handle}/booked/${booking.balanceToken}`);
}
