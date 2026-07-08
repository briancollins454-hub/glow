import { fromZonedTime } from "date-fns-tz";
import { TZ } from "@/lib/format";
import type {
  Booking,
  Client,
  PatchTest,
  Service,
  ServiceCategory,
  TimeOff,
  WorkingHour,
} from "@/lib/db/types";

const SLOT_STEP_MIN = 15;
export const BLOCKING_STATUSES: Booking["status"][] = [
  "pending_approval",
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
export interface AvailabilityCtx {
  workingHours: WorkingHour[];
  timeOff: TimeOff[];
  bookings: Booking[];
}

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

export function dateStrInTz(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function daySlots(
  service: Service,
  dateStr: string,
  ctx: AvailabilityCtx,
  nowMs = Date.now(),
): string[] {
  const weekday = weekdayOf(dateStr);
  const wh = ctx.workingHours.find((w) => w.weekday === weekday && w.enabled);
  if (!wh) return [];

  const offs = ctx.timeOff.map((o) => ({
    start: new Date(o.startIso).getTime(),
    end: new Date(o.endIso).getTime(),
  }));
  const busy = ctx.bookings
    .filter((b) => BLOCKING_STATUSES.includes(b.status))
    .map((b) => ({
      start: new Date(b.startIso).getTime(),
      end: new Date(b.endIso).getTime(),
    }));

  const slots: string[] = [];
  // A set "last appointment" time wins over closing time (the tech accepts the
  // appointment may run past closing). Otherwise appointments must end by close.
  const lastStart =
    wh.lastStartMinutes != null
      ? wh.lastStartMinutes
      : wh.endMinutes - service.durationMin;
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

export function availableDays(
  service: Service,
  ctx: AvailabilityCtx,
  count = 14,
  nowMs = Date.now(),
): { dateStr: string; slots: string[] }[] {
  const days: { dateStr: string; slots: string[] }[] = [];
  for (let i = 0; i < 60 && days.length < count; i++) {
    const d = new Date(nowMs + i * 24 * 60 * 60 * 1000);
    const dateStr = dateStrInTz(d);
    const slots = daySlots(service, dateStr, ctx, nowMs);
    if (slots.length) days.push({ dateStr, slots });
  }
  return days;
}

// ---------------- Rule results ----------------
export interface RuleResult {
  required: boolean;
  ok: boolean;
  reason: string;
  detail?: string;
}

// ---------------- Patch test rule ----------------
export function checkPatchTest(
  service: Service,
  client: Client | null,
  appointmentStartIso: string,
  ctx: { category: ServiceCategory | null; patchTests: PatchTest[] },
): RuleResult {
  if (!service.requiresPatchTest) {
    return { required: false, ok: true, reason: "No patch test required." };
  }

  if (!client) {
    return {
      required: true,
      ok: false,
      reason: "A patch test is required before this service.",
      detail: "new_client",
    };
  }

  const apptMs = new Date(appointmentStartIso).getTime();
  const tests = ctx.patchTests.filter(
    (p) => p.categoryId === service.categoryId && p.result !== "fail",
  );

  // A test is valid if it passed, happened far enough before the appointment,
  // and hasn't expired by the appointment date.
  const valid = tests.find((p) => {
    const expires = new Date(p.expiresAtIso).getTime();
    const performed = new Date(p.performedAtIso).getTime();
    const minLeadMs = (ctx.category?.patchTestMinLeadHours ?? 0) * 60 * 60 * 1000;
    return expires >= apptMs && p.result === "pass" && performed + minLeadMs <= apptMs;
  });

  if (valid) {
    return { required: true, ok: true, reason: "Valid patch test on file.", detail: valid.performedAtIso };
  }

  return {
    required: true,
    ok: false,
    reason: "A valid patch test is required before this service.",
    detail: "no_valid_test",
  };
}

// ---------------- Infill timing rule ----------------
export function checkInfill(
  service: Service,
  client: Client | null,
  appointmentStartIso: string,
  ctx: { priorBookings: Booking[]; categoryByServiceId: Record<string, string> },
): RuleResult {
  if (!service.isInfill) {
    return { required: false, ok: true, reason: "Not an infill service." };
  }
  const gapDays = service.infillMaxGapDays || 21;

  if (!client) {
    return {
      required: true,
      ok: false,
      reason: "Infills are for returning clients only. Book a full set first.",
      detail: "new_client",
    };
  }

  const apptMs = new Date(appointmentStartIso).getTime();
  const qualifying = ctx.priorBookings
    .filter((b) => {
      const startMs = new Date(b.startIso).getTime();
      const sameCat = ctx.categoryByServiceId[b.serviceId] === service.categoryId;
      return startMs < apptMs && sameCat && (b.status === "completed" || b.status === "confirmed");
    })
    .map((b) => ({ b, startMs: new Date(b.startIso).getTime() }))
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
  if (gapMs > gapDays * 24 * 60 * 60 * 1000) {
    const days = Math.round(gapMs / (24 * 60 * 60 * 1000));
    return {
      required: true,
      ok: false,
      reason: `It has been ${days} days since your last appointment (max ${gapDays} for an infill). A new full set is recommended.`,
      detail: "too_long",
    };
  }

  return { required: true, ok: true, reason: "Eligible for infill.", detail: qualifying.b.startIso };
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
  ctx: {
    category: ServiceCategory | null;
    patchTests: PatchTest[];
    priorBookings: Booking[];
    categoryByServiceId: Record<string, string>;
  },
): BookingEligibility {
  const patch = checkPatchTest(service, client, appointmentStartIso, ctx);
  const infill = checkInfill(service, client, appointmentStartIso, ctx);
  const blacklisted = !!client?.isBlacklisted;
  return { ok: patch.ok && infill.ok && !blacklisted, patch, infill, blacklisted };
}
