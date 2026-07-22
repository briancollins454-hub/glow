import { fromZonedTime } from "date-fns-tz";
import { TZ } from "@/lib/format";
import { mondayOfWeekContaining } from "@/lib/rota";
import type {
  Booking,
  BookingAddon,
  RotaHour,
  Client,
  PatchTest,
  Service,
  ServiceCategory,
  Tech,
  TimeOff,
  WorkingHour,
  ApprovalMode,
  RiskTier,
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

/** Resolve a tech policy amount that can be % or fixed £. */
export function amountFromPolicy(
  type: "percent" | "fixed" | "none" | null | undefined,
  value: number | null | undefined,
  fallbackPct: number,
  pricePennies: number,
): number {
  const mode = type ?? "percent";
  if (mode === "none") return 0;
  if (mode === "fixed") return Math.min(Math.max(0, value ?? 0), pricePennies);
  const pct = value ?? fallbackPct;
  return Math.min(Math.round((pricePennies * pct) / 100), pricePennies);
}

/** No-show fee in pennies for a booking price, from the tech's policy. */
export function noShowFeeFor(
  tech: Pick<Tech, "noShowFeePct"> & Partial<Pick<Tech, "noShowFeeType" | "noShowFeeValue">>,
  pricePennies: number,
): number {
  return amountFromPolicy(tech.noShowFeeType, tech.noShowFeeValue, tech.noShowFeePct, pricePennies);
}

export function depositForRisk(
  service: Service,
  tech: Pick<Tech, "depositTierMediumPct" | "depositTierHighPct"> &
    Partial<
      Pick<
        Tech,
        | "depositTierMediumType"
        | "depositTierHighType"
        | "depositTierMediumValue"
        | "depositTierHighValue"
      >
    >,
  riskTier: RiskTier,
  pricePennies: number,
): number {
  const base = Math.min(depositFor(service), pricePennies);
  if (riskTier === "low") return base;
  if (riskTier === "medium") {
    const tiered = amountFromPolicy(
      tech.depositTierMediumType,
      tech.depositTierMediumValue,
      tech.depositTierMediumPct ?? 50,
      pricePennies,
    );
    return Math.min(Math.max(base, tiered), pricePennies);
  }
  const tiered = amountFromPolicy(
    tech.depositTierHighType,
    tech.depositTierHighValue,
    tech.depositTierHighPct ?? 100,
    pricePennies,
  );
  return Math.min(Math.max(base, tiered), pricePennies);
}

export function bookingAmounts(
  service: Service,
  tech: Pick<Tech, "depositTierMediumPct" | "depositTierHighPct"> &
    Partial<
      Pick<
        Tech,
        | "depositTierMediumType"
        | "depositTierHighType"
        | "depositTierMediumValue"
        | "depositTierHighValue"
      >
    >,
  riskTier: RiskTier,
  addons: BookingAddon[] = [],
  discountPennies = 0,
): { price: number; deposit: number; balance: number } {
  const extras = addons.reduce((s, a) => s + a.pricePennies, 0);
  const price = Math.max(0, service.pricePennies + extras - discountPennies);
  const deposit = depositForRisk(service, tech, riskTier, price);
  return { price, deposit, balance: Math.max(0, price - deposit) };
}

export function effectiveApprovalMode(
  tech: Pick<Tech, "approvalMode" | "requiresBookingApproval">,
): ApprovalMode {
  if (tech.approvalMode && tech.approvalMode !== "off") return tech.approvalMode;
  return tech.requiresBookingApproval ? "manual" : "off";
}

export interface ClientRiskContext {
  completedVisits: number;
}

/** Score a client for deposit tier and approval rules. */
export function scoreClientRisk(
  client: Client | null,
  ctx: ClientRiskContext,
  tech: Pick<Tech, "autoApproveMinVisits">,
): RiskTier {
  if (client?.warningNote?.trim()) return "high";
  if ((client?.noShowCount ?? 0) >= 2) return "high";
  if ((client?.noShowCount ?? 0) === 1) return "medium";
  const trusted =
    !!client?.isVip ||
    ctx.completedVisits >= Math.max(1, tech.autoApproveMinVisits ?? 2);
  if (trusted) return "low";
  if (ctx.completedVisits === 0) return "medium";
  return "medium";
}

/** Whether a public booking needs tech approval before deposit or confirmation. */
export function needsManualApproval(
  tech: Pick<Tech, "approvalMode" | "requiresBookingApproval">,
  riskTier: RiskTier,
): boolean {
  const mode = effectiveApprovalMode(tech);
  if (mode === "off") return false;
  if (mode === "manual") return true;
  return riskTier !== "low";
}

export function riskTierLabel(tier: RiskTier): string {
  if (tier === "low") return "Trusted";
  if (tier === "medium") return "Standard";
  return "Higher risk";
}

export function riskTierTone(tier: RiskTier): "green" | "amber" | "red" {
  if (tier === "low") return "green";
  if (tier === "medium") return "amber";
  return "red";
}

// ---------------- Availability ----------------
export type FlexibleHoursWindow = {
  startMinutes: number;
  endMinutes: number;
  lastStartMinutes: number | null;
};

export interface AvailabilityCtx {
  workingHours: WorkingHour[];
  timeOff: TimeOff[];
  bookings: Booking[];
  /**
   * Salon-level flexible daily window. Used only when this ctx has no recurring
   * workingHours rows (and no rota for the week). Per-staff weekly hours always
   * win so closed days stay closed.
   */
  flexibleHours?: FlexibleHoursWindow | null;
  /**
   * Week-by-week rota rows for the staff member in this ctx.
   * If any row exists for the week containing the date, that week uses the rota
   * (closed days = no enabled row) instead of flexible / recurring hours.
   */
  rotaHours?: RotaHour[];
  /**
   * Inclusive YYYY-MM-DD range that was actually queried for rotaHours.
   * Used only for a non-production warn when a date falls outside the fetch.
   */
  rotaFetchedRange?: { fromWeek: string; toWeek: string };
  /**
   * When set and non-empty, only these weekdays (0 = Sunday … 6 = Saturday)
   * may offer slots (per-service available days / basket intersection).
   */
  allowedWeekdays?: number[] | null;
  /** serviceId → buffer minutes after the appointment (cleanup). */
  bufferByServiceId?: Record<string, number>;
}

/** Appointment length that blocks the diary (service + cleanup buffer). */
export function blockedDurationMin(
  service: Pick<Service, "durationMin" | "bufferMinutes">,
): number {
  return service.durationMin + Math.max(0, service.bufferMinutes ?? 0);
}

export function bufferMapFromServices(
  services: Pick<Service, "id" | "bufferMinutes">[],
): Record<string, number> {
  const map: Record<string, number> = {};
  for (const s of services) {
    const buf = Math.max(0, s.bufferMinutes ?? 0);
    if (buf > 0) map[s.id] = buf;
  }
  return map;
}

/** null/empty weekday list means every day. */
export function normalizeAvailableWeekdays(
  days: number[] | null | undefined,
): number[] | null {
  if (!days?.length) return null;
  const cleaned = [...new Set(days.filter((d) => d >= 0 && d <= 6))].sort(
    (a, b) => a - b,
  );
  if (!cleaned.length || cleaned.length === 7) return null;
  return cleaned;
}

/** Intersection of per-service weekday rules (unrestricted services are ignored). */
export function intersectWeekdays(
  services: Pick<Service, "availableWeekdays">[],
): number[] | null {
  return intersectWeekdayLists(services.map((s) => s.availableWeekdays));
}

/** Intersection of raw weekday lists (null/empty = unrestricted). */
export function intersectWeekdayLists(
  lists: Array<number[] | null | undefined>,
): number[] | null {
  let allowed: number[] | null = null;
  for (const raw of lists) {
    const days = normalizeAvailableWeekdays(raw);
    if (!days) continue;
    if (allowed == null) {
      allowed = days;
      continue;
    }
    const set = new Set(days);
    allowed = allowed.filter((d) => set.has(d));
  }
  if (!allowed) return null;
  return allowed;
}

/**
 * Effective weekdays for one staff + one service.
 * Prefers the staff-level rule when a row exists; intersects with the
 * service-level rule when both restrict days.
 *
 * @param staffDays - staff rule when a staff_service_days row exists; omit/undefined if none
 * @param hasStaffRule - true when a staff_service_days row exists for this pair
 */
export function weekdaysForStaffService(
  service: Pick<Service, "availableWeekdays">,
  staffDays: number[] | null | undefined,
  hasStaffRule: boolean,
): number[] | null {
  const serviceDays = normalizeAvailableWeekdays(service.availableWeekdays);
  if (!hasStaffRule) return serviceDays;
  const staffNorm = normalizeAvailableWeekdays(staffDays);
  return intersectWeekdayLists([serviceDays, staffNorm]);
}

/**
 * Effective weekdays for a basket of services for one staff member.
 * staffDayByService maps serviceId -> availableWeekdays when a row exists.
 * Services with no staff row fall back to service-level only.
 */
export function weekdaysForStaffBasket(
  services: Pick<Service, "id" | "availableWeekdays">[],
  staffDayByService: Record<string, number[] | null> | null | undefined,
): number[] | null {
  return intersectWeekdayLists(
    services.map((s) => {
      const hasRule = !!staffDayByService && Object.prototype.hasOwnProperty.call(staffDayByService, s.id);
      return weekdaysForStaffService(
        s,
        hasRule ? staffDayByService![s.id] : undefined,
        hasRule,
      );
    }),
  );
}

/** Resolve the open window for one calendar day (or null if closed). */
const warnedRotaRangeKeys = new Set<string>();

export function dayWindowForDate(
  dateStr: string,
  ctx: AvailabilityCtx,
): { startMinutes: number; endMinutes: number; lastStartMinutes: number | null } | null {
  const weekday = weekdayOf(dateStr);
  const weekStart = mondayOfWeekContaining(dateStr);

  if (ctx.rotaFetchedRange && process.env.NODE_ENV !== "production") {
    const { fromWeek, toWeek } = ctx.rotaFetchedRange;
    if (weekStart < fromWeek || weekStart > toWeek) {
      const key = `${fromWeek}|${toWeek}|${weekStart}`;
      if (!warnedRotaRangeKeys.has(key)) {
        warnedRotaRangeKeys.add(key);
        console.warn(
          `[rota] date ${dateStr} (week ${weekStart}) is outside fetched range ${fromWeek}..${toWeek}; falling back to recurring hours`,
        );
      }
    }
  }

  if (ctx.rotaHours?.length) {
    const weekRows = ctx.rotaHours.filter((r) => r.weekStart.slice(0, 10) === weekStart);
    if (weekRows.length > 0) {
      const row = weekRows.find((w) => w.weekday === weekday && w.enabled);
      if (!row) return null;
      return {
        startMinutes: row.startMinutes,
        endMinutes: row.endMinutes,
        lastStartMinutes: row.lastStartMinutes,
      };
    }
  }

  // Recurring weekly hours beat the salon flexible window. If this person has
  // any hours configured, a missing/disabled weekday stays closed — flexible
  // must not reopen days they are not rostered to work.
  if (ctx.workingHours.length > 0) {
    const wh = ctx.workingHours.find((w) => w.weekday === weekday && w.enabled);
    if (!wh) return null;
    return {
      startMinutes: wh.startMinutes,
      endMinutes: wh.endMinutes,
      lastStartMinutes: wh.lastStartMinutes,
    };
  }

  if (ctx.flexibleHours) {
    return {
      startMinutes: ctx.flexibleHours.startMinutes,
      endMinutes: ctx.flexibleHours.endMinutes,
      lastStartMinutes: ctx.flexibleHours.lastStartMinutes,
    };
  }

  return null;
}

const DEFAULT_FLEXIBLE_START = 9 * 60;
const DEFAULT_FLEXIBLE_END = 20 * 60;

/** Daily window for techs who opted into flexible / rotating hours. */
export function flexibleHoursFromTech(
  tech:
    | Pick<
        Tech,
        | "flexibleHoursEnabled"
        | "flexibleStartMinutes"
        | "flexibleEndMinutes"
        | "flexibleLastStartMinutes"
      >
    | null
    | undefined,
): FlexibleHoursWindow | null {
  if (!tech?.flexibleHoursEnabled) return null;
  const start = tech.flexibleStartMinutes ?? DEFAULT_FLEXIBLE_START;
  const end = tech.flexibleEndMinutes ?? DEFAULT_FLEXIBLE_END;
  if (!(end > start)) {
    return {
      startMinutes: DEFAULT_FLEXIBLE_START,
      endMinutes: DEFAULT_FLEXIBLE_END,
      lastStartMinutes: tech.flexibleLastStartMinutes ?? null,
    };
  }
  return {
    startMinutes: start,
    endMinutes: end,
    lastStartMinutes: tech.flexibleLastStartMinutes ?? null,
  };
}

/** Attach the tech's flexible-hours window (if any) onto an availability ctx. */
export function withTechAvailability(
  ctx: Omit<AvailabilityCtx, "flexibleHours">,
  tech: Parameters<typeof flexibleHoursFromTech>[0],
): AvailabilityCtx {
  return { ...ctx, flexibleHours: flexibleHoursFromTech(tech) };
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

/** Slots on one day for an appointment of the given total duration. */
export function daySlotsForDuration(
  durationMin: number,
  dateStr: string,
  ctx: AvailabilityCtx,
  nowMs = Date.now(),
): string[] {
  const allowed = ctx.allowedWeekdays;
  // null/undefined = any day; empty array = no days (rules conflict).
  if (allowed != null && (!allowed.length || !allowed.includes(weekdayOf(dateStr)))) {
    return [];
  }

  const wh = dayWindowForDate(dateStr, ctx);
  if (!wh) return [];

  const offs = ctx.timeOff.map((o) => ({
    start: new Date(o.startIso).getTime(),
    end: new Date(o.endIso).getTime(),
  }));
  const busy = ctx.bookings
    .filter((b) => BLOCKING_STATUSES.includes(b.status))
    .map((b) => {
      const bufferMin = ctx.bufferByServiceId?.[b.serviceId] ?? 0;
      return {
        start: new Date(b.startIso).getTime(),
        end: new Date(b.endIso).getTime() + Math.max(0, bufferMin) * 60 * 1000,
      };
    });

  const slots: string[] = [];
  // A set "last appointment" time wins over closing time (the tech accepts the
  // appointment may run past closing). Otherwise appointments must end by close.
  const lastStart =
    wh.lastStartMinutes != null
      ? wh.lastStartMinutes
      : wh.endMinutes - durationMin;
  for (let m = wh.startMinutes; m <= lastStart; m += SLOT_STEP_MIN) {
    const start = localInstant(dateStr, m);
    const startMs = start.getTime();
    const endMs = startMs + durationMin * 60 * 1000;
    if (startMs <= nowMs) continue;
    if (offs.some((o) => overlaps(startMs, endMs, o.start, o.end))) continue;
    if (busy.some((b) => overlaps(startMs, endMs, b.start, b.end))) continue;
    slots.push(start.toISOString());
  }
  return slots;
}

export function daySlots(
  service: Service,
  dateStr: string,
  ctx: AvailabilityCtx,
  nowMs = Date.now(),
): string[] {
  return daySlotsForDuration(
    blockedDurationMin(service),
    dateStr,
    { ...ctx, allowedWeekdays: intersectWeekdays([service]) },
    nowMs,
  );
}

/** Days with slots long enough for an appointment of the given total duration. */
export function availableDaysForDuration(
  durationMin: number,
  ctx: AvailabilityCtx,
  count = 14,
  nowMs = Date.now(),
): { dateStr: string; slots: string[] }[] {
  const days: { dateStr: string; slots: string[] }[] = [];
  let prevDateStr: string | null = null;
  for (let i = 0; i < 60 && days.length < count; i++) {
    const d = new Date(nowMs + i * 24 * 60 * 60 * 1000);
    const dateStr = dateStrInTz(d);
    // Across UK autumn DST fallback a 24h step can land on the same civil date twice.
    if (dateStr === prevDateStr) continue;
    prevDateStr = dateStr;
    const slots = daySlotsForDuration(durationMin, dateStr, ctx, nowMs);
    if (slots.length) days.push({ dateStr, slots });
  }
  return days;
}

export function availableDays(
  service: Service,
  ctx: AvailabilityCtx,
  count = 14,
  nowMs = Date.now(),
): { dateStr: string; slots: string[] }[] {
  return availableDaysForDuration(
    blockedDurationMin(service),
    { ...ctx, allowedWeekdays: intersectWeekdays([service]) },
    count,
    nowMs,
  );
}

// ---------------- Basket (multiple treatments, one visit) ----------------

/** Total diary block when treatments run back-to-back (includes cleanup buffers). */
export function basketDurationMin(services: Service[]): number {
  return services.reduce((sum, s) => sum + blockedDurationMin(s), 0);
}

/**
 * Combined money for a basket. Each treatment keeps its own deposit rules;
 * add-ons and any loyalty discount apply to the primary (first) service, same
 * as a single booking.
 */
export function basketAmounts(
  services: Service[],
  tech: Parameters<typeof bookingAmounts>[1],
  riskTier: RiskTier,
  addons: BookingAddon[] = [],
  discountPennies = 0,
): { price: number; deposit: number; balance: number } {
  let price = 0;
  let deposit = 0;
  services.forEach((service, i) => {
    const a = bookingAmounts(
      service,
      tech,
      riskTier,
      i === 0 ? addons : [],
      i === 0 ? discountPennies : 0,
    );
    price += a.price;
    deposit += a.deposit;
  });
  return { price, deposit, balance: Math.max(0, price - deposit) };
}

/** Consecutive start times for basket treatments from the chosen slot. */
export function basketStartTimes(services: Service[], slotIso: string): string[] {
  const starts: string[] = [];
  let cursor = new Date(slotIso).getTime();
  for (const s of services) {
    starts.push(new Date(cursor).toISOString());
    cursor += blockedDurationMin(s) * 60 * 1000;
  }
  return starts;
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
    if (p.invalidatedAtIso) return false;
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

// ---------------- Paired patch test booking ----------------
export function findPatchTestService(services: Service[], categoryId: string): Service | null {
  return (
    services.find((s) => s.active && s.isPatchTestService && s.categoryId === categoryId) ?? null
  );
}

export function canOfferPairedPatchTest(treatmentService: Service, services: Service[]): boolean {
  if (!treatmentService.requiresPatchTest || treatmentService.isPatchTestService) return false;
  return !!findPatchTestService(services, treatmentService.categoryId);
}

/** Treatment slots that start far enough after a patch-test appointment ends. */
export function treatmentSlotsAfterPatchTest(
  treatmentService: Service,
  patchTestService: Service,
  patchSlotIso: string,
  category: ServiceCategory | null,
  ctx: AvailabilityCtx,
  count = 14,
  nowMs = Date.now(),
): { dateStr: string; slots: string[] }[] {
  const minLeadMs = (category?.patchTestMinLeadHours ?? 24) * 60 * 60 * 1000;
  const earliestTreatmentMs =
    new Date(patchSlotIso).getTime() + patchTestService.durationMin * 60 * 1000 + minLeadMs;

  return availableDays(treatmentService, ctx, 60, nowMs)
    .map((d) => ({
      ...d,
      slots: d.slots.filter((s) => new Date(s).getTime() >= earliestTreatmentMs),
    }))
    .filter((d) => d.slots.length > 0)
    .slice(0, count);
}

export function validatePairedPatchTestTiming(
  patchTestService: Service,
  patchSlotIso: string,
  treatmentSlotIso: string,
  category: ServiceCategory | null,
): { ok: boolean; reason: string } {
  const minLeadMs = (category?.patchTestMinLeadHours ?? 24) * 60 * 60 * 1000;
  const patchEndMs = new Date(patchSlotIso).getTime() + patchTestService.durationMin * 60 * 1000;
  const treatmentStartMs = new Date(treatmentSlotIso).getTime();
  if (treatmentStartMs < patchEndMs + minLeadMs) {
    const hours = category?.patchTestMinLeadHours ?? 24;
    return {
      ok: false,
      reason: `Your treatment must be at least ${hours} hours after your patch test finishes.`,
    };
  }
  return { ok: true, reason: "" };
}
