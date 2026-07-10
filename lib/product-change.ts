import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createAuditEvent,
  createProductChangeEvent,
  createProductChangeRetest,
  createReminder,
  getClient,
  listBookings,
  listCategories,
  listProductChangeRetests,
  listServices,
  patchTestsForClient,
  updatePatchTest,
  updateProductChangeRetest,
} from "@/lib/db/queries";
import { notifyClientOfPatchTestRetest } from "@/lib/notify";
import { randomId } from "@/lib/utils";
import type {
  Booking,
  PatchRetestStatus,
  PatchTest,
  ProductChangeRetest,
  Service,
  ServiceCategory,
  Tech,
} from "@/lib/db/types";

const UPCOMING_STATUSES: Booking["status"][] = ["pending_approval", "pending", "confirmed"];

export type ProductChangeInput = {
  categoryIds: string[];
  serviceIds: string[];
  note?: string;
  /** Optional new batch opened with this product change. */
  newBatch?: {
    productId: string;
    lotNumber?: string;
    openedAtIso?: string;
    expiresAtIso?: string;
  };
};

export type ProductChangeResult = {
  eventId: string;
  invalidatedCount: number;
  clientsNotified: number;
  affectedClients: number;
};

function isValidTest(test: PatchTest, atMs = Date.now()): boolean {
  return test.result === "pass" && new Date(test.expiresAtIso).getTime() > atMs && !test.invalidatedAtIso;
}

function resolveCategoryIds(
  categories: ServiceCategory[],
  services: Service[],
  input: ProductChangeInput,
): string[] {
  const fromCategories = input.categoryIds.filter((id) => categories.some((c) => c.id === id));
  const fromServices = input.serviceIds
    .map((sid) => services.find((s) => s.id === sid)?.categoryId)
    .filter((id): id is string => !!id);
  return [...new Set([...fromCategories, ...fromServices])];
}

function scopeSummary(
  categories: ServiceCategory[],
  services: Service[],
  categoryIds: string[],
  serviceIds: string[],
): string {
  if (serviceIds.length > 0) {
    const names = serviceIds
      .map((id) => services.find((s) => s.id === id)?.name)
      .filter(Boolean) as string[];
    if (names.length) return names.join(", ");
  }
  return categoryIds
    .map((id) => categories.find((c) => c.id === id)?.name)
    .filter(Boolean)
    .join(", ");
}

function futureBookingForCategory(
  bookings: Booking[],
  services: Service[],
  clientId: string,
  categoryId: string,
  nowMs: number,
): Booking | null {
  const serviceIds = new Set(services.filter((s) => s.categoryId === categoryId).map((s) => s.id));
  return (
    bookings
      .filter(
        (b) =>
          b.clientId === clientId &&
          serviceIds.has(b.serviceId) &&
          UPCOMING_STATUSES.includes(b.status) &&
          new Date(b.startIso).getTime() > nowMs,
      )
      .sort((a, b) => new Date(a.startIso).getTime() - new Date(b.startIso).getTime())[0] ?? null
  );
}

/** Mark open re-test rows as passed when a new pass is recorded. */
export async function resolveRetestsAfterPatchPass(
  sb: SupabaseClient,
  techId: string,
  clientId: string,
  categoryId: string,
): Promise<void> {
  const now = new Date().toISOString();
  const open = (await listProductChangeRetests(sb, techId)).filter(
    (r) => r.clientId === clientId && r.categoryId === categoryId && r.status !== "passed",
  );
  for (const row of open) {
    await updateProductChangeRetest(sb, row.id, {
      status: "passed",
      resolvedAtIso: now,
      updatedAt: now,
    });
  }
}

/** Mark re-test rows as test_booked when a pending patch test is logged. */
export async function markRetestsTestBooked(
  sb: SupabaseClient,
  techId: string,
  clientId: string,
  categoryId: string,
): Promise<void> {
  const now = new Date().toISOString();
  const open = (await listProductChangeRetests(sb, techId)).filter(
    (r) => r.clientId === clientId && r.categoryId === categoryId && r.status === "needs_test",
  );
  for (const row of open) {
    await updateProductChangeRetest(sb, row.id, {
      status: "test_booked",
      updatedAt: now,
    });
  }
}

/**
 * Tech confirms a product change: invalidate valid patch tests, queue re-tests,
 * notify clients (future appointments first).
 */
export async function executeProductChange(
  sb: SupabaseClient,
  tech: Tech,
  input: ProductChangeInput,
): Promise<ProductChangeResult> {
  const [categories, services, bookings] = await Promise.all([
    listCategories(sb, tech.id),
    listServices(sb, tech.id),
    listBookings(sb, tech.id),
  ]);

  const categoryIds = resolveCategoryIds(categories, services, input);
  if (categoryIds.length === 0) {
    throw new Error("Pick at least one category or service.");
  }

  const nowIso = new Date().toISOString();
  const nowMs = Date.now();
  const eventId = randomId("pce");
  const summary = scopeSummary(categories, services, categoryIds, input.serviceIds);

  await createProductChangeEvent(sb, {
    id: eventId,
    techId: tech.id,
    note: input.note?.trim() ?? "",
    scopeSummary: summary,
    newBatchId: null,
    createdAt: nowIso,
  });

  let newBatchId: string | null = null;
  if (input.newBatch?.productId) {
    const { openProductBatch } = await import("@/lib/product-batches");
    const batch = await openProductBatch(sb, tech.id, {
      productId: input.newBatch.productId,
      lotNumber: input.newBatch.lotNumber,
      openedAtIso: input.newBatch.openedAtIso,
      expiresAtIso: input.newBatch.expiresAtIso,
      changeEventId: eventId,
    });
    newBatchId = batch.id;
    await sb.from("product_change_events").update({ newBatchId }).eq("id", eventId);
  }

  for (const categoryId of categoryIds) {
    await sb.from("product_change_event_categories").insert({
      eventId,
      categoryId,
    });
  }
  for (const serviceId of input.serviceIds) {
    await sb.from("product_change_event_services").insert({ eventId, serviceId });
  }

  const invalidatedByClientCategory = new Map<string, PatchTest[]>();

  for (const categoryId of categoryIds) {
    const { data: tests, error } = await sb
      .from("patch_tests")
      .select("*")
      .eq("techId", tech.id)
      .eq("categoryId", categoryId);
    if (error) throw new Error(error.message);

    for (const test of (tests ?? []) as PatchTest[]) {
      if (!isValidTest(test, nowMs)) continue;
      await updatePatchTest(sb, test.id, {
        expiresAtIso: nowIso,
        invalidatedAtIso: nowIso,
        invalidationEventId: eventId,
      });
      const key = `${test.clientId}:${categoryId}`;
      const list = invalidatedByClientCategory.get(key) ?? [];
      list.push(test);
      invalidatedByClientCategory.set(key, list);
    }
  }

  const retestRows: ProductChangeRetest[] = [];
  for (const [key] of invalidatedByClientCategory) {
    const [clientId, categoryId] = key.split(":");
    const future = futureBookingForCategory(bookings, services, clientId, categoryId, nowMs);
    const row = await createProductChangeRetest(sb, {
      id: randomId("pcr"),
      techId: tech.id,
      eventId,
      clientId,
      categoryId,
      status: "needs_test",
      hasFutureBooking: !!future,
      futureBookingId: future?.id ?? null,
      notifiedAtIso: null,
      resolvedAtIso: null,
      createdAt: nowIso,
      updatedAt: nowIso,
    });
    retestRows.push(row);
  }

  retestRows.sort((a, b) => Number(b.hasFutureBooking) - Number(a.hasFutureBooking));

  let clientsNotified = 0;
  for (const row of retestRows) {
    const client = await getClient(sb, row.clientId);
    if (!client?.email && !client?.phone) continue;
    const category = categories.find((c) => c.id === row.categoryId);
    const future = row.futureBookingId
      ? bookings.find((b) => b.id === row.futureBookingId) ?? null
      : null;
    const sent = await notifyClientOfPatchTestRetest({
      sb,
      tech,
      client,
      categoryName: category?.name ?? "your treatment",
      hasUpcoming: row.hasFutureBooking,
      futureBooking: future,
      categoryId: row.categoryId,
    });
    if (sent.email || sent.sms) {
      clientsNotified++;
      await updateProductChangeRetest(sb, row.id, {
        notifiedAtIso: nowIso,
        updatedAt: nowIso,
      });
    }
  }

  await createAuditEvent(sb, {
    techId: tech.id,
    actor: "tech",
    action: "product_change_retest",
    entityType: "product_change_event",
    entityId: eventId,
    metadata: {
      scopeSummary: summary,
      categoryIds,
      serviceIds: input.serviceIds,
      invalidatedCount: [...invalidatedByClientCategory.values()].reduce((n, t) => n + t.length, 0),
      affectedClients: retestRows.length,
      clientsNotified,
    },
  });

  return {
    eventId,
    invalidatedCount: [...invalidatedByClientCategory.values()].reduce((n, t) => n + t.length, 0),
    clientsNotified,
    affectedClients: retestRows.length,
  };
}

/** Infer retest status for dashboard display when patch tests change elsewhere. */
export async function inferRetestStatus(
  sb: SupabaseClient,
  techId: string,
  clientId: string,
  categoryId: string,
): Promise<PatchRetestStatus | null> {
  const tests = await patchTestsForClient(sb, techId, clientId);
  const catTests = tests.filter((t) => t.categoryId === categoryId);
  const now = Date.now();
  if (catTests.some((t) => t.result === "pass" && new Date(t.expiresAtIso).getTime() > now && !t.invalidatedAtIso)) {
    return "passed";
  }
  if (catTests.some((t) => t.result === "pending")) return "test_booked";
  return "needs_test";
}
