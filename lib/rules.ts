import { fromZonedTime } from "date-fns-tz";
import { TZ } from "@/lib/format";
import {
  bookingsForClient,
  getCategory,
  getService,
  listBookings,
  listTimeOff,
  listWorkingHours,
  patchTestsForClient,
} from "@/lib/db/repo";
import type { Booking, Client, Service } from "@/lib/db/types";

const SLOT_STEP_MIN = 15;
const BLOCKING_STATUSES: Booking["status"][] = [
  "pending",
  "confirmed",
  "completed",
];

// ---------------- Deposits ----------------
export function depositFor(service: Service): number {
  if (service.depositType === "none") return 0;
  if (service.depositType === "fixed") return service.depositValue;
  return Math.round((service.pricePennies * service.depositValue) / 100);
}

// ---------------- Availability ----------------
function localInstant(dateStr: string, minutes: number): Date {
  const hh = String(Math.floor(minutes / 60)).padStart(2, "0");
  const mm = String(minutes % 60).padStart(2, "0");
  return fromZonedTime(`${dateStr}T${hh}:${mm}:00`, TZ);
}

function weekdayOf(dateStr: string): number {
  return new Date(`${dateStr}T12:00:00Z`).getUTCDay();
}

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return aStart < bEnd && bStart < aEnd;
}

/** Generate bookable slot start times (ISO) for a service on a given local date. */
export function daySlots(
  techId: string,
  service: Service,
  dateStr: string,
  nowMs = Date.now(),
): string[] {
  const weekday = weekdayOf(dateStr);
  const wh = listWorkingHours(techId).find(
    (w) => w.weekday === weekday && w.enabled,
  );
  if (!wh) return [];

  const offs = listTimeOff(techId).map((o) => ({
    start: new Date(o.startIso).getTime(),
    end: new Date(o.endIso).getTime(),
  }));
  const busy = listBookings(techId)
    .filter((b) => BLOCKING_STATUSES.includes(b.status))
    .map((b) => ({
      start: new Date(b.startIso).getTime(),
      end: new Date(b.endIso).getTime(),
    }));

  const slots: string[] = [];
  const lastStart = wh.endMinutes - service.durationMin;
  for (let m = wh.startMinutes; m <= lastStart; m += SLOT_STEP_MIN) {
    const start = localInstant(dateStr, m);
    const startMs = start.getTime();
    const endMs = startMs + service.durationMin * 60 * 1000;
    if (startMs <= nowMs) continue;
    if (offs.some((o) => overlaps(startMs, endMs, o.start, o.end))) continue;
    if (busy.some((b) => overlaps(startMs, endMs, b.start, b.end))) continue;
    slots.push(start.toISOString());
  }
  return slots;
}

export function dateStrInTz(d: Date): string {
  // YYYY-MM-DD for the London calendar day
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
  return parts;
}

/** Next N calendar days that have at least one bookable slot. */
export function availableDays(
  techId: string,
  service: Service,
  count = 14,
  nowMs = Date.now(),
): { dateStr: string; slots: string[] }[] {
  const days: { dateStr: string; slots: string[] }[] = [];
  for (let i = 0; i < 60 && days.length < count; i++) {
    const d = new Date(nowMs + i * 24 * 60 * 60 * 1000);
    const dateStr = dateStrInTz(d);
    const slots = daySlots(techId, service, dateStr, nowMs);
    if (slots.length) days.push({ dateStr, slots });
  }
  return days;
}

// ---------------- Patch test rule ----------------
export interface RuleResult {
  required: boolean;
  ok: boolean;
  reason: string;
  detail?: string;
}

export function checkPatchTest(
  service: Service,
  client: Client | null,
  appointmentStartIso: string,
): RuleResult {
  if (!service.requiresPatchTest) {
    return { required: false, ok: true, reason: "No patch test required." };
  }
  const category = getCategory(service.categoryId);
  const minLeadH = category?.patchTestMinLeadHours ?? 24;

  if (!client) {
    return {
      required: true,
      ok: false,
      reason: `A patch test is required at least ${minLeadH}h before this service.`,
      detail: "new_client",
    };
  }

  const apptMs = new Date(appointmentStartIso).getTime();
  const tests = patchTestsForClient(client.techId, client.id).filter(
    (p) => p.categoryId === service.categoryId && p.result !== "fail",
  );

  // Valid if performed >= minLead before appointment and not expired at appt time.
  const valid = tests.find((p) => {
    const performed = new Date(p.performedAtIso).getTime();
    const expires = new Date(p.expiresAtIso).getTime();
    const leadOk = apptMs - performed >= minLeadH * 60 * 60 * 1000;
    const notExpired = expires >= apptMs;
    return leadOk && notExpired && p.result === "pass";
  });

  if (valid) {
    return {
      required: true,
      ok: true,
      reason: "Valid patch test on file.",
      detail: valid.performedAtIso,
    };
  }

  const pendingOrFuture = tests.find((p) => {
    const performed = new Date(p.performedAtIso).getTime();
    return apptMs - performed < minLeadH * 60 * 60 * 1000;
  });

  return {
    required: true,
    ok: false,
    reason: pendingOrFuture
      ? `Patch test must be done at least ${minLeadH}h before this appointment.`
      : `A valid patch test is required at least ${minLeadH}h before this service.`,
    detail: "no_valid_test",
  };
}

// ---------------- Infill timing rule ----------------
export function checkInfill(
  service: Service,
  client: Client | null,
  appointmentStartIso: string,
): RuleResult {
  if (!service.isInfill) {
    return { required: false, ok: true, reason: "Not an infill service." };
  }
  const gapDays = service.infillMaxGapDays || 21;

  if (!client) {
    return {
      required: true,
      ok: false,
      reason: `Infills are for returning clients only. Book a full set first.`,
      detail: "new_client",
    };
  }

  const apptMs = new Date(appointmentStartIso).getTime();
  // Qualifying prior appointment: same category, completed/confirmed, in the past.
  const priors = bookingsForClient(client.techId, client.id)
    .filter((b) => b.id) // all
    .filter((b) => {
      const startMs = new Date(b.startIso).getTime();
      return startMs < apptMs && (b.status === "completed" || b.status === "confirmed");
    });

  // Need a prior booking whose service is in the same category (full set or infill).
  const qualifying = priors
    .map((b) => ({ b, startMs: new Date(b.startIso).getTime() }))
    .filter(({ b }) => sameCategoryService(b.serviceId, service))
    .sort((a, z) => z.startMs - a.startMs)[0];

  if (!qualifying) {
    return {
      required: true,
      ok: false,
      reason: "No previous full set on record for this service. Please book a full set.",
      detail: "no_prior",
    };
  }

  const gapMs = apptMs - qualifying.startMs;
  const maxMs = gapDays * 24 * 60 * 60 * 1000;
  if (gapMs > maxMs) {
    const days = Math.round(gapMs / (24 * 60 * 60 * 1000));
    return {
      required: true,
      ok: false,
      reason: `It has been ${days} days since your last appointment (max ${gapDays} for an infill). A new full set is recommended.`,
      detail: "too_long",
    };
  }

  return {
    required: true,
    ok: true,
    reason: "Eligible for infill based on your last appointment.",
    detail: qualifying.b.startIso,
  };
}

function sameCategoryService(serviceId: string, target: Service): boolean {
  // The prior service must share the target's category.
  return (getService(serviceId)?.categoryId ?? null) === target.categoryId;
}

// ---------------- Combined ----------------
export interface BookingEligibility {
  ok: boolean;
  patch: RuleResult;
  infill: RuleResult;
  blacklisted: boolean;
}

export function evaluateEligibility(
  service: Service,
  client: Client | null,
  appointmentStartIso: string,
): BookingEligibility {
  const patch = checkPatchTest(service, client, appointmentStartIso);
  const infill = checkInfill(service, client, appointmentStartIso);
  const blacklisted = !!client?.isBlacklisted;
  return {
    ok: patch.ok && infill.ok && !blacklisted,
    patch,
    infill,
    blacklisted,
  };
}
