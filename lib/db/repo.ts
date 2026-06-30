import { getDb, save } from "./store";
import { randomId } from "@/lib/utils";
import type {
  Booking,
  Client,
  Payment,
  PatchTest,
  Reminder,
  Service,
  ServiceCategory,
  Session,
  Tech,
  TimeOff,
  WorkingHour,
} from "./types";

// ---------------- Techs ----------------
export function getTechById(id: string): Tech | undefined {
  return getDb().techs.find((t) => t.id === id);
}
export function getTechByHandle(handle: string): Tech | undefined {
  const h = handle.toLowerCase();
  return getDb().techs.find((t) => t.handle.toLowerCase() === h);
}
export function getTechByEmail(email: string): Tech | undefined {
  const e = email.toLowerCase();
  return getDb().techs.find((t) => t.email.toLowerCase() === e);
}
export function createTech(t: Omit<Tech, "id" | "createdAt">): Tech {
  const tech: Tech = { ...t, id: randomId("tech"), createdAt: new Date().toISOString() };
  getDb().techs.push(tech);
  save();
  return tech;
}
export function updateTech(id: string, patch: Partial<Tech>): Tech | undefined {
  const tech = getTechById(id);
  if (!tech) return undefined;
  Object.assign(tech, patch);
  save();
  return tech;
}

// ---------------- Categories ----------------
export function listCategories(techId: string): ServiceCategory[] {
  return getDb()
    .categories.filter((c) => c.techId === techId)
    .sort((a, b) => a.name.localeCompare(b.name));
}
export function getCategory(id: string): ServiceCategory | undefined {
  return getDb().categories.find((c) => c.id === id);
}
export function createCategory(
  c: Omit<ServiceCategory, "id" | "createdAt">,
): ServiceCategory {
  const row: ServiceCategory = {
    ...c,
    id: randomId("cat"),
    createdAt: new Date().toISOString(),
  };
  getDb().categories.push(row);
  save();
  return row;
}
export function updateCategory(
  id: string,
  patch: Partial<ServiceCategory>,
): void {
  const row = getCategory(id);
  if (row) {
    Object.assign(row, patch);
    save();
  }
}

// ---------------- Services ----------------
export function listServices(
  techId: string,
  opts: { activeOnly?: boolean } = {},
): Service[] {
  return getDb()
    .services.filter(
      (s) => s.techId === techId && (!opts.activeOnly || s.active),
    )
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}
export function getService(id: string): Service | undefined {
  return getDb().services.find((s) => s.id === id);
}
export function createService(s: Omit<Service, "id" | "createdAt">): Service {
  const row: Service = {
    ...s,
    id: randomId("svc"),
    createdAt: new Date().toISOString(),
  };
  getDb().services.push(row);
  save();
  return row;
}
export function updateService(id: string, patch: Partial<Service>): void {
  const row = getService(id);
  if (row) {
    Object.assign(row, patch);
    save();
  }
}
export function deleteService(id: string): void {
  const db = getDb();
  db.services = db.services.filter((s) => s.id !== id);
  save();
}

// ---------------- Working hours / time off ----------------
export function listWorkingHours(techId: string): WorkingHour[] {
  return getDb()
    .workingHours.filter((w) => w.techId === techId)
    .sort((a, b) => a.weekday - b.weekday);
}
export function replaceWorkingHours(techId: string, rows: WorkingHour[]): void {
  const db = getDb();
  db.workingHours = db.workingHours.filter((w) => w.techId !== techId);
  db.workingHours.push(...rows);
  save();
}
export function listTimeOff(techId: string): TimeOff[] {
  return getDb()
    .timeOff.filter((t) => t.techId === techId)
    .sort((a, b) => a.startIso.localeCompare(b.startIso));
}
export function createTimeOff(t: Omit<TimeOff, "id">): TimeOff {
  const row: TimeOff = { ...t, id: randomId("off") };
  getDb().timeOff.push(row);
  save();
  return row;
}
export function deleteTimeOff(id: string): void {
  const db = getDb();
  db.timeOff = db.timeOff.filter((t) => t.id !== id);
  save();
}

// ---------------- Clients ----------------
export function listClients(techId: string): Client[] {
  return getDb()
    .clients.filter((c) => c.techId === techId)
    .sort((a, b) => a.name.localeCompare(b.name));
}
export function getClient(id: string): Client | undefined {
  return getDb().clients.find((c) => c.id === id);
}
export function getClientByEmail(techId: string, email: string): Client | undefined {
  const e = email.toLowerCase().trim();
  return getDb().clients.find(
    (c) => c.techId === techId && c.email.toLowerCase() === e,
  );
}
export function createClient(
  c: Omit<Client, "id" | "createdAt" | "noShowCount" | "isBlacklisted" | "warningNote"> &
    Partial<Pick<Client, "noShowCount" | "isBlacklisted" | "warningNote">>,
): Client {
  const row: Client = {
    noShowCount: 0,
    isBlacklisted: false,
    warningNote: "",
    ...c,
    id: randomId("cli"),
    createdAt: new Date().toISOString(),
  };
  getDb().clients.push(row);
  save();
  return row;
}
export function updateClient(id: string, patch: Partial<Client>): void {
  const row = getClient(id);
  if (row) {
    Object.assign(row, patch);
    save();
  }
}
export function findOrCreateClient(
  techId: string,
  data: { name: string; email: string; phone: string },
): Client {
  const existing = getClientByEmail(techId, data.email);
  if (existing) {
    // keep latest contact details
    existing.name = data.name || existing.name;
    existing.phone = data.phone || existing.phone;
    save();
    return existing;
  }
  return createClient({ techId, notes: "", ...data });
}

// ---------------- Bookings ----------------
export function listBookings(techId: string): Booking[] {
  return getDb()
    .bookings.filter((b) => b.techId === techId)
    .sort((a, b) => a.startIso.localeCompare(b.startIso));
}
export function getBooking(id: string): Booking | undefined {
  return getDb().bookings.find((b) => b.id === id);
}
export function getBookingByToken(token: string): Booking | undefined {
  return getDb().bookings.find((b) => b.balanceToken === token);
}
export function bookingsForClient(techId: string, clientId: string): Booking[] {
  return listBookings(techId).filter((b) => b.clientId === clientId);
}
export function createBooking(b: Omit<Booking, "id" | "createdAt">): Booking {
  const row: Booking = {
    ...b,
    id: randomId("bk"),
    createdAt: new Date().toISOString(),
  };
  getDb().bookings.push(row);
  save();
  return row;
}
export function updateBooking(id: string, patch: Partial<Booking>): void {
  const row = getBooking(id);
  if (row) {
    Object.assign(row, patch);
    save();
  }
}

// ---------------- Payments ----------------
export function listPayments(techId: string): Payment[] {
  return getDb()
    .payments.filter((p) => p.techId === techId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
export function paymentsForBooking(bookingId: string): Payment[] {
  return getDb().payments.filter((p) => p.bookingId === bookingId);
}
export function createPayment(p: Omit<Payment, "id" | "createdAt">): Payment {
  const row: Payment = {
    ...p,
    id: randomId("pay"),
    createdAt: new Date().toISOString(),
  };
  getDb().payments.push(row);
  save();
  return row;
}

// ---------------- Patch tests ----------------
export function listPatchTests(techId: string): PatchTest[] {
  return getDb()
    .patchTests.filter((p) => p.techId === techId)
    .sort((a, b) => b.performedAtIso.localeCompare(a.performedAtIso));
}
export function patchTestsForClient(techId: string, clientId: string): PatchTest[] {
  return listPatchTests(techId).filter((p) => p.clientId === clientId);
}
export function createPatchTest(p: Omit<PatchTest, "id" | "createdAt">): PatchTest {
  const row: PatchTest = {
    ...p,
    id: randomId("pt"),
    createdAt: new Date().toISOString(),
  };
  getDb().patchTests.push(row);
  save();
  return row;
}

// ---------------- Reminders ----------------
export function listReminders(techId: string): Reminder[] {
  return getDb()
    .reminders.filter((r) => r.techId === techId)
    .sort((a, b) => a.sendAtIso.localeCompare(b.sendAtIso));
}
export function remindersForBooking(bookingId: string): Reminder[] {
  return getDb().reminders.filter((r) => r.bookingId === bookingId);
}
export function createReminder(r: Omit<Reminder, "id" | "createdAt">): Reminder {
  const row: Reminder = {
    ...r,
    id: randomId("rem"),
    createdAt: new Date().toISOString(),
  };
  getDb().reminders.push(row);
  save();
  return row;
}
export function dueReminders(nowMs: number): Reminder[] {
  return getDb().reminders.filter(
    (r) => r.status === "scheduled" && new Date(r.sendAtIso).getTime() <= nowMs,
  );
}
export function markReminder(id: string, patch: Partial<Reminder>): void {
  const row = getDb().reminders.find((r) => r.id === id);
  if (row) {
    Object.assign(row, patch);
    save();
  }
}

// ---------------- Sessions ----------------
export function createSession(techId: string, token: string): Session {
  const now = Date.now();
  const row: Session = {
    token,
    techId,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString(),
  };
  getDb().sessions.push(row);
  save();
  return row;
}
export function getSession(token: string): Session | undefined {
  const row = getDb().sessions.find((s) => s.token === token);
  if (!row) return undefined;
  if (new Date(row.expiresAt).getTime() < Date.now()) return undefined;
  return row;
}
export function deleteSession(token: string): void {
  const db = getDb();
  db.sessions = db.sessions.filter((s) => s.token !== token);
  save();
}
