import type { SupabaseClient } from "@supabase/supabase-js";
import { randomId } from "@/lib/utils";
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
  Reminder,
  Review,
  Service,
  ServiceAddon,
  ServiceCategory,
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
  | "calendarToken"
  | "closureRequestedAt"
  | "closureReason"
  | "googleRefreshToken"
  | "googleCalendarId"
  | "googleCalendarEmail"
  | "googleConnectedAt"
  | "rebookNudgesEnabled";

type NewTech = Omit<Tech, "createdAt" | ManagedTechField> &
  Partial<Pick<Tech, ManagedTechField>>;

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
export async function createService(
  sb: SB,
  s: Omit<Service, "id" | "createdAt" | "photoPath" | "aftercareText"> &
    Partial<Pick<Service, "photoPath" | "aftercareText">>,
): Promise<Service> {
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
export async function getClientByMessageToken(sb: SB, token: string): Promise<Client | null> {
  if (!token) return null;
  const { data, error } = await sb.from("clients").select("*").eq("messageToken", token).maybeSingle();
  if (error) throw new Error(error.message);
  return data as Client | null;
}
export async function createClient(
  sb: SB,
  c: Omit<Client, "id" | "createdAt" | "noShowCount" | "isBlacklisted" | "warningNote" | "messageToken" | "isVip" | "lastNudgeAtIso" | "marketingOptOut"> &
    Partial<Pick<Client, "noShowCount" | "isBlacklisted" | "warningNote" | "messageToken" | "isVip" | "lastNudgeAtIso" | "marketingOptOut">>,
): Promise<Client> {
  const row = {
    noShowCount: 0,
    isBlacklisted: false,
    warningNote: "",
    isVip: false,
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
export async function createBooking(
  sb: SB,
  b: Omit<Booking, "id" | "createdAt" | "googleEventId"> & Partial<Pick<Booking, "googleEventId">>,
): Promise<Booking> {
  const { data, error } = await sb.from("bookings").insert({ ...b, id: randomId("bk") }).select("*").single();
  return must(data as Booking, error);
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
