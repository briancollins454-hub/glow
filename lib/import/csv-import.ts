import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { BookingStatus, Tech } from "@/lib/db/types";
import {
  createAuditEvent,
  createCategory,
  createService,
  findOrCreateClient,
  listBookings,
  listCategories,
  listServices,
} from "@/lib/db/queries";
import { importResultUrl } from "@/lib/import/import-url";

export type CsvImportScope = {
  sb: SupabaseClient;
  tech: Tech;
  /** Page to redirect back to (may already include ?tech=...). */
  returnTo: string;
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

function go(scope: CsvImportScope, params: Record<string, string | number>) {
  redirect(importResultUrl(scope.returnTo, params));
}

function csvFileName(formData: FormData): string {
  const file = formData.get("csv");
  if (file && typeof file === "object" && "name" in file) {
    return String((file as File).name || "upload.csv");
  }
  return "upload.csv";
}

export async function importClientsForTech(
  formData: FormData,
  scope: CsvImportScope,
): Promise<void> {
  const file = formData.get("csv") as File | null;
  if (!file || file.size === 0) go(scope, { import: "empty" });

  const { parseCsv, col, normalizeImportPhone } = await import("@/lib/csv");
  const { headers, rows } = parseCsv(await file!.text());
  if (rows.length === 0) go(scope, { import: "empty" });

  const iFirst = col(headers, "firstname", "first");
  const iLast = col(headers, "lastname", "last", "surname");
  const iName = col(headers, "name", "fullname", "clientname", "customername");
  const iEmail = col(headers, "email", "emailaddress", "customeremail");
  const iPhone = col(headers, "phone", "phonenumber", "mobile", "mobilenumber", "telephone", "cellphone");
  const iNotes = col(headers, "notes", "note", "comments");

  if (iName === -1 && iFirst === -1) go(scope, { import: "badformat" });

  const { createClient: createClientRow, getClientByEmail: findByEmail } = await import(
    "@/lib/db/queries",
  );
  let imported = 0;
  let skipped = 0;

  for (const cols of rows) {
    const name =
      iName !== -1
        ? cols[iName]
        : [cols[iFirst], iLast !== -1 ? cols[iLast] : ""].filter(Boolean).join(" ");
    if (!name) {
      skipped++;
      continue;
    }
    const email = iEmail !== -1 ? (cols[iEmail] ?? "") : "";
    const phone = iPhone !== -1 ? normalizeImportPhone(cols[iPhone] ?? "") : "";
    const notes = iNotes !== -1 ? (cols[iNotes] ?? "") : "";

    if (email) {
      const existing = await findByEmail(scope.sb, scope.tech.id, email);
      if (existing) {
        skipped++;
        continue;
      }
    }
    await createClientRow(scope.sb, {
      techId: scope.tech.id,
      name,
      email,
      phone,
      notes,
    });
    imported++;
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
  const file = formData.get("csv") as File | null;
  if (!file || file.size === 0) go(scope, { import: "empty" });

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
  const { headers, rows: allRows } = parseCsv(await file!.text());
  if (allRows.length === 0) go(scope, { import: "empty" });

  const iName = col(headers, ...IMPORT_SERVICE_COLS.name);
  const iPrice = col(headers, ...IMPORT_SERVICE_COLS.price);
  const iDuration = col(headers, ...IMPORT_SERVICE_COLS.duration);
  const iCategory = col(headers, ...IMPORT_SERVICE_COLS.category);
  const iDesc = col(headers, ...IMPORT_SERVICE_COLS.description);

  const existing = await listServices(scope.sb, scope.tech.id);
  const existingNames = new Set(existing.map((s) => s.name.toLowerCase()));
  const cats = await listCategories(scope.sb, scope.tech.id);
  const catIdByName = new Map(cats.map((c) => [c.name.toLowerCase(), c.id]));

  const ensureCategory = async (rawName: string): Promise<string> => {
    const name = rawName.trim() || "Imported";
    const key = name.toLowerCase();
    if (catIdByName.has(key)) return catIdByName.get(key)!;
    const created = await createCategory(scope.sb, {
      techId: scope.tech.id,
      name,
      patchTestValidityDays: 180,
      patchTestMinLeadHours: 24,
    });
    catIdByName.set(key, created.id);
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
      const categoryId = await ensureCategory("");
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
    const categoryId = await ensureCategory(iCategory !== -1 ? cols[iCategory] ?? "" : "");

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
  const file = formData.get("csv") as File | null;
  if (!file || file.size === 0) go(scope, { import: "empty" });

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
  const { headers, rows: allRows } = parseCsv(await file!.text());
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
  const existingBookings = await listBookings(scope.sb, scope.tech.id);
  const { createBooking: createBookingRow } = await import("@/lib/db/queries");
  const { rescheduleReminders } = await import("@/lib/bookings");
  const { randomToken: newToken } = await import("@/lib/ids");

  let imported = 0;
  let skipped = 0;

  for (const cols of rows) {
    const clientName = appointmentClientName(cols, headers);
    const serviceName = normalizeImportName(cols[iService] ?? "");
    const { dateRaw, timeRaw } = appointmentWhenRaw(cols, headers);
    const timeZone = iTimezone !== -1 ? (cols[iTimezone] ?? "").trim() : "";
    const when = parseAppointmentWhen(dateRaw, timeRaw, { timeZone });
    const service = serviceByName.get(serviceName);
    if (!clientName || !service || !when) {
      skipped++;
      continue;
    }

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

    const client = await findOrCreateClient(scope.sb, scope.tech.id, {
      name: clientName,
      email: iEmail !== -1 ? (cols[iEmail] ?? "").trim() : "",
      phone: iPhone !== -1 ? normalizeImportPhone(cols[iPhone] ?? "") : "",
    });

    const startMs = when.getTime();
    if (
      existingBookings.some(
        (b) => b.clientId === client.id && new Date(b.startIso).getTime() === startMs,
      )
    ) {
      skipped++;
      continue;
    }

    const isPast = startMs < Date.now();
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

    const booking = await createBookingRow(scope.sb, {
      techId: scope.tech.id,
      clientId: client.id,
      serviceId: service.id,
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
    if (!isPast && status === "confirmed") await rescheduleReminders(scope.sb, booking);
    existingBookings.push(booking);
    imported++;
  }

  await auditImport(scope, "appointments_imported", "appointments", {
    imported,
    skipped,
    rows: rows.length,
    excludedCalendars,
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
  if (imported === 0 && skipped > 0) {
    go(scope, { import: "none", what: "appointments", n: 0, s: skipped });
  }
  go(scope, { import: "done", what: "appointments", n: imported, s: skipped });
}
