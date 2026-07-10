import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createClientReaction,
  createProductBatch,
  createProductUsage,
  getProduct,
  getProductBatch,
  listActiveBatchesForProduct,
  listProductBatches,
  listProducts,
  productUsagesForBatch,
  reactionsForBatch,
} from "@/lib/db/queries";
import type {
  ClientReaction,
  Product,
  ProductBatch,
  ProductType,
  ProductUsage,
  ReactionSeverity,
} from "@/lib/db/types";

export type ProductInput = {
  categoryId: string;
  name: string;
  brand?: string;
  productType?: ProductType;
};

export type BatchInput = {
  productId: string;
  lotNumber?: string;
  openedAtIso?: string | null;
  expiresAtIso?: string | null;
  changeEventId?: string | null;
  notes?: string;
};

export type UsageInput = {
  batchId: string;
  clientId: string;
  patchTestId?: string | null;
  bookingId?: string | null;
  usedAtIso?: string;
};

export type ReactionInput = {
  clientId: string;
  categoryId: string;
  severity: ReactionSeverity;
  symptoms?: string;
  onsetIso?: string;
  batchId?: string | null;
  patchTestId?: string | null;
  bookingId?: string | null;
  notes?: string;
};

/** Active batches for a category, grouped by product. */
export async function activeBatchesForCategory(
  sb: SupabaseClient,
  techId: string,
  categoryId: string,
): Promise<Array<{ product: Product; batches: ProductBatch[] }>> {
  const products = (await listProducts(sb, techId)).filter(
    (p) => p.categoryId === categoryId && p.active,
  );
  const result: Array<{ product: Product; batches: ProductBatch[] }> = [];
  for (const product of products) {
    const batches = await listActiveBatchesForProduct(sb, product.id);
    if (batches.length > 0) result.push({ product, batches });
  }
  return result;
}

/** Log which batch was used on a patch test or treatment. */
export async function logProductUsage(
  sb: SupabaseClient,
  techId: string,
  input: UsageInput,
): Promise<ProductUsage> {
  if (!input.patchTestId && !input.bookingId) {
    throw new Error("Link the usage to a patch test or booking.");
  }
  const batch = await getProductBatch(sb, input.batchId);
  if (!batch || batch.techId !== techId) throw new Error("Batch not found.");
  if (batch.retiredAtIso) throw new Error("That batch has been retired.");

  return createProductUsage(sb, {
    techId,
    batchId: input.batchId,
    clientId: input.clientId,
    patchTestId: input.patchTestId ?? null,
    bookingId: input.bookingId ?? null,
    usedAtIso: input.usedAtIso ?? new Date().toISOString(),
  });
}

/** Record an adverse reaction and optionally link to a batch. */
export async function recordClientReaction(
  sb: SupabaseClient,
  techId: string,
  input: ReactionInput,
): Promise<ClientReaction> {
  if (input.batchId) {
    const batch = await getProductBatch(sb, input.batchId);
    if (!batch || batch.techId !== techId) throw new Error("Batch not found.");
  }

  return createClientReaction(sb, {
    techId,
    clientId: input.clientId,
    categoryId: input.categoryId,
    severity: input.severity,
    symptoms: input.symptoms?.trim() ?? "",
    onsetIso: input.onsetIso ?? new Date().toISOString(),
    batchId: input.batchId ?? null,
    patchTestId: input.patchTestId ?? null,
    bookingId: input.bookingId ?? null,
    notes: input.notes?.trim() ?? "",
  });
}

/** Trace a batch: clients who received it and any linked reactions. */
export async function traceBatch(
  sb: SupabaseClient,
  techId: string,
  batchId: string,
): Promise<{
  batch: ProductBatch;
  product: Product;
  usages: ProductUsage[];
  reactions: ClientReaction[];
}> {
  const batch = await getProductBatch(sb, batchId);
  if (!batch || batch.techId !== techId) throw new Error("Batch not found.");
  const product = await getProduct(sb, batch.productId);
  if (!product) throw new Error("Product not found.");

  const [usages, reactions] = await Promise.all([
    productUsagesForBatch(sb, batchId),
    reactionsForBatch(sb, batchId),
  ]);

  return { batch, product, usages, reactions };
}

/** Open a new batch when switching products (optional link to change event). */
export async function openProductBatch(
  sb: SupabaseClient,
  techId: string,
  input: BatchInput,
): Promise<ProductBatch> {
  const product = await getProduct(sb, input.productId);
  if (!product || product.techId !== techId) throw new Error("Product not found.");

  return createProductBatch(sb, {
    techId,
    productId: input.productId,
    lotNumber: input.lotNumber?.trim() ?? "",
    openedAtIso: input.openedAtIso ?? new Date().toISOString(),
    expiresAtIso: input.expiresAtIso ?? null,
    changeEventId: input.changeEventId ?? null,
    notes: input.notes?.trim() ?? "",
    retiredAtIso: null,
  });
}

/** List batches with usage and reaction counts for dashboard. */
export async function batchSummaries(sb: SupabaseClient, techId: string) {
  const [products, batches] = await Promise.all([
    listProducts(sb, techId),
    listProductBatches(sb, techId),
  ]);
  const productById = new Map(products.map((p) => [p.id, p]));

  const summaries = await Promise.all(
    batches.map(async (batch) => {
      const [usages, reactions] = await Promise.all([
        productUsagesForBatch(sb, batch.id),
        reactionsForBatch(sb, batch.id),
      ]);
      return {
        batch,
        product: productById.get(batch.productId) ?? null,
        usageCount: usages.length,
        reactionCount: reactions.length,
      };
    }),
  );

  return summaries;
}

export function productTypeLabel(type: ProductType): string {
  switch (type) {
    case "adhesive":
      return "Adhesive";
    case "tint":
      return "Tint";
    case "lift":
      return "Lift solution";
    default:
      return "Other";
  }
}

export function severityLabel(severity: ReactionSeverity): string {
  switch (severity) {
    case "mild":
      return "Mild";
    case "moderate":
      return "Moderate";
    case "severe":
      return "Severe";
  }
}
