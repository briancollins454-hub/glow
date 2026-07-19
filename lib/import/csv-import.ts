import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Booking, BookingStatus, Client, Tech } from "@/lib/db/types";
import {
  createAuditEvent,
  createCategory,
  createClient,
  createClientsBatch,
  createBookingsBatch,
  createService,
  createStaff,
  listBookings,
  listCategories,
  listClients,
  listServices,
  listStaff,
  updateBooking,
} from "@/lib/db/queries";

const ACTIVE_SLOT_STATUSES = new Set<BookingStatus>([
  "pending_approval",
  "pending",
  "confirmed",
  "completed",
]);
import { importResultUrl } from "@/lib/import/import-url";
import {
  ACUITY_NO_CALENDAR,
  acuityRowCalendarName,
  findStaffForCalendarName,
  normalizeStaffMatchName,
} from "@/lib/import/staff-map";

/** In-memory client lookup for bulk appointment imports (avoids per-row table scans). */
function buildClientIndexes(clients: Client[]) {
  const byEmail = new Map<string, Client>();
  const byPhone = new Map<string, Client>();
  const byName = new Map<string, Client>();
  for (const c of clients) {
    const email = c.email.trim().toLowerCase();
    if (email) byEmail.set(email, c);
    const digits = c.phone.replace(/\D/g, "");
    if (digits.length >= 7) byPhone.set(digits, c);
    const name = c.name.trim().toLowerCase();
    if (name) byName.set(name, c);
  }
  return { byEmail, byPhone, byName };
}

async function resolveImportClient(
  sb: SupabaseClient,
  techId: string,
  indexes: ReturnType<typeof buildClientIndexes>,
  data: { name: string; email: string; phone: string },
): Promise<Client> {
  const email = data.email.trim().toLowerCase();
  const digits = data.phone.replace(/\D/g, "");
  const nameKey = data.name.trim().toLowerCase();

  let existing =
    (email ? indexes.byEmail.get(email) : undefined) ??
    (digits.length >= 7 ? indexes.byPhone.get(digits) : undefined) ??
    (nameKey ? indexes.byName.get(nameKey) : undefined) ??
    null;

  if (existing) return existing;

  const created = await createClient(sb, {
    techId,
    name: data.name,
    email: data.email,
    phone: data.phone,
    notes: "",
  });
  if (email) indexes.byEmail.set(email, created);
  if (digits.length >= 7) indexes.byPhone.set(digits, created);
  if (nameKey) indexes.byName.set(nameKey, created);
  return created;
}

export type CsvImportScope = {
  sb: SupabaseClient;
  tech: Tech;
  /** Page to redirect back to (may already include ?tech=...). */
  returnTo: string;
  /**
   * Tech id that owns staged CSV paths under tmp-imports/{id}/.
   * Defaults to tech.id; support import passes the admin's id.
   */
  importActorTechId?: string;
  /** Merged into the standard import audit on the target tech. */
  auditExtra?: Record<string, unknown>;
  /**
   * Extra audit written after a successful import (e.g. support import on the
   * admin account). Failures here must not block the import.
   */
  onSupportAudit?: (info: {
    action: string;
    fileName: string;
    imported: number;
    skipped: number;
    rows: number;
    excludedCalendars?: number;
    source?: string;
  }) => Promise<void>;
};

async function auditImport(
  scope: CsvImportScope,
  action: string,
  entityId: string,
  metadata: Record<string, unknown>,
) {
  try {
    await createAuditEvent(scope.sb, {
      techId: scope.tech.id,
      actor: "tech",
      action,
      entityType: "import",
      entityId,
      metadata: { ...metadata, ...scope.auditExtra },
    });
  } catch {
    // Audit logging must never block the primary workflow.
  }
}

function go(
  scope: CsvImportScope,
  params: Record<string, string | number | undefined | null>,
) {
  redirect(importResultUrl(scope.returnTo, params));
}

function csvFileName(formData: FormData, fallback = "upload.csv"): string {
  const staged = String(formData.get("csvFileName") ?? "").trim();
  if (staged) return staged;
  const file = formData.get("csv");
  if (file && typeof file === "object" && "name" in file) {
    return String((file as File).name || fallback);
  }
  return fallback;
}

async function loadCsv(formData: FormData, scope: CsvImportScope) {
  const { readCsvFromFormData } = await import("@/lib/import/csv-source");
  const ownerId = scope.importActorTechId ?? scope.tech.id;
  return readCsvFromFormData(formData, ownerId);
}

export async function importClientsForTech(
  formData: FormData,
  scope: CsvImportScope,
): Promise<void> {
  const loaded = await loadCsv(formData, scope);
  if (!loaded) go(scope, { import: "empty" });

  const { parseCsv, col, normalizeImportPhone } = await import("@/lib/csv");
  const { headers, rows } = parseCsv(loaded!.text);
  if (rows.length === 0) go(scope, { import: "empty" });

  const iFirst = col(headers, "firstname", "first");
  const iLast = col(headers, "lastname", "last", "surname");
  const iName = col(headers, "name", "fullname", "clientname", "customername");
  const iEmail = col(headers, "email", "emailaddress", "customeremail");
  const iPhone = col(headers, "phone", "phonenumber", "mobile", "mobilenumber", "telephone", "cellphone");
  const iNotes = col(headers, "notes", "note", "comments");

  if (iName === -1 && iFirst === -1) go(scope, { import: "badformat" });

  // Preload ALL existing clients (paged — PostgREST defaults to 1000/page).
  const existingClients = await listClients(scope.sb, scope.tech.id);
  const indexes = buildClientIndexes(existingClients);
  const seenEmails = new Set(indexes.byEmail.keys());
  const seenPhones = new Set(indexes.byPhone.keys());
  const seenNames = new Set(indexes.byName.keys());

  type Pending = { techId: string; name: string; email: string; phone: string; notes: string };
  const pending: Pending[] = [];
  let skipped = 0;

  for (const cols of rows) {
    const name = (
      iName !== -1
        ? cols[iName]
        : [cols[iFirst], iLast !== -1 ? cols[iLast] : ""].filter(Boolean).join(" ")
    ).trim();
    if (!name) {
      skipped++;
      continue;
    }
    const email = (iEmail !== -1 ? (cols[iEmail] ?? "") : "").trim();
    const phone = iPhone !== -1 ? normalizeImportPhone(cols[iPhone] ?? "") : "";
    const notes = iNotes !== -1 ? (cols[iNotes] ?? "") : "";
    const emailKey = email.toLowerCase();
    const phoneKey = phone.replace(/\D/g, "");
    const nameKey = name.toLowerCase();

    // Dedupe against existing clients and earlier rows in this same file
    // (appointments CSVs often repeat the same person many times).
    if (emailKey && seenEmails.has(emailKey)) {
      skipped++;
      continue;
    }
    if (!emailKey && phoneKey.length >= 7 && seenPhones.has(phoneKey)) {
      skipped++;
      continue;
    }
    if (!emailKey && phoneKey.length < 7 && nameKey && seenNames.has(nameKey)) {
      skipped++;
      continue;
    }

    pending.push({ techId: scope.tech.id, name, email, phone, notes });
    // Reserve keys so later rows in this file don't queue duplicates.
    if (emailKey) seenEmails.add(emailKey);
    if (phoneKey.length >= 7) seenPhones.add(phoneKey);
    if (nameKey) seenNames.add(nameKey);
  }

  const BATCH = 100;
  let imported = 0;
  for (let i = 0; i < pending.length; i += BATCH) {
    const chunk = pending.slice(i, i + BATCH);
    const created = await createClientsBatch(scope.sb, chunk);
    imported += created.length;
    skipped += chunk.length - created.length;
  }

  await auditImport(scope, "clients_imported", "clients", {
    imported,
    skipped,
    rows: rows.length,
  });
  if (scope.onSupportAudit) {
    await scope.onSupportAudit({
      action: "support_clients_imported",
      fileName: csvFileName(formData),
      imported,
      skipped,
      rows: rows.length,
    });
  }
  revalidatePath("/dashboard/clients");
  go(scope, { import: "done", what: "clients", n: imported, s: skipped });
}

export async function importServicesForTech(
  formData: FormData,
  scope: CsvImportScope,
): Promise<void> {
  const loaded = await loadCsv(formData, scope);
  if (!loaded) go(scope, { import: "empty" });

  const {
    parseCsv,
    col,
    moneyToPennies,
    toMinutes,
    safeMinutes,
    IMPORT_SERVICE_COLS,
    isPlausibleServiceName,
    isAcuityAppointmentCsv,
    acuityDerivedServices,
    resolveAcuityImportRows,
  } = await import("@/lib/csv");
  const { headers, rows: allRows } = parseCsv(loaded!.text);
  if (allRows.length === 0) go(scope, { import: "empty" });

  const iName = col(headers, ...IMPORT_SERVICE_COLS.name);
  const iPrice = col(headers, ...IMPORT_SERVICE_COLS.price);
  const iDuration = col(headers, ...IMPORT_SERVICE_COLS.duration);
  const iCategory = col(headers, ...IMPORT_SERVICE_COLS.category);
  const iDesc = col(headers, ...IMPORT_SERVICE_COLS.description);

  const existing = await listServices(scope.sb, scope.tech.id);
  const existingNames = new Set(existing.map((s) => s.name.toLowerCase()));
  const cats = await listCategories(scope.sb, scope.tech.id);
  const { inferServiceCategory, categoryLookupKeys } = await import(
    "@/lib/import/service-categories"
  );
  const catIdByName = new Map<string, string>();
  for (const c of cats) {
    for (const key of categoryLookupKeys(c.name)) {
      catIdByName.set(key, c.id);
    }
  }

  const ensureCategory = async (rawName: string): Promise<string> => {
    const name = rawName.trim() || "Imported";
    for (const key of categoryLookupKeys(name)) {
      if (catIdByName.has(key)) return catIdByName.get(key)!;
    }
    const created = await createCategory(scope.sb, {
      techId: scope.tech.id,
      name,
      patchTestValidityDays: 180,
      patchTestMinLeadHours: 24,
    });
    for (const key of categoryLookupKeys(created.name)) {
      catIdByName.set(key, created.id);
    }
    return created.id;
  };

  let imported = 0;
  let skipped = 0;
  let sortOrder = existing.length;
  const { tech } = scope;

  if (iName === -1 && isAcuityAppointmentCsv(headers)) {
    const selected = formData.getAll("acuityCalendar").map(String);
    const resolved = resolveAcuityImportRows(headers, allRows, selected);
    if (resolved.needsCalendarPick) go(scope, { import: "nocalendar" });
    const rows = resolved.rows;
    const derived = acuityDerivedServices(headers, rows);
    if (derived.length === 0) go(scope, { import: "badformat" });
    for (const { name, pricePennies } of derived) {
      if (existingNames.has(name.toLowerCase())) {
        skipped++;
        continue;
      }
      const categoryId = await ensureCategory(inferServiceCategory(name));
      await createService(scope.sb, {
        techId: tech.id,
        categoryId,
        name,
        description: "",
        durationMin: 60,
        pricePennies,
        depositType: tech.defaultDepositType ?? "percent",
        depositValue:
          tech.defaultDepositType === "fixed"
            ? tech.defaultDepositValue ?? 0
            : tech.defaultDepositType === "none"
              ? 0
              : tech.defaultDepositValue ?? tech.defaultDepositPct,
        requiresPatchTest: false,
        isPatchTestService: false,
        isInfill: false,
        fullSetServiceId: null,
        infillMaxGapDays: 21,
        active: true,
        sortOrder: sortOrder++,
      });
      existingNames.add(name.toLowerCase());
      imported++;
    }
    await auditImport(scope, "services_imported", "services", {
      imported,
      skipped,
      rows: rows.length,
      excludedCalendars: resolved.excludedCount,
      source: "acuity_appointments",
    });
    if (scope.onSupportAudit) {
      await scope.onSupportAudit({
        action: "support_services_imported",
        fileName: csvFileName(formData),
        imported,
        skipped,
        rows: rows.length,
        excludedCalendars: resolved.excludedCount,
        source: "acuity_appointments",
      });
    }
    revalidatePath("/dashboard/services");
    go(scope, { import: "done", what: "services", n: imported, s: skipped });
  }

  const rows = allRows;
  if (iName === -1) go(scope, { import: "badformat" });

  for (const cols of rows) {
    const name = (cols[iName] ?? "").trim();
    if (!name || !isPlausibleServiceName(name) || existingNames.has(name.toLowerCase())) {
      skipped++;
      continue;
    }
    const pricePennies = iPrice !== -1 ? moneyToPennies(cols[iPrice] ?? "") : 0;
    const durationMin = safeMinutes(iDuration !== -1 ? toMinutes(cols[iDuration] ?? "") : 60);
    const rawCategory = iCategory !== -1 ? (cols[iCategory] ?? "").trim() : "";
    const categoryId = await ensureCategory(rawCategory || inferServiceCategory(name));

    await createService(scope.sb, {
      techId: tech.id,
      categoryId,
      name,
      description: iDesc !== -1 ? (cols[iDesc] ?? "") : "",
      durationMin: durationMin || 60,
      pricePennies,
      depositType: tech.defaultDepositType ?? "percent",
      depositValue:
        tech.defaultDepositType === "fixed"
          ? tech.defaultDepositValue ?? 0
          : tech.defaultDepositType === "none"
            ? 0
            : tech.defaultDepositValue ?? tech.defaultDepositPct,
      requiresPatchTest: false,
      isPatchTestService: false,
      isInfill: false,
      fullSetServiceId: null,
      infillMaxGapDays: 21,
      active: true,
      sortOrder: sortOrder++,
    });
    existingNames.add(name.toLowerCase());
    imported++;
  }

  await auditImport(scope, "services_imported", "services", {
    imported,
    skipped,
    rows: rows.length,
  });
  if (scope.onSupportAudit) {
    await scope.onSupportAudit({
      action: "support_services_imported",
      fileName: csvFileName(formData),
      imported,
      skipped,
      rows: rows.length,
    });
  }
  revalidatePath("/dashboard/services");
  go(scope, { import: "done", what: "services", n: imported, s: skipped });
}

export async function importBookingsForTech(
  formData: FormData,
  scope: CsvImportScope,
): Promise<void> {
  const loaded = await loadCsv(formData, scope);
  if (!loaded) go(scope, { import: "empty" });

  const {
    parseCsv,
    col,
    appointmentWhenRaw,
    appointmentClientName,
    appointmentServiceCol,
    IMPORT_COLS,
    moneyToPennies,
    safePennies,
    safeMinutes,
    toMinutes,
    parseAppointmentWhen,
    normalizeImportName,
    normalizeImportPhone,
    resolveAcuityImportRows,
    isAcuityAppointmentCsv,
    MAX_MINUTES,
  } = await import("@/lib/csv");
  const { headers, rows: allRows } = parseCsv(loaded!.text);
  if (allRows.length === 0) go(scope, { import: "empty" });

  const iClient = col(headers, ...IMPORT_COLS.appointmentClient);
  const iFirstName = col(headers, "firstname", "first");
  const iEmail = col(headers, ...IMPORT_COLS.appointmentEmail);
  const iPhone = col(headers, "phone", "phonenumber", "mobile", "mobilenumber", "telephone");
  const iService = appointmentServiceCol(headers);
  const iStatus = col(headers, ...IMPORT_COLS.appointmentStatus);
  const iCancelled = col(headers, "canceled", "cancelled");
  const iPrice = col(headers, ...IMPORT_COLS.appointmentPrice);
  const iDuration = col(headers, ...IMPORT_COLS.appointmentDuration);
  const iEndTime = col(headers, "endtime", "end");
  const iTimezone = col(headers, "timezone", "tz");

  if ((iClient === -1 && iFirstName === -1) || iService === -1) {
    go(scope, { import: "badformat" });
  }
  const hasDate =
    col(headers, ...IMPORT_COLS.appointmentDate) !== -1 ||
    col(headers, ...IMPORT_COLS.appointmentTime) !== -1;
  if (!hasDate) go(scope, { import: "badformat" });

  let rows = allRows;
  let excludedCalendars = 0;
  if (isAcuityAppointmentCsv(headers)) {
    const selected = formData.getAll("acuityCalendar").map(String);
    const resolved = resolveAcuityImportRows(headers, allRows, selected);
    if (resolved.needsCalendarPick) go(scope, { import: "nocalendar" });
    rows = resolved.rows;
    excludedCalendars = resolved.excludedCount;
  }

  const services = await listServices(scope.sb, scope.tech.id);
  const serviceByName = new Map(services.map((s) => [normalizeImportName(s.name), s]));
  const [existingBookings, existingClients] = await Promise.all([
    listBookings(scope.sb, scope.tech.id),
    listClients(scope.sb, scope.tech.id),
  ]);
  const clientIndexes = buildClientIndexes(existingClients);
  // Fast duplicate / slot checks — O(1) instead of scanning every booking per row.
  const bookingSlotKeys = new Set<string>();
  const staffSlotKeys = new Set<string>();
  const orphanByClientSlot = new Map<string, Booking>();
  for (const b of existingBookings) {
    const startMs = new Date(b.startIso).getTime();
    bookingSlotKeys.add(`${b.clientId}|${startMs}|${b.staffId ?? ""}`);
    if (b.staffId && ACTIVE_SLOT_STATUSES.has(b.status)) {
      staffSlotKeys.add(`${b.staffId}|${startMs}`);
    }
    if (!b.staffId) orphanByClientSlot.set(`${b.clientId}|${startMs}`, b);
  }

  const { randomToken: newToken } = await import("@/lib/ids");
  const { getOrCreateOwnerStaff } = await import("@/lib/booking/staff");

  const iCalendar = col(headers, "calendar");
  const ownerStaff = await getOrCreateOwnerStaff(scope.sb, scope.tech);
  let staffList = await listStaff(scope.sb, scope.tech.id);
  const staffIdByCalendar = new Map<string, string>();
  staffIdByCalendar.set(ACUITY_NO_CALENDAR, ownerStaff.id);
  staffIdByCalendar.set("", ownerStaff.id);

  if (iCalendar !== -1) {
    const calendarNames = new Set<string>();
    for (const row of rows) calendarNames.add(acuityRowCalendarName(row, iCalendar));
    let sortOrder = staffList.length;
    for (const calName of calendarNames) {
      if (!calName || calName === ACUITY_NO_CALENDAR) {
        staffIdByCalendar.set(calName || ACUITY_NO_CALENDAR, ownerStaff.id);
        continue;
      }
      let match = findStaffForCalendarName(calName, staffList);
      if (!match) {
        match = await createStaff(scope.sb, {
          techId: scope.tech.id,
          authUserId: null,
          name: calName.trim(),
          email: "",
          role: "staff",
          photoPath: null,
          bio: "",
          active: true,
          sortOrder: sortOrder++,
        });
        staffList = [...staffList, match];
      }
      staffIdByCalendar.set(calName, match.id);
      staffIdByCalendar.set(normalizeStaffMatchName(calName), match.id);
    }
  }

  let imported = 0;
  let skipped = 0;
  let skipNoService = 0;
  let skipBadDate = 0;
  let skipNoClient = 0;
  let skipDuplicate = 0;
  let staffLinked = 0;
  const nowMs = Date.now();

  type PendingBooking = Parameters<typeof createBookingsBatch>[1][number];
  const pendingBookings: PendingBooking[] = [];
  const queuedExact = new Set<string>();
  const queuedStaffSlot = new Set<string>();
  const BATCH = 100;

  const flushBookings = async () => {
    if (pendingBookings.length === 0) return;
    const chunk = pendingBookings.splice(0, pendingBookings.length);
    const created = await createBookingsBatch(scope.sb, chunk);
    imported += created.length;
    skipped += chunk.length - created.length;
    skipDuplicate += chunk.length - created.length;
    for (const row of chunk) {
      const startMs = new Date(row.startIso).getTime();
      queuedExact.delete(`${row.clientId}|${startMs}|${row.staffId ?? ""}`);
      if (row.staffId) queuedStaffSlot.delete(`${row.staffId}|${startMs}`);
    }
    for (const b of created) {
      const startMs = new Date(b.startIso).getTime();
      bookingSlotKeys.add(`${b.clientId}|${startMs}|${b.staffId ?? ""}`);
      if (b.staffId && ACTIVE_SLOT_STATUSES.has(b.status)) {
        staffSlotKeys.add(`${b.staffId}|${startMs}`);
      }
    }
  };

  for (const cols of rows) {
    const clientName = appointmentClientName(cols, headers);
    const serviceName = normalizeImportName(cols[iService] ?? "");
    const { dateRaw, timeRaw } = appointmentWhenRaw(cols, headers);
    const timeZone = iTimezone !== -1 ? (cols[iTimezone] ?? "").trim() : "";
    const when = parseAppointmentWhen(dateRaw, timeRaw, { timeZone });
    const service = serviceByName.get(serviceName);
    if (!clientName || !service || !when) {
      skipped++;
      if (!clientName) skipNoClient++;
      else if (!service) skipNoService++;
      else skipBadDate++;
      continue;
    }

    const calName = iCalendar !== -1 ? acuityRowCalendarName(cols, iCalendar) : "";
    const staffId =
      iCalendar === -1
        ? ownerStaff.id
        : (staffIdByCalendar.get(calName) ??
          staffIdByCalendar.get(normalizeStaffMatchName(calName)) ??
          ownerStaff.id);

    const rowPrice =
      iPrice !== -1 ? moneyToPennies(cols[iPrice] ?? "") : safePennies(service.pricePennies);
    const pricePennies = rowPrice > 0 ? rowPrice : safePennies(service.pricePennies);

    let endDurationMin = 0;
    if (iEndTime !== -1) {
      const endRaw = (cols[iEndTime] ?? "").trim();
      if (endRaw) {
        const end =
          parseAppointmentWhen(endRaw, "", { timeZone }) ??
          parseAppointmentWhen(dateRaw, endRaw, { timeZone });
        if (end) {
          const diff = Math.round((end.getTime() - when.getTime()) / 60000);
          if (diff > 0 && diff <= MAX_MINUTES) endDurationMin = diff;
        }
      }
    }
    const durationMin =
      iDuration !== -1
        ? safeMinutes(toMinutes(cols[iDuration] ?? ""), service.durationMin)
        : endDurationMin > 0
          ? endDurationMin
          : safeMinutes(service.durationMin);

    let client: Client;
    try {
      client = await resolveImportClient(scope.sb, scope.tech.id, clientIndexes, {
        name: clientName,
        email: iEmail !== -1 ? (cols[iEmail] ?? "").trim() : "",
        phone: iPhone !== -1 ? normalizeImportPhone(cols[iPhone] ?? "") : "",
      });
    } catch {
      skipped++;
      skipNoClient++;
      continue;
    }

    const startMs = when.getTime();
    const clientSlotKey = `${client.id}|${startMs}`;
    const exactKey = `${clientSlotKey}|${staffId}`;
    if (bookingSlotKeys.has(exactKey) || queuedExact.has(exactKey)) {
      skipped++;
      skipDuplicate++;
      continue;
    }
    const orphan = orphanByClientSlot.get(clientSlotKey);
    if (orphan) {
      // Earlier imports left staffId null — attach to the Acuity Calendar's staff.
      try {
        await updateBooking(scope.sb, orphan.id, { staffId });
        orphan.staffId = staffId;
        bookingSlotKeys.add(exactKey);
        bookingSlotKeys.delete(`${clientSlotKey}|`);
        orphanByClientSlot.delete(clientSlotKey);
        if (ACTIVE_SLOT_STATUSES.has(orphan.status)) {
          staffSlotKeys.add(`${staffId}|${startMs}`);
        }
        staffLinked++;
      } catch {
        skipped++;
        skipDuplicate++;
      }
      continue;
    }

    const isPast = startMs < nowMs;
    const rawStatus = iStatus !== -1 ? (cols[iStatus] ?? "").toLowerCase() : "";
    const rawCancelled = iCancelled !== -1 ? (cols[iCancelled] ?? "").trim().toLowerCase() : "";
    const cancelledFlag = ["yes", "true", "1", "canceled", "cancelled"].includes(rawCancelled);
    const status: BookingStatus =
      cancelledFlag || rawStatus.includes("cancel")
        ? "cancelled"
        : rawStatus.includes("no") && rawStatus.includes("show")
          ? "no_show"
          : isPast
            ? "completed"
            : "confirmed";

    const staffSlotKey = `${staffId}|${startMs}`;
    if (
      ACTIVE_SLOT_STATUSES.has(status) &&
      (staffSlotKeys.has(staffSlotKey) || queuedStaffSlot.has(staffSlotKey))
    ) {
      skipped++;
      skipDuplicate++;
      continue;
    }

    pendingBookings.push({
      techId: scope.tech.id,
      clientId: client.id,
      serviceId: service.id,
      staffId,
      startIso: when.toISOString(),
      endIso: new Date(startMs + durationMin * 60 * 1000).toISOString(),
      status,
      pricePennies,
      depositPennies: 0,
      depositStatus: "none",
      balancePennies: isPast ? 0 : pricePennies,
      balanceStatus: isPast ? "paid" : "unpaid",
      balanceToken: newToken(),
      pairedBookingId: null,
      riskTier: null,
      autoApproved: false,
      isPatchTest: false,
      notes: "Imported",
      lashMap: "",
      lashCurl: "",
      lashLength: "",
      addons: [],
      discountPennies: 0,
    });
    queuedExact.add(exactKey);
    if (ACTIVE_SLOT_STATUSES.has(status)) queuedStaffSlot.add(staffSlotKey);

    if (pendingBookings.length >= BATCH) await flushBookings();
  }

  await flushBookings();

  await auditImport(scope, "appointments_imported", "appointments", {
    imported,
    skipped,
    rows: rows.length,
    excludedCalendars,
    skipNoService,
    skipBadDate,
    skipNoClient,
    skipDuplicate,
    staffLinked,
  });
  if (scope.onSupportAudit) {
    await scope.onSupportAudit({
      action: "support_appointments_imported",
      fileName: csvFileName(formData),
      imported,
      skipped,
      rows: rows.length,
      excludedCalendars,
    });
  }
  revalidatePath("/dashboard/bookings");
  revalidatePath("/dashboard/team");
  if (imported === 0 && skipped > 0) {
    go(scope, {
      import: "none",
      what: "appointments",
      n: 0,
      s: skipped,
      skipServices: skipNoService || undefined,
      skipDupes: skipDuplicate || undefined,
    });
  }
  go(scope, {
    import: "done",
    what: "appointments",
    n: imported,
    s: skipped,
    skipServices: skipNoService || undefined,
    skipDupes: skipDuplicate || undefined,
  });
}
