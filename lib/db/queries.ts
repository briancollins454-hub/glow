import type { SupabaseClient } from "@supabase/supabase-js";
import { randomId } from "@/lib/utils";
import type {
  Booking,
  Client,
  Payment,
  PatchTest,
  Reminder,
  Service,
  ServiceCategory,
  Tech,
  TimeOff,
  WorkingHour,
} from "./types";

// Async data-access layer over the relational Supabase tables. Every function
// takes a SupabaseClient so the caller controls the security context:
//  - dashboard  -> authenticated server client (RLS scopes to the tech)
//  - public/cron -> service-role client (explicit techId scoping)

type SB = SupabaseClient;

function must<T>(data: T | null, error: { message: string } | null): T {
  if (error) throw new Error(error.message);
  return data as T;
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
type NewTech = Omit<
  Tech,
  | "createdAt"
  | "stripeCustomerId"
  | "stripeSubscriptionId"
  | "subscriptionStatus"
  | "plan"
  | "currentPeriodEnd"
> &
  Partial<
    Pick<
      Tech,
      | "stripeCustomerId"
      | "stripeSubscriptionId"
      | "subscriptionStatus"
      | "plan"
      | "currentPeriodEnd"
    >
  >;

export async function createTech(sb: SB, tech: NewTech): Promise<Tech> {
  const { data, error } = await sb.from("techs").insert({ ...tech }).select("*").single();
  return must(data as Tech, error);
}
export async function updateTech(sb: SB, id: string, patch: Partial<Tech>): Promise<void> {
  const { error } = await sb.from("techs").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
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
export async function createService(sb: SB, s: Omit<Service, "id" | "createdAt">): Promise<Service> {
  const { data, error } = await sb.from("services").insert({ ...s, id: randomId("svc") }).select("*").single();
  return must(data as Service, error);
}
export async function updateService(sb: SB, id: string, patch: Partial<Service>): Promise<void> {
  const { error } = await sb.from("services").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}
export async function deleteService(sb: SB, id: string): Promise<void> {
  const { error } = await sb.from("services").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ---------------- Working hours / time off ----------------
export async function listWorkingHours(sb: SB, techId: string): Promise<WorkingHour[]> {
  const { data, error } = await sb.from("working_hours").select("*").eq("techId", techId).order("weekday");
  return must(data as WorkingHour[], error) ?? [];
}
export async function replaceWorkingHours(sb: SB, techId: string, rows: WorkingHour[]): Promise<void> {
  const del = await sb.from("working_hours").delete().eq("techId", techId);
  if (del.error) throw new Error(del.error.message);
  if (rows.length) {
    const { error } = await sb.from("working_hours").insert(rows);
    if (error) throw new Error(error.message);
  }
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
  const { data, error } = await sb.from("clients").select("*").eq("techId", techId).order("name");
  return must(data as Client[], error) ?? [];
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
export async function createClient(
  sb: SB,
  c: Omit<Client, "id" | "createdAt" | "noShowCount" | "isBlacklisted" | "warningNote"> &
    Partial<Pick<Client, "noShowCount" | "isBlacklisted" | "warningNote">>,
): Promise<Client> {
  const row = {
    noShowCount: 0,
    isBlacklisted: false,
    warningNote: "",
    ...c,
    id: randomId("cli"),
  };
  const { data, error } = await sb.from("clients").insert(row).select("*").single();
  return must(data as Client, error);
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
  const existing = await getClientByEmail(sb, techId, data.email);
  if (existing) {
    await updateClient(sb, existing.id, {
      name: data.name || existing.name,
      phone: data.phone || existing.phone,
    });
    return { ...existing, name: data.name || existing.name, phone: data.phone || existing.phone };
  }
  return createClient(sb, { techId, notes: "", ...data });
}

// ---------------- Bookings ----------------
export async function listBookings(sb: SB, techId: string): Promise<Booking[]> {
  const { data, error } = await sb.from("bookings").select("*").eq("techId", techId).order("startIso");
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
export async function bookingsForClient(sb: SB, techId: string, clientId: string): Promise<Booking[]> {
  const { data, error } = await sb.from("bookings").select("*").eq("techId", techId).eq("clientId", clientId).order("startIso");
  return must(data as Booking[], error) ?? [];
}
export async function createBooking(sb: SB, b: Omit<Booking, "id" | "createdAt">): Promise<Booking> {
  const { data, error } = await sb.from("bookings").insert({ ...b, id: randomId("bk") }).select("*").single();
  return must(data as Booking, error);
}
export async function updateBooking(sb: SB, id: string, patch: Partial<Booking>): Promise<void> {
  const { error } = await sb.from("bookings").update(patch).eq("id", id);
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
  return must(data as Payment, error);
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
