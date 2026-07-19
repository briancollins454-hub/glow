import type { SupabaseClient } from "@supabase/supabase-js";
import { randomId } from "@/lib/ids";
import { throwDbError } from "@/lib/db/errors";
import type {
  AccountClosureRequest,
  AuditEvent,
  Booking,
  Client,
  ClientPhoto,
  ConsultationQuestion,
  FormResponse,
  Message,
  MessageSender,
  Payment,
  PatchTest,
  Product,
  ProductBatch,
  ProductChangeEvent,
  ProductChangeRetest,
  ProductUsage,
  ClientReaction,
  InfillDeadlineNudge,
  LateCascadeEvent,
  LateCascadeNotification,
  PreCareConfirmation,
  DmQuoteLink,
  ReactionCheckin,
  Reminder,
  Review,
  RotaHour,
  Service,
  ServiceAddon,
  ServiceCategory,
  StaffMember,
  Tech,
  TimeOff,
  WaitlistEntry,
  WorkingHour,
} from "./types";

// Async data-access layer over the relational Supabase tables. Every function
// takes a SupabaseClient so the caller controls the security context:
//  - dashboard  -> authenticated server client (RLS scopes to the tech)
//  - public/cron -> service-role client (explicit techId scoping)

type SB = SupabaseClient;

/** PostgREST/Supabase caps a single select at 1000 rows by default. */
const PAGE_SIZE = 1000;

function must<T>(data: T | null, error: { message: string } | null): T {
  if (error) throw new Error(error.message);
  return data as T;
}

/** Load every row for a tech, paging past the 1000-row PostgREST default. */
async function listAllForTech<T>(
  sb: SB,
  table: string,
  techId: string,
  orderCol: string,
): Promise<T[]> {
  const out: T[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await sb
      .from(table)
      .select("*")
      .eq("techId", techId)
      .order(orderCol)
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const chunk = (data as T[]) ?? [];
    out.push(...chunk);
    if (chunk.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return out;
}

// ---------------- Techs ----------------
export async function getTechById(sb: SB, id: string): Promise<Tech | null> {
  const { data, error } = await sb.from("techs").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data as Tech | null;
}
export async function getTechByHandle(sb: SB, handle: string): Promise<Tech | null> {
  const { data, error } = await sb.from("techs").select("*").ilike("handle", handle).maybeSingle();
  if (error) throw new Error(error.message);
  return data as Tech | null;
}
export async function getTechByAuthUserId(sb: SB, authUserId: string): Promise<Tech | null> {
  const { data, error } = await sb.from("techs").select("*").eq("authUserId", authUserId).maybeSingle();
  if (error) throw new Error(error.message);
  return data as Tech | null;
}
export async function getTechByEmail(sb: SB, email: string): Promise<Tech | null> {
  const { data, error } = await sb.from("techs").select("*").ilike("email", email).maybeSingle();
  if (error) throw new Error(error.message);
  return data as Tech | null;
}
export async function getTechByStripeCustomerId(sb: SB, customerId: string): Promise<Tech | null> {
  const { data, error } = await sb.from("techs").select("*").eq("stripeCustomerId", customerId).maybeSingle();
  if (error) throw new Error(error.message);
  return data as Tech | null;
}
export async function getTechByConnectAccountId(sb: SB, accountId: string): Promise<Tech | null> {
  const { data, error } = await sb.from("techs").select("*").eq("stripeConnectAccountId", accountId).maybeSingle();
  if (error) throw new Error(error.message);
  return data as Tech | null;
}
export async function getTechByCalendarToken(sb: SB, token: string): Promise<Tech | null> {
  if (!token) return null;
  const { data, error } = await sb.from("techs").select("*").eq("calendarToken", token).maybeSingle();
  if (error) throw new Error(error.message);
  return data as Tech | null;
}
export async function getTechByResetTokenHash(sb: SB, tokenHash: string): Promise<Tech | null> {
  const { data, error } = await sb.from("techs").select("*").eq("resetTokenHash", tokenHash).maybeSingle();
  if (error) throw new Error(error.message);
  return data as Tech | null;
}
type ManagedTechField =
  | "stripeCustomerId"
  | "stripeSubscriptionId"
  | "subscriptionStatus"
  | "plan"
  | "currentPeriodEnd"
  | "stripeConnectAccountId"
  | "connectChargesEnabled"
  | "connectPayoutsEnabled"
  | "connectDetailsSubmitted"
  | "resetTokenHash"
  | "resetTokenExpiresAt"
  | "referredBy"
  | "loyaltyVisitThreshold"
  | "loyaltyDiscountPct"
  | "loyaltyDiscountType"
  | "loyaltyDiscountValue"
  | "calendarToken"
  | "closureRequestedAt"
  | "closureReason"
  | "googleRefreshToken"
  | "googleCalendarId"
  | "googleCalendarEmail"
  | "googleConnectedAt"
  | "rebookNudgesEnabled"
  | "infillNudgesEnabled"
  | "preCareConfirmationsEnabled"
  | "smsRemindersEnabled"
  | "requiresBookingApproval"
  | "approvalMode"
  | "depositTierMediumPct"
  | "depositTierHighPct"
  | "depositTierMediumType"
  | "depositTierHighType"
  | "depositTierMediumValue"
  | "depositTierHighValue"
  | "defaultDepositType"
  | "defaultDepositValue"
  | "noShowFeeType"
  | "noShowFeeValue"
  | "autoApproveMinVisits"
  | "signupOffer";

type NewTech = Omit<Tech, "createdAt" | ManagedTechField> &
  Partial<Pick<Tech, ManagedTechField>>;

export async function createTech(sb: SB, tech: NewTech): Promise<Tech> {
  const { data, error } = await sb.from("techs").insert({ ...tech }).select("*").single();
  return must(data as Tech, error);
}
const SCHEMA_COLUMN_RE = /Could not find the '([^']+)' column/;

/** Drop one field when Supabase reports a column missing from schema cache (migration lag). */
export function patchWithoutMissingColumn(
  patch: Record<string, unknown>,
  column: string,
): Record<string, unknown> | null {
  if (!(column in patch)) return null;
  const { [column]: _removed, ...rest } = patch;
  return rest;
}

export async function updateTech(sb: SB, id: string, patch: Partial<Tech>): Promise<void> {
  let current: Record<string, unknown> = { ...patch };

  for (let attempt = 0; attempt < 12; attempt++) {
    if (Object.keys(current).length === 0) return;

    const { error } = await sb.from("techs").update(current).eq("id", id);
    if (!error) return;

    const missing = error.message.match(SCHEMA_COLUMN_RE);
    if (missing) {
      const next = patchWithoutMissingColumn(current, missing[1]);
      if (!next) throw new Error(error.message);
      current = next;
      continue;
    }

    throw new Error(error.message);
  }

  throw new Error("updateTech: too many schema retries");
}

// ---------------- Categories ----------------
export async function listCategories(sb: SB, techId: string): Promise<ServiceCategory[]> {
  const { data, error } = await sb.from("categories").select("*").eq("techId", techId).order("name");
  return must(data as ServiceCategory[], error) ?? [];
}
export async function getCategory(sb: SB, id: string): Promise<ServiceCategory | null> {
  const { data, error } = await sb.from("categories").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data as ServiceCategory | null;
}
export async function createCategory(sb: SB, c: Omit<ServiceCategory, "id" | "createdAt">): Promise<ServiceCategory> {
  const { data, error } = await sb.from("categories").insert({ ...c, id: randomId("cat") }).select("*").single();
  return must(data as ServiceCategory, error);
}

// ---------------- Services ----------------
export async function listServices(sb: SB, techId: string, opts: { activeOnly?: boolean } = {}): Promise<Service[]> {
  let q = sb.from("services").select("*").eq("techId", techId);
  if (opts.activeOnly) q = q.eq("active", true);
  const { data, error } = await q.order("sortOrder").order("name");
  return must(data as Service[], error) ?? [];
}
export async function getService(sb: SB, id: string): Promise<Service | null> {
  const { data, error } = await sb.from("services").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data as Service | null;
}
export async function createService(
  sb: SB,
  s: Omit<Service, "id" | "createdAt" | "photoPath" | "aftercareText" | "precareText"> &
    Partial<Pick<Service, "photoPath" | "aftercareText" | "precareText">>,
): Promise<Service> {
  const { data, error } = await sb.from("services").insert({ ...s, id: randomId("svc") }).select("*").single();
  return must(data as Service, error);
}
export async function updateService(sb: SB, id: string, patch: Partial<Service>): Promise<void> {
  const { error } = await sb.from("services").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}
export async function deleteService(sb: SB, id: string): Promise<void> {
  await deleteServices(sb, [id]);
}

/** Delete many services (and their bookings / waitlist / staff links). */
export async function deleteServices(sb: SB, ids: string[]): Promise<number> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return 0;

  for (const chunk of chunkIds(unique, 100)) {
    const { error: infillErr } = await sb
      .from("services")
      .update({ fullSetServiceId: null })
      .in("fullSetServiceId", chunk);
    if (infillErr) throw new Error(infillErr.message);

    const { error: waitlistErr } = await sb.from("waitlist_entries").delete().in("serviceId", chunk);
    if (waitlistErr) throw new Error(waitlistErr.message);

    const { error: staffLinkErr } = await sb.from("staff_services").delete().in("serviceId", chunk);
    if (staffLinkErr && !/staff_services|schema cache/i.test(staffLinkErr.message)) {
      throw new Error(staffLinkErr.message);
    }

    // Bookings restrict service deletes — remove them first (payments/reminders cascade).
    const { error: bookingErr } = await sb.from("bookings").delete().in("serviceId", chunk);
    if (bookingErr) throw new Error(bookingErr.message);

    const { error } = await sb.from("services").delete().in("id", chunk);
    if (error) throw new Error(error.message);
  }

  return unique.length;
}

function chunkIds(ids: string[], size: number): string[][] {
  const out: string[][] = [];
  for (let i = 0; i < ids.length; i += size) out.push(ids.slice(i, i + size));
  return out;
}

// ---------------- Service add-ons ----------------
export async function listAddons(sb: SB, techId: string, opts: { activeOnly?: boolean } = {}): Promise<ServiceAddon[]> {
  let q = sb.from("service_addons").select("*").eq("techId", techId);
  if (opts.activeOnly) q = q.eq("active", true);
  const { data, error } = await q.order("createdAt");
  return must(data as ServiceAddon[], error) ?? [];
}
export async function addonsForService(sb: SB, serviceId: string, opts: { activeOnly?: boolean } = {}): Promise<ServiceAddon[]> {
  let q = sb.from("service_addons").select("*").eq("serviceId", serviceId);
  if (opts.activeOnly) q = q.eq("active", true);
  const { data, error } = await q.order("createdAt");
  return must(data as ServiceAddon[], error) ?? [];
}
export async function createAddon(sb: SB, a: Omit<ServiceAddon, "id" | "createdAt">): Promise<ServiceAddon> {
  const { data, error } = await sb.from("service_addons").insert({ ...a, id: randomId("add") }).select("*").single();
  return must(data as ServiceAddon, error);
}
export async function deleteAddon(sb: SB, id: string): Promise<void> {
  const { error } = await sb.from("service_addons").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ---------------- Working hours / time off ----------------
export async function listWorkingHours(
  sb: SB,
  techId: string,
  staffId?: string,
): Promise<WorkingHour[]> {
  let q = sb.from("working_hours").select("*").eq("techId", techId);
  if (staffId) q = q.eq("staffId", staffId);
  const { data, error } = await q.order("weekday");
  return must(data as WorkingHour[], error) ?? [];
}
export async function replaceWorkingHours(
  sb: SB,
  techId: string,
  rows: WorkingHour[],
  staffId?: string,
): Promise<void> {
  // Scope the wipe to one staff member's rows when given, so editing one
  // person's hours never deletes a colleague's.
  let del = sb.from("working_hours").delete().eq("techId", techId);
  if (staffId) del = del.eq("staffId", staffId);
  const delRes = await del;
  if (delRes.error) throw new Error(delRes.error.message);
  if (rows.length) {
    // Strip undefined/null staffId so pre-migration environments keep working.
    const clean = rows.map((r) => {
      const { staffId: sid, ...rest } = r;
      return sid != null ? { ...rest, staffId: sid } : rest;
    });
    const { error } = await sb.from("working_hours").insert(clean);
    if (error) throw new Error(error.message);
  }
}
/** Rota rows for a tech, optionally one staff member and/or a week range (inclusive). */
export async function listRotaHours(
  sb: SB,
  techId: string,
  opts: { staffId?: string; fromWeek?: string; toWeek?: string } = {},
): Promise<RotaHour[]> {
  let q = sb.from("rota_hours").select("*").eq("techId", techId);
  if (opts.staffId) q = q.eq("staffId", opts.staffId);
  if (opts.fromWeek) q = q.gte("weekStart", opts.fromWeek);
  if (opts.toWeek) q = q.lte("weekStart", opts.toWeek);
  const { data, error } = await q.order("weekStart").order("weekday");
  if (error) {
    // Migration not applied yet.
    if (/rota_hours|schema cache/i.test(error.message)) return [];
    throw new Error(error.message);
  }
  return (data as RotaHour[]) ?? [];
}

/** Replace all 7 days for one staff member + week (delete then insert). */
export async function replaceRotaWeek(
  sb: SB,
  techId: string,
  staffId: string,
  weekStart: string,
  rows: RotaHour[],
): Promise<void> {
  const { error: delErr } = await sb
    .from("rota_hours")
    .delete()
    .eq("techId", techId)
    .eq("staffId", staffId)
    .eq("weekStart", weekStart);
  if (delErr) throw new Error(delErr.message);
  if (!rows.length) return;
  const { error } = await sb.from("rota_hours").insert(rows);
  if (error) throw new Error(error.message);
}

/** Remove a saved rota week so booking falls back to flexible / template hours. */
export async function clearRotaWeek(
  sb: SB,
  techId: string,
  staffId: string,
  weekStart: string,
): Promise<void> {
  const { error } = await sb
    .from("rota_hours")
    .delete()
    .eq("techId", techId)
    .eq("staffId", staffId)
    .eq("weekStart", weekStart);
  if (error) throw new Error(error.message);
}

export async function listTimeOff(sb: SB, techId: string): Promise<TimeOff[]> {
  const { data, error } = await sb.from("time_off").select("*").eq("techId", techId).order("startIso");
  return must(data as TimeOff[], error) ?? [];
}
export async function createTimeOff(sb: SB, t: Omit<TimeOff, "id">): Promise<void> {
  const { error } = await sb.from("time_off").insert({ ...t, id: randomId("off") });
  if (error) throw new Error(error.message);
}
export async function deleteTimeOff(sb: SB, id: string): Promise<void> {
  const { error } = await sb.from("time_off").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ---------------- Clients ----------------
export async function listClients(sb: SB, techId: string): Promise<Client[]> {
  return listAllForTech<Client>(sb, "clients", techId, "name");
}
export async function getClient(sb: SB, id: string): Promise<Client | null> {
  const { data, error } = await sb.from("clients").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data as Client | null;
}
export async function getClientByEmail(sb: SB, techId: string, email: string): Promise<Client | null> {
  if (!email) return null;
  const { data, error } = await sb.from("clients").select("*").eq("techId", techId).ilike("email", email).maybeSingle();
  if (error) throw new Error(error.message);
  return data as Client | null;
}
export async function getClientByMessageToken(sb: SB, token: string): Promise<Client | null> {
  if (!token) return null;
  const { data, error } = await sb.from("clients").select("*").eq("messageToken", token).maybeSingle();
  if (error) throw new Error(error.message);
  return data as Client | null;
}
type ClientInsert = Omit<
  Client,
  | "id"
  | "createdAt"
  | "noShowCount"
  | "isBlacklisted"
  | "warningNote"
  | "messageToken"
  | "isVip"
  | "lastNudgeAtIso"
  | "marketingOptOut"
> &
  Partial<
    Pick<
      Client,
      | "noShowCount"
      | "isBlacklisted"
      | "warningNote"
      | "messageToken"
      | "isVip"
      | "lastNudgeAtIso"
      | "marketingOptOut"
    >
  >;

function prepareClientRow(c: ClientInsert): Record<string, unknown> {
  return {
    noShowCount: 0,
    isBlacklisted: false,
    warningNote: "",
    isVip: false,
    ...c,
    id: randomId("cli"),
  };
}

export async function createClient(sb: SB, c: ClientInsert): Promise<Client> {
  const { data, error } = await sb.from("clients").insert(prepareClientRow(c)).select("*").single();
  return must(data as Client, error);
}

/** Bulk insert clients (used by Move to Glow). Falls back per-row on unique conflicts. */
export async function createClientsBatch(sb: SB, rows: ClientInsert[]): Promise<Client[]> {
  if (rows.length === 0) return [];
  const prepared = rows.map(prepareClientRow);
  const { data, error } = await sb.from("clients").insert(prepared).select("*");
  if (!error) return (data as Client[]) ?? [];
  if (!/duplicate key|unique constraint|23505/i.test(error.message)) throwDbError(error);

  // One bad row would abort the whole batch — insert survivors individually.
  const created: Client[] = [];
  for (const row of rows) {
    try {
      created.push(await createClient(sb, row));
    } catch (e) {
      if (/duplicate key|unique constraint|23505/i.test(e instanceof Error ? e.message : "")) continue;
      throw e;
    }
  }
  return created;
}
export async function updateClient(sb: SB, id: string, patch: Partial<Client>): Promise<void> {
  const { error } = await sb.from("clients").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}
export async function findOrCreateClient(
  sb: SB,
  techId: string,
  data: { name: string; email: string; phone: string },
): Promise<Client> {
  // Match on email first, then phone, then exact name (case-insensitive), so
  // manual bookings without an email reuse the existing client instead of
  // creating a duplicate account.
  let existing = await getClientByEmail(sb, techId, data.email);
  if (!existing && data.phone) {
    const digits = data.phone.replace(/\D/g, "");
    if (digits.length >= 7) {
      const { data: rows, error } = await sb.from("clients").select("*").eq("techId", techId);
      if (error) throw new Error(error.message);
      existing = ((rows as Client[]) ?? []).find((c) => c.phone.replace(/\D/g, "") === digits) ?? null;
    }
  }
  if (!existing && data.name) {
    const { data: rows, error } = await sb
      .from("clients")
      .select("*")
      .eq("techId", techId)
      .ilike("name", data.name.trim());
    if (error) throw new Error(error.message);
    existing = ((rows as Client[]) ?? [])[0] ?? null;
  }

  if (existing) {
    const patch = {
      name: data.name || existing.name,
      email: data.email || existing.email,
      phone: data.phone || existing.phone,
    };
    await updateClient(sb, existing.id, patch);
    return { ...existing, ...patch };
  }
  return createClient(sb, { techId, notes: "", ...data });
}

// ---------------- Bookings ----------------
export async function listBookings(sb: SB, techId: string): Promise<Booking[]> {
  return listAllForTech<Booking>(sb, "bookings", techId, "startIso");
}

/** Bookings that block availability within a time window (for slot calculation). */
export async function listBlockingBookingsInRange(
  sb: SB,
  techId: string,
  fromIso: string,
  toIso: string,
  staffId?: string,
): Promise<Booking[]> {
  let q = sb
    .from("bookings")
    .select("*")
    .eq("techId", techId)
    .gte("startIso", fromIso)
    .lt("startIso", toIso)
    .in("status", ["pending_approval", "pending", "confirmed", "completed"]);
  if (staffId) q = q.eq("staffId", staffId);
  const { data, error } = await q.order("startIso");
  return must(data as Booking[], error) ?? [];
}

/** Bounded window for calendar views — avoids loading entire booking history. */
export async function listBookingsInWindow(
  sb: SB,
  techId: string,
  fromIso: string,
  toIso: string,
): Promise<Booking[]> {
  const { data, error } = await sb
    .from("bookings")
    .select("*")
    .eq("techId", techId)
    .gte("startIso", fromIso)
    .lte("startIso", toIso)
    .order("startIso");
  return must(data as Booking[], error) ?? [];
}

export async function listUpcomingBookings(
  sb: SB,
  techId: string,
  fromIso: string,
  limit = 20,
): Promise<Booking[]> {
  const { data, error } = await sb
    .from("bookings")
    .select("*")
    .eq("techId", techId)
    .gte("startIso", fromIso)
    .in("status", ["pending", "confirmed"])
    .order("startIso")
    .limit(limit);
  return must(data as Booking[], error) ?? [];
}

/**
 * Past appointments that still need wrap-up: not completed/cancelled/no-show,
 * or completed but with deposit/balance still unpaid.
 */
export async function listPastBookingsNeedingWrapUp(
  sb: SB,
  techId: string,
  beforeIso: string,
  limit = 25,
): Promise<Booking[]> {
  const windowStart = new Date(
    new Date(beforeIso).getTime() - 90 * 24 * 60 * 60 * 1000,
  ).toISOString();
  const { data, error } = await sb
    .from("bookings")
    .select("*")
    .eq("techId", techId)
    .gte("startIso", windowStart)
    .lt("startIso", beforeIso)
    .in("status", ["pending_approval", "pending", "confirmed", "completed"])
    .order("startIso", { ascending: false })
    .limit(80);
  const rows = must(data as Booking[], error) ?? [];
  const needsWrapUp = rows.filter((b) => {
    if (b.status !== "completed") return true;
    const depositDue =
      b.depositPennies > 0 &&
      b.depositStatus !== "paid" &&
      b.depositStatus !== "forfeited" &&
      b.depositStatus !== "refunded";
    const balanceDue =
      b.balancePennies > 0 &&
      b.balanceStatus !== "paid" &&
      b.balanceStatus !== "refunded";
    return depositDue || balanceDue;
  });
  return needsWrapUp.slice(0, limit);
}

export async function getBookingsByIds(sb: SB, ids: string[]): Promise<Booking[]> {
  if (ids.length === 0) return [];
  const { data, error } = await sb.from("bookings").select("*").in("id", ids);
  return must(data as Booking[], error) ?? [];
}

export async function completedVisitCounts(
  sb: SB,
  techId: string,
): Promise<Map<string, number>> {
  const { data, error } = await sb
    .from("bookings")
    .select("clientId")
    .eq("techId", techId)
    .eq("status", "completed");
  if (error) throw new Error(error.message);
  const counts = new Map<string, number>();
  for (const row of (data as { clientId: string }[]) ?? []) {
    counts.set(row.clientId, (counts.get(row.clientId) ?? 0) + 1);
  }
  return counts;
}

export async function countBlacklistedClients(sb: SB, techId: string): Promise<number> {
  const { count, error } = await sb
    .from("clients")
    .select("*", { count: "exact", head: true })
    .eq("techId", techId)
    .eq("isBlacklisted", true);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function countNoShowBookings(sb: SB, techId: string): Promise<number> {
  const { count, error } = await sb
    .from("bookings")
    .select("*", { count: "exact", head: true })
    .eq("techId", techId)
    .eq("status", "no_show");
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function sumMonthIncome(
  sb: SB,
  techId: string,
  monthStartIso: string,
): Promise<number> {
  const { data, error } = await sb
    .from("payments")
    .select("kind, amountPennies")
    .eq("techId", techId)
    .eq("status", "succeeded")
    .gte("createdAt", monthStartIso);
  if (error) throw new Error(error.message);
  return ((data as Pick<Payment, "kind" | "amountPennies">[]) ?? []).reduce(
    (sum, p) => sum + (p.kind === "refund" ? -p.amountPennies : p.amountPennies),
    0,
  );
}

export async function sumOutstandingBalances(
  sb: SB,
  techId: string,
  fromIso: string,
): Promise<number> {
  const { data, error } = await sb
    .from("bookings")
    .select("balancePennies")
    .eq("techId", techId)
    .gte("startIso", fromIso)
    .eq("balanceStatus", "unpaid")
    .in("status", ["pending", "confirmed"]);
  if (error) throw new Error(error.message);
  return ((data as Pick<Booking, "balancePennies">[]) ?? []).reduce(
    (sum, b) => sum + b.balancePennies,
    0,
  );
}

export async function countUpcomingBookings(
  sb: SB,
  techId: string,
  fromIso: string,
): Promise<number> {
  const { count, error } = await sb
    .from("bookings")
    .select("*", { count: "exact", head: true })
    .eq("techId", techId)
    .gte("startIso", fromIso)
    .in("status", ["pending", "confirmed"]);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function countTodayBookings(
  sb: SB,
  techId: string,
  dayStartIso: string,
  dayEndIso: string,
): Promise<number> {
  const { count, error } = await sb
    .from("bookings")
    .select("*", { count: "exact", head: true })
    .eq("techId", techId)
    .gte("startIso", dayStartIso)
    .lte("startIso", dayEndIso)
    .neq("status", "cancelled");
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export interface ReportSummary {
  totalIncome: number;
  depositsTotal: number;
  balancesTotal: number;
  completed: number;
  noShows: number;
  forfeited: number;
  byMonth: [string, number][];
  byService: [string, number][];
}

export async function getReportSummary(sb: SB, techId: string): Promise<ReportSummary> {
  const [paymentsRes, bookingsRes, services] = await Promise.all([
    sb
      .from("payments")
      .select("kind, amountPennies, createdAt, bookingId, status")
      .eq("techId", techId)
      .eq("status", "succeeded"),
    sb
      .from("bookings")
      .select("id, serviceId, status, depositStatus, depositPennies")
      .eq("techId", techId),
    listServices(sb, techId),
  ]);
  if (paymentsRes.error) throw new Error(paymentsRes.error.message);
  if (bookingsRes.error) throw new Error(bookingsRes.error.message);

  const payments = (paymentsRes.data ?? []) as Pick<
    Payment,
    "kind" | "amountPennies" | "createdAt" | "bookingId"
  >[];
  const bookings = (bookingsRes.data ?? []) as Pick<
    Booking,
    "id" | "serviceId" | "status" | "depositStatus" | "depositPennies"
  >[];
  const bookingById = new Map(bookings.map((b) => [b.id, b]));
  const serviceById = new Map(services.map((s) => [s.id, s.name]));
  const signed = (kind: string, amt: number) => (kind === "refund" ? -amt : amt);

  const totalIncome = payments.reduce((s, p) => s + signed(p.kind, p.amountPennies), 0);
  const depositsTotal = payments
    .filter((p) => p.kind === "deposit")
    .reduce((s, p) => s + p.amountPennies, 0);
  const balancesTotal = payments
    .filter((p) => p.kind === "balance")
    .reduce((s, p) => s + p.amountPennies, 0);
  const completed = bookings.filter((b) => b.status === "completed").length;
  const noShows = bookings.filter((b) => b.status === "no_show").length;
  const forfeited = bookings
    .filter((b) => b.depositStatus === "forfeited")
    .reduce((s, b) => s + b.depositPennies, 0);

  const byMonth = new Map<string, number>();
  for (const p of payments) {
    const key = p.createdAt.slice(0, 7);
    byMonth.set(key, (byMonth.get(key) ?? 0) + signed(p.kind, p.amountPennies));
  }

  const byService = new Map<string, number>();
  for (const p of payments) {
    const b = bookingById.get(p.bookingId);
    if (!b) continue;
    const name = serviceById.get(b.serviceId) ?? "Other";
    byService.set(name, (byService.get(name) ?? 0) + signed(p.kind, p.amountPennies));
  }

  return {
    totalIncome,
    depositsTotal,
    balancesTotal,
    completed,
    noShows,
    forfeited,
    byMonth: [...byMonth.entries()].sort((a, b) => b[0].localeCompare(a[0])),
    byService: [...byService.entries()].sort((a, b) => b[1] - a[1]),
  };
}

export async function getClientsByIds(sb: SB, ids: string[]): Promise<Client[]> {
  if (ids.length === 0) return [];
  const { data, error } = await sb.from("clients").select("*").in("id", ids);
  return must(data as Client[], error) ?? [];
}

export async function getClientNameMap(
  sb: SB,
  clientIds: string[],
): Promise<Map<string, string>> {
  if (clientIds.length === 0) return new Map();
  const { data, error } = await sb
    .from("clients")
    .select("id, name")
    .in("id", clientIds);
  if (error) throw new Error(error.message);
  return new Map(
    ((data as Pick<Client, "id" | "name">[]) ?? []).map((c) => [c.id, c.name]),
  );
}

export async function listRecentPayments(
  sb: SB,
  techId: string,
  sinceIso: string,
): Promise<Payment[]> {
  const { data, error } = await sb
    .from("payments")
    .select("*")
    .eq("techId", techId)
    .gte("createdAt", sinceIso)
    .order("createdAt");
  return must(data as Payment[], error) ?? [];
}

export async function listInsightBookings(
  sb: SB,
  techId: string,
  fromIso: string,
  toIso: string,
): Promise<Booking[]> {
  const { data, error } = await sb
    .from("bookings")
    .select("*")
    .eq("techId", techId)
    .gte("startIso", fromIso)
    .lte("startIso", toIso)
    .order("startIso");
  return must(data as Booking[], error) ?? [];
}
export async function getBooking(sb: SB, id: string): Promise<Booking | null> {
  const { data, error } = await sb.from("bookings").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data as Booking | null;
}
export async function getBookingByToken(sb: SB, token: string): Promise<Booking | null> {
  const { data, error } = await sb.from("bookings").select("*").eq("balanceToken", token).maybeSingle();
  if (error) throw new Error(error.message);
  return data as Booking | null;
}
export async function getBookingByApprovalToken(sb: SB, token: string): Promise<Booking | null> {
  const { data, error } = await sb.from("bookings").select("*").eq("approvalToken", token).maybeSingle();
  if (error) throw new Error(error.message);
  return data as Booking | null;
}
export async function bookingsForClient(sb: SB, techId: string, clientId: string): Promise<Booking[]> {
  const { data, error } = await sb.from("bookings").select("*").eq("techId", techId).eq("clientId", clientId).order("startIso");
  return must(data as Booking[], error) ?? [];
}
type BookingInsert = Omit<
  Booking,
  "id" | "createdAt" | "googleEventId" | "approvalToken" | "groupId" | "staffId"
> &
  Partial<Pick<Booking, "googleEventId" | "approvalToken" | "groupId" | "staffId">>;

function prepareBookingRow(b: BookingInsert): Record<string, unknown> {
  // groupId/staffId are only included when set so bookings keep working while
  // the 0028/0029 migrations are still pending on an environment.
  const { groupId, staffId, ...rest } = b;
  const row: Record<string, unknown> = {
    ...rest,
    approvalToken: b.approvalToken ?? null,
    id: randomId("bk"),
  };
  if (groupId != null) row.groupId = groupId;
  if (staffId != null) row.staffId = staffId;
  return row;
}

export async function createBooking(sb: SB, b: BookingInsert): Promise<Booking> {
  const { data, error } = await sb.from("bookings").insert(prepareBookingRow(b)).select("*").single();
  if (error) throwDbError(error);
  return data as Booking;
}

/** Bulk insert bookings for Move to Glow. Falls back per-row on unique slot conflicts. */
export async function createBookingsBatch(sb: SB, rows: BookingInsert[]): Promise<Booking[]> {
  if (rows.length === 0) return [];
  const prepared = rows.map(prepareBookingRow);
  const { data, error } = await sb.from("bookings").insert(prepared).select("*");
  if (!error) return (data as Booking[]) ?? [];
  if (!/duplicate key|unique constraint|23505/i.test(error.message)) throwDbError(error);

  const created: Booking[] = [];
  for (const row of rows) {
    try {
      created.push(await createBooking(sb, row));
    } catch (e) {
      if (/duplicate key|unique constraint|23505/i.test(e instanceof Error ? e.message : "")) continue;
      throw e;
    }
  }
  return created;
}

// ---------------- Staff (salon mode) ----------------

export async function listStaff(
  sb: SB,
  techId: string,
  opts: { activeOnly?: boolean } = {},
): Promise<StaffMember[]> {
  let q = sb.from("staff_members").select("*").eq("techId", techId);
  if (opts.activeOnly) q = q.eq("active", true);
  const { data, error } = await q.order("sortOrder").order("createdAt");
  return must(data as StaffMember[], error) ?? [];
}

export async function getStaff(sb: SB, id: string): Promise<StaffMember | null> {
  const { data, error } = await sb.from("staff_members").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data as StaffMember | null;
}

export async function getStaffByAuthUserId(sb: SB, authUserId: string): Promise<StaffMember | null> {
  const { data, error } = await sb
    .from("staff_members")
    .select("*")
    .eq("authUserId", authUserId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as StaffMember | null;
}

export async function createStaff(
  sb: SB,
  s: Omit<StaffMember, "id" | "createdAt"> & Partial<Pick<StaffMember, "id">>,
): Promise<StaffMember> {
  const { data, error } = await sb
    .from("staff_members")
    .insert({ ...s, id: s.id ?? randomId("stf") })
    .select("*")
    .single();
  if (error) throwDbError(error);
  return data as StaffMember;
}

export async function updateStaff(sb: SB, id: string, patch: Partial<StaffMember>): Promise<void> {
  const { error } = await sb.from("staff_members").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

/**
 * Service ids a staff member is restricted to. Empty array = performs ALL
 * services (the default; no rows stored).
 */
export async function staffServiceIds(sb: SB, staffId: string): Promise<string[]> {
  const { data, error } = await sb.from("staff_services").select("serviceId").eq("staffId", staffId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => (r as { serviceId: string }).serviceId);
}

/** Restriction map for several staff at once: staffId -> serviceIds ([] = all). */
export async function staffServiceMap(
  sb: SB,
  staffIds: string[],
): Promise<Record<string, string[]>> {
  const map: Record<string, string[]> = {};
  for (const id of staffIds) map[id] = [];
  if (!staffIds.length) return map;
  const { data, error } = await sb
    .from("staff_services")
    .select("staffId, serviceId")
    .in("staffId", staffIds);
  if (error) throw new Error(error.message);
  for (const row of (data ?? []) as { staffId: string; serviceId: string }[]) {
    (map[row.staffId] ??= []).push(row.serviceId);
  }
  return map;
}

export async function setStaffServices(sb: SB, staffId: string, serviceIds: string[]): Promise<void> {
  const del = await sb.from("staff_services").delete().eq("staffId", staffId);
  if (del.error) throw new Error(del.error.message);
  if (serviceIds.length) {
    const { error } = await sb
      .from("staff_services")
      .insert(serviceIds.map((serviceId) => ({ staffId, serviceId })));
    if (error) throw new Error(error.message);
  }
}

/** All bookings sharing a basket group id, earliest first. */
export async function listBookingsByGroup(sb: SB, groupId: string): Promise<Booking[]> {
  const { data, error } = await sb
    .from("bookings")
    .select("*")
    .eq("groupId", groupId)
    .order("startIso");
  return must(data as Booking[], error) ?? [];
}
export async function updateBooking(sb: SB, id: string, patch: Partial<Booking>): Promise<void> {
  const { error } = await sb.from("bookings").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}
/** Hard delete (mistake bookings). Payments and reminders cascade in the DB. */
export async function deleteBooking(sb: SB, id: string): Promise<void> {
  const { error } = await sb.from("bookings").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
export async function bookingsForService(sb: SB, serviceId: string): Promise<Booking[]> {
  const { data, error } = await sb.from("bookings").select("*").eq("serviceId", serviceId);
  return must(data as Booking[], error) ?? [];
}
/** Skip any still-scheduled reminders for a booking (used when rescheduling). */
export async function skipScheduledReminders(sb: SB, bookingId: string): Promise<void> {
  const { error } = await sb
    .from("reminders")
    .update({ status: "skipped" })
    .eq("bookingId", bookingId)
    .eq("status", "scheduled");
  if (error) throw new Error(error.message);
}

// ---------------- Payments ----------------
export async function listPayments(sb: SB, techId: string): Promise<Payment[]> {
  const { data, error } = await sb.from("payments").select("*").eq("techId", techId).order("createdAt");
  return must(data as Payment[], error) ?? [];
}
export async function paymentsForBooking(sb: SB, bookingId: string): Promise<Payment[]> {
  const { data, error } = await sb.from("payments").select("*").eq("bookingId", bookingId);
  return must(data as Payment[], error) ?? [];
}
export async function createPayment(sb: SB, p: Omit<Payment, "id" | "createdAt">): Promise<Payment> {
  const { data, error } = await sb.from("payments").insert({ ...p, id: randomId("pay") }).select("*").single();
  if (error) throwDbError(error);
  return data as Payment;
}

// ---------------- Patch tests ----------------
export async function listPatchTests(sb: SB, techId: string): Promise<PatchTest[]> {
  const { data, error } = await sb.from("patch_tests").select("*").eq("techId", techId).order("performedAtIso", { ascending: false });
  return must(data as PatchTest[], error) ?? [];
}
export async function patchTestsForClient(sb: SB, techId: string, clientId: string): Promise<PatchTest[]> {
  const { data, error } = await sb.from("patch_tests").select("*").eq("techId", techId).eq("clientId", clientId).order("performedAtIso", { ascending: false });
  return must(data as PatchTest[], error) ?? [];
}
export async function createPatchTest(sb: SB, p: Omit<PatchTest, "id" | "createdAt">): Promise<PatchTest> {
  const { data, error } = await sb.from("patch_tests").insert({ ...p, id: randomId("pt") }).select("*").single();
  return must(data as PatchTest, error);
}
export async function updatePatchTest(sb: SB, id: string, patch: Partial<PatchTest>): Promise<void> {
  const { error } = await sb.from("patch_tests").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

// ---------------- Product change re-tests ----------------
export async function createProductChangeEvent(
  sb: SB,
  e: ProductChangeEvent,
): Promise<ProductChangeEvent> {
  const { data, error } = await sb.from("product_change_events").insert(e).select("*").single();
  return must(data as ProductChangeEvent, error);
}
export async function listProductChangeEvents(sb: SB, techId: string): Promise<ProductChangeEvent[]> {
  const { data, error } = await sb
    .from("product_change_events")
    .select("*")
    .eq("techId", techId)
    .order("createdAt", { ascending: false });
  return must(data as ProductChangeEvent[], error) ?? [];
}
export async function listProductChangeRetests(sb: SB, techId: string): Promise<ProductChangeRetest[]> {
  const { data, error } = await sb
    .from("product_change_retests")
    .select("*")
    .eq("techId", techId)
    .order("createdAt", { ascending: false });
  return must(data as ProductChangeRetest[], error) ?? [];
}
export async function createProductChangeRetest(
  sb: SB,
  r: ProductChangeRetest,
): Promise<ProductChangeRetest> {
  const { data, error } = await sb.from("product_change_retests").insert(r).select("*").single();
  return must(data as ProductChangeRetest, error);
}
export async function updateProductChangeRetest(
  sb: SB,
  id: string,
  patch: Partial<ProductChangeRetest>,
): Promise<void> {
  const { error } = await sb.from("product_change_retests").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

// ---------------- Products & batches ----------------
export async function listProducts(sb: SB, techId: string): Promise<Product[]> {
  const { data, error } = await sb
    .from("products")
    .select("*")
    .eq("techId", techId)
    .order("name");
  return must(data as Product[], error) ?? [];
}
export async function getProduct(sb: SB, id: string): Promise<Product | null> {
  const { data, error } = await sb.from("products").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data as Product | null;
}
export async function createProduct(sb: SB, p: Omit<Product, "id" | "createdAt">): Promise<Product> {
  const { data, error } = await sb.from("products").insert({ ...p, id: randomId("prd") }).select("*").single();
  return must(data as Product, error);
}
export async function updateProduct(sb: SB, id: string, patch: Partial<Product>): Promise<void> {
  const { error } = await sb.from("products").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}
export async function deleteProduct(sb: SB, id: string): Promise<void> {
  const { error } = await sb.from("products").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function listProductBatches(sb: SB, techId: string): Promise<ProductBatch[]> {
  const { data, error } = await sb
    .from("product_batches")
    .select("*")
    .eq("techId", techId)
    .order("createdAt", { ascending: false });
  return must(data as ProductBatch[], error) ?? [];
}
export async function listActiveBatchesForProduct(sb: SB, productId: string): Promise<ProductBatch[]> {
  const { data, error } = await sb
    .from("product_batches")
    .select("*")
    .eq("productId", productId)
    .is("retiredAtIso", null)
    .order("createdAt", { ascending: false });
  return must(data as ProductBatch[], error) ?? [];
}
export async function getProductBatch(sb: SB, id: string): Promise<ProductBatch | null> {
  const { data, error } = await sb.from("product_batches").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data as ProductBatch | null;
}
export async function createProductBatch(sb: SB, b: Omit<ProductBatch, "id" | "createdAt">): Promise<ProductBatch> {
  const { data, error } = await sb.from("product_batches").insert({ ...b, id: randomId("bat") }).select("*").single();
  return must(data as ProductBatch, error);
}
export async function updateProductBatch(sb: SB, id: string, patch: Partial<ProductBatch>): Promise<void> {
  const { error } = await sb.from("product_batches").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function createProductUsage(sb: SB, u: Omit<ProductUsage, "id" | "createdAt">): Promise<ProductUsage> {
  const { data, error } = await sb.from("product_usages").insert({ ...u, id: randomId("usg") }).select("*").single();
  return must(data as ProductUsage, error);
}
export async function productUsagesForClient(sb: SB, techId: string, clientId: string): Promise<ProductUsage[]> {
  const { data, error } = await sb
    .from("product_usages")
    .select("*")
    .eq("techId", techId)
    .eq("clientId", clientId)
    .order("usedAtIso", { ascending: false });
  return must(data as ProductUsage[], error) ?? [];
}
export async function productUsagesForBatch(sb: SB, batchId: string): Promise<ProductUsage[]> {
  const { data, error } = await sb
    .from("product_usages")
    .select("*")
    .eq("batchId", batchId)
    .order("usedAtIso", { ascending: false });
  return must(data as ProductUsage[], error) ?? [];
}

export async function listClientReactions(sb: SB, techId: string, clientId?: string): Promise<ClientReaction[]> {
  let q = sb.from("client_reactions").select("*").eq("techId", techId);
  if (clientId) q = q.eq("clientId", clientId);
  const { data, error } = await q.order("onsetIso", { ascending: false });
  return must(data as ClientReaction[], error) ?? [];
}
export async function reactionsForBatch(sb: SB, batchId: string): Promise<ClientReaction[]> {
  const { data, error } = await sb
    .from("client_reactions")
    .select("*")
    .eq("batchId", batchId)
    .order("onsetIso", { ascending: false });
  return must(data as ClientReaction[], error) ?? [];
}
export async function createClientReaction(sb: SB, r: Omit<ClientReaction, "id" | "createdAt">): Promise<ClientReaction> {
  const { data, error } = await sb.from("client_reactions").insert({ ...r, id: randomId("rxn") }).select("*").single();
  return must(data as ClientReaction, error);
}
export async function deleteClientReaction(sb: SB, id: string): Promise<void> {
  const { error } = await sb.from("client_reactions").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ---------------- Reaction check-ins ----------------
export async function getReactionCheckin(sb: SB, id: string): Promise<ReactionCheckin | null> {
  const { data, error } = await sb.from("reaction_checkins").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data as ReactionCheckin | null;
}
export async function getReactionCheckinByToken(sb: SB, token: string): Promise<ReactionCheckin | null> {
  const { data, error } = await sb.rpc("reaction_checkin_by_token", { lookup_token: token });
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  return (row as ReactionCheckin) ?? null;
}
export async function listReactionCheckins(sb: SB, techId: string): Promise<ReactionCheckin[]> {
  const { data, error } = await sb
    .from("reaction_checkins")
    .select("*")
    .eq("techId", techId)
    .order("createdAt", { ascending: false });
  return must(data as ReactionCheckin[], error) ?? [];
}
export async function reactionCheckinsForClient(
  sb: SB,
  techId: string,
  clientId: string,
): Promise<ReactionCheckin[]> {
  const { data, error } = await sb
    .from("reaction_checkins")
    .select("*")
    .eq("techId", techId)
    .eq("clientId", clientId)
    .order("createdAt", { ascending: false });
  return must(data as ReactionCheckin[], error) ?? [];
}
export async function dueReactionCheckins(sb: SB, nowIso: string): Promise<ReactionCheckin[]> {
  const { data, error } = await sb
    .from("reaction_checkins")
    .select("*")
    .eq("status", "scheduled")
    .lte("sendAtIso", nowIso);
  return must(data as ReactionCheckin[], error) ?? [];
}
export async function createReactionCheckin(
  sb: SB,
  c: Omit<ReactionCheckin, "id" | "createdAt">,
): Promise<ReactionCheckin> {
  const { data, error } = await sb.from("reaction_checkins").insert({ ...c, id: randomId("rci") }).select("*").single();
  return must(data as ReactionCheckin, error);
}
export async function updateReactionCheckin(sb: SB, id: string, patch: Partial<ReactionCheckin>): Promise<void> {
  const { error } = await sb.from("reaction_checkins").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

// ---------------- Infill deadline nudges ----------------
export async function listInfillDeadlineNudges(sb: SB, techId: string): Promise<InfillDeadlineNudge[]> {
  const { data, error } = await sb
    .from("infill_deadline_nudges")
    .select("*")
    .eq("techId", techId)
    .order("createdAt", { ascending: false });
  return must(data as InfillDeadlineNudge[], error) ?? [];
}
export async function dueInfillDeadlineNudges(sb: SB, nowIso: string): Promise<InfillDeadlineNudge[]> {
  const { data, error } = await sb
    .from("infill_deadline_nudges")
    .select("*")
    .eq("status", "scheduled")
    .lte("sendAtIso", nowIso);
  return must(data as InfillDeadlineNudge[], error) ?? [];
}
export async function createInfillDeadlineNudge(
  sb: SB,
  n: Omit<InfillDeadlineNudge, "id" | "createdAt">,
): Promise<InfillDeadlineNudge> {
  const { data, error } = await sb
    .from("infill_deadline_nudges")
    .insert({ ...n, id: randomId("idn") })
    .select("*")
    .single();
  return must(data as InfillDeadlineNudge, error);
}
export async function updateInfillDeadlineNudge(
  sb: SB,
  id: string,
  patch: Partial<InfillDeadlineNudge>,
): Promise<void> {
  const { error } = await sb.from("infill_deadline_nudges").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

// ---------------- Running late cascade ----------------
export async function listLateCascadeEvents(sb: SB, techId: string): Promise<LateCascadeEvent[]> {
  const { data, error } = await sb
    .from("late_cascade_events")
    .select("*")
    .eq("techId", techId)
    .order("createdAt", { ascending: false });
  return must(data as LateCascadeEvent[], error) ?? [];
}
export async function createLateCascadeEvent(
  sb: SB,
  e: Omit<LateCascadeEvent, "id" | "createdAt">,
): Promise<LateCascadeEvent> {
  const { data, error } = await sb
    .from("late_cascade_events")
    .insert({ ...e, id: randomId("lce") })
    .select("*")
    .single();
  return must(data as LateCascadeEvent, error);
}
export async function createLateCascadeNotification(
  sb: SB,
  n: Omit<LateCascadeNotification, "id" | "createdAt">,
): Promise<LateCascadeNotification> {
  const { data, error } = await sb
    .from("late_cascade_notifications")
    .insert({ ...n, id: randomId("lcn") })
    .select("*")
    .single();
  return must(data as LateCascadeNotification, error);
}

// ---------------- Pre-care confirmations ----------------
export async function listPreCareConfirmations(sb: SB, techId: string): Promise<PreCareConfirmation[]> {
  const { data, error } = await sb
    .from("pre_care_confirmations")
    .select("*")
    .eq("techId", techId)
    .order("createdAt", { ascending: false });
  return must(data as PreCareConfirmation[], error) ?? [];
}
export async function getPreCareConfirmation(sb: SB, id: string): Promise<PreCareConfirmation | null> {
  const { data, error } = await sb.from("pre_care_confirmations").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data as PreCareConfirmation | null;
}
export async function getPreCareConfirmationByToken(
  sb: SB,
  token: string,
): Promise<PreCareConfirmation | null> {
  const { data, error } = await sb.rpc("pre_care_confirmation_by_token", { lookup_token: token });
  if (error) throw new Error(error.message);
  const rows = data as PreCareConfirmation[] | null;
  return rows?.[0] ?? null;
}
export async function duePreCareConfirmations(sb: SB, nowIso: string): Promise<PreCareConfirmation[]> {
  const { data, error } = await sb
    .from("pre_care_confirmations")
    .select("*")
    .eq("status", "scheduled")
    .lte("sendAtIso", nowIso)
    .order("sendAtIso");
  return must(data as PreCareConfirmation[], error) ?? [];
}
export async function createPreCareConfirmation(
  sb: SB,
  row: Omit<PreCareConfirmation, "id" | "createdAt">,
): Promise<PreCareConfirmation> {
  const { data, error } = await sb
    .from("pre_care_confirmations")
    .insert({ ...row, id: randomId("pcc") })
    .select("*")
    .single();
  return must(data as PreCareConfirmation, error);
}
export async function updatePreCareConfirmation(
  sb: SB,
  id: string,
  patch: Partial<PreCareConfirmation>,
): Promise<void> {
  const { error } = await sb.from("pre_care_confirmations").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

// ---------------- DM quote links ----------------
function mapDmQuote(row: DmQuoteLink): DmQuoteLink {
  return {
    ...row,
    addons: Array.isArray(row.addons) ? row.addons : [],
  };
}

export async function listDmQuoteLinks(sb: SB, techId: string): Promise<DmQuoteLink[]> {
  const { data, error } = await sb
    .from("dm_quote_links")
    .select("*")
    .eq("techId", techId)
    .order("createdAt", { ascending: false });
  return (must(data as DmQuoteLink[], error) ?? []).map(mapDmQuote);
}

export async function getDmQuoteLink(sb: SB, id: string): Promise<DmQuoteLink | null> {
  const { data, error } = await sb.from("dm_quote_links").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapDmQuote(data as DmQuoteLink) : null;
}

export async function getDmQuoteLinkByToken(sb: SB, token: string): Promise<DmQuoteLink | null> {
  const { data, error } = await sb.rpc("dm_quote_by_token", { lookup_token: token });
  if (error) throw new Error(error.message);
  const rows = data as DmQuoteLink[] | null;
  const row = rows?.[0];
  return row ? mapDmQuote(row) : null;
}

export async function createDmQuoteLink(
  sb: SB,
  q: Omit<DmQuoteLink, "id" | "createdAt">,
): Promise<DmQuoteLink> {
  const { data, error } = await sb
    .from("dm_quote_links")
    .insert({ ...q, id: randomId("dql") })
    .select("*")
    .single();
  return mapDmQuote(must(data as DmQuoteLink, error));
}

export async function updateDmQuoteLink(
  sb: SB,
  id: string,
  patch: Partial<DmQuoteLink>,
): Promise<void> {
  const { error } = await sb.from("dm_quote_links").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

// ---------------- Reminders ----------------
export async function listReminders(sb: SB, techId: string): Promise<Reminder[]> {
  const { data, error } = await sb.from("reminders").select("*").eq("techId", techId).order("sendAtIso");
  return must(data as Reminder[], error) ?? [];
}
export async function remindersForBooking(sb: SB, bookingId: string): Promise<Reminder[]> {
  const { data, error } = await sb.from("reminders").select("*").eq("bookingId", bookingId);
  return must(data as Reminder[], error) ?? [];
}
export async function createReminder(sb: SB, r: Omit<Reminder, "id" | "createdAt">): Promise<Reminder> {
  const { data, error } = await sb.from("reminders").insert({ ...r, id: randomId("rem") }).select("*").single();
  return must(data as Reminder, error);
}
export async function dueReminders(sb: SB, nowIso: string): Promise<Reminder[]> {
  const { data, error } = await sb.from("reminders").select("*").eq("status", "scheduled").lte("sendAtIso", nowIso);
  return must(data as Reminder[], error) ?? [];
}
export async function markReminder(sb: SB, id: string, patch: Partial<Reminder>): Promise<void> {
  const { error } = await sb.from("reminders").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

// ---------------- Client photos ----------------
export async function listClientPhotos(sb: SB, clientId: string): Promise<ClientPhoto[]> {
  const { data, error } = await sb.from("client_photos").select("*").eq("clientId", clientId).order("createdAt", { ascending: false });
  return must(data as ClientPhoto[], error) ?? [];
}
export async function listClientPhotosForTech(sb: SB, techId: string): Promise<ClientPhoto[]> {
  const { data, error } = await sb.from("client_photos").select("*").eq("techId", techId).order("createdAt", { ascending: false });
  return must(data as ClientPhoto[], error) ?? [];
}
export async function createClientPhoto(sb: SB, p: Omit<ClientPhoto, "id" | "createdAt">): Promise<ClientPhoto> {
  const { data, error } = await sb.from("client_photos").insert({ ...p, id: randomId("ph") }).select("*").single();
  return must(data as ClientPhoto, error);
}
export async function getClientPhoto(sb: SB, id: string): Promise<ClientPhoto | null> {
  const { data, error } = await sb.from("client_photos").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data as ClientPhoto | null;
}
export async function deleteClientPhoto(sb: SB, id: string): Promise<void> {
  const { error } = await sb.from("client_photos").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ---------------- Consultation forms ----------------
export async function listQuestions(sb: SB, techId: string, opts: { activeOnly?: boolean } = {}): Promise<ConsultationQuestion[]> {
  let q = sb.from("consultation_questions").select("*").eq("techId", techId);
  if (opts.activeOnly) q = q.eq("active", true);
  const { data, error } = await q.order("sortOrder").order("createdAt");
  return must(data as ConsultationQuestion[], error) ?? [];
}
export async function createQuestion(sb: SB, q: Omit<ConsultationQuestion, "id" | "createdAt">): Promise<ConsultationQuestion> {
  const { data, error } = await sb.from("consultation_questions").insert({ ...q, id: randomId("q") }).select("*").single();
  return must(data as ConsultationQuestion, error);
}
export async function deleteQuestion(sb: SB, id: string): Promise<void> {
  const { error } = await sb.from("consultation_questions").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
export async function createFormResponse(sb: SB, r: Omit<FormResponse, "id" | "createdAt">): Promise<FormResponse> {
  const { data, error } = await sb.from("form_responses").insert({ ...r, id: randomId("fr") }).select("*").single();
  return must(data as FormResponse, error);
}
export async function formResponsesForClient(sb: SB, clientId: string): Promise<FormResponse[]> {
  const { data, error } = await sb.from("form_responses").select("*").eq("clientId", clientId).order("createdAt", { ascending: false });
  return must(data as FormResponse[], error) ?? [];
}
export async function listFormResponsesForTech(sb: SB, techId: string): Promise<FormResponse[]> {
  const { data, error } = await sb.from("form_responses").select("*").eq("techId", techId).order("createdAt", { ascending: false });
  return must(data as FormResponse[], error) ?? [];
}

// ---------------- Messages ----------------
export async function listMessagesForTech(sb: SB, techId: string): Promise<Message[]> {
  const { data, error } = await sb.from("messages").select("*").eq("techId", techId).order("createdAt", { ascending: false });
  return must(data as Message[], error) ?? [];
}
export async function threadMessages(sb: SB, clientId: string): Promise<Message[]> {
  const { data, error } = await sb.from("messages").select("*").eq("clientId", clientId).order("createdAt", { ascending: true });
  return must(data as Message[], error) ?? [];
}
export async function createMessage(sb: SB, m: Omit<Message, "id" | "createdAt" | "readAt"> & Partial<Pick<Message, "readAt">>): Promise<Message> {
  const { data, error } = await sb.from("messages").insert({ readAt: null, ...m, id: randomId("msg") }).select("*").single();
  return must(data as Message, error);
}
/** Mark messages in a thread that were sent by `from` as read. */
export async function markThreadRead(sb: SB, clientId: string, from: MessageSender): Promise<void> {
  const { error } = await sb
    .from("messages")
    .update({ readAt: new Date().toISOString() })
    .eq("clientId", clientId)
    .eq("sender", from)
    .is("readAt", null);
  if (error) throw new Error(error.message);
}
/** Count unread client-sent messages across all of a tech's threads (for the nav badge). */
export async function unreadCountForTech(sb: SB, techId: string): Promise<number> {
  const { count, error } = await sb
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("techId", techId)
    .eq("sender", "client")
    .is("readAt", null);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

// ---------------- Waitlist (cancellation list) ----------------
export async function createWaitlistEntry(sb: SB, w: Omit<WaitlistEntry, "id" | "createdAt" | "notifiedAtIso">): Promise<WaitlistEntry> {
  const { data, error } = await sb
    .from("waitlist_entries")
    .insert({ ...w, id: randomId("wl"), notifiedAtIso: null })
    .select("*")
    .single();
  return must(data as WaitlistEntry, error);
}
export async function listWaitlist(sb: SB, techId: string): Promise<WaitlistEntry[]> {
  const { data, error } = await sb
    .from("waitlist_entries")
    .select("*")
    .eq("techId", techId)
    .order("createdAt", { ascending: false });
  return must(data as WaitlistEntry[], error) ?? [];
}
export async function updateWaitlistEntry(sb: SB, id: string, patch: Partial<WaitlistEntry>): Promise<void> {
  const { error } = await sb.from("waitlist_entries").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}
export async function deleteWaitlistEntry(sb: SB, id: string): Promise<void> {
  const { error } = await sb.from("waitlist_entries").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ---------------- Reviews ----------------
export async function createReview(sb: SB, r: Omit<Review, "id" | "createdAt">): Promise<Review> {
  const { data, error } = await sb.from("reviews").insert({ ...r, id: randomId("rev") }).select("*").single();
  return must(data as Review, error);
}
export async function getReviewByBookingId(sb: SB, bookingId: string): Promise<Review | null> {
  const { data, error } = await sb.from("reviews").select("*").eq("bookingId", bookingId).maybeSingle();
  if (error) throw new Error(error.message);
  return data as Review | null;
}
export async function listReviewsForTech(sb: SB, techId: string): Promise<Review[]> {
  const { data, error } = await sb.from("reviews").select("*").eq("techId", techId).order("createdAt", { ascending: false });
  return must(data as Review[], error) ?? [];
}
export async function listApprovedReviews(sb: SB, techId: string): Promise<Review[]> {
  const { data, error } = await sb
    .from("reviews")
    .select("*")
    .eq("techId", techId)
    .eq("status", "approved")
    .order("createdAt", { ascending: false });
  return must(data as Review[], error) ?? [];
}
export async function updateReview(sb: SB, id: string, patch: Partial<Review>): Promise<void> {
  const { error } = await sb.from("reviews").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}
export async function deleteReview(sb: SB, id: string): Promise<void> {
  const { error } = await sb.from("reviews").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/** Techs with a live subscription (used by cross-tech cron jobs). */
export async function listLiveTechs(sb: SB): Promise<Tech[]> {
  const { data, error } = await sb
    .from("techs")
    .select("*")
    .in("subscriptionStatus", ["trialing", "active", "comped"]);
  return must(data as Tech[], error) ?? [];
}

// ---------------- Audit / compliance ----------------
export async function createAuditEvent(
  sb: SB,
  event: Omit<AuditEvent, "id" | "createdAt">,
): Promise<void> {
  const { error } = await sb.from("audit_events").insert({ ...event, id: randomId("aud") });
  if (error) throw new Error(error.message);
}
export async function listAuditEvents(sb: SB, techId: string): Promise<AuditEvent[]> {
  const { data, error } = await sb
    .from("audit_events")
    .select("*")
    .eq("techId", techId)
    .order("createdAt", { ascending: false });
  return must(data as AuditEvent[], error) ?? [];
}
export async function createAccountClosureRequest(
  sb: SB,
  request: Omit<AccountClosureRequest, "id" | "requestedAt" | "completedAt" | "status"> &
    Partial<Pick<AccountClosureRequest, "status" | "completedAt">>,
): Promise<AccountClosureRequest> {
  const { data, error } = await sb
    .from("account_closure_requests")
    .insert({ ...request, id: randomId("acr"), status: request.status ?? "requested", completedAt: request.completedAt ?? null })
    .select("*")
    .single();
  return must(data as AccountClosureRequest, error);
}
export async function listAccountClosureRequests(sb: SB, techId: string): Promise<AccountClosureRequest[]> {
  const { data, error } = await sb
    .from("account_closure_requests")
    .select("*")
    .eq("techId", techId)
    .order("requestedAt", { ascending: false });
  return must(data as AccountClosureRequest[], error) ?? [];
}
