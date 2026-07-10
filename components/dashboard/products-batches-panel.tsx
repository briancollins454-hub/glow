"use client";

import { useState } from "react";
import { Package, Plus, Trash2, Beaker } from "lucide-react";
import { SubmitButton } from "@/components/ui/submit-button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { fmtDate } from "@/lib/format";
import { productTypeLabel } from "@/lib/product-batches";
import type { Product, ProductBatch, ServiceCategory } from "@/lib/db/types";
import {
  addProductAction,
  addBatchAction,
  deleteProductAction,
  retireBatchAction,
} from "@/app/dashboard/actions";

type BatchSummary = {
  batch: ProductBatch;
  product: Product | null;
  usageCount: number;
  reactionCount: number;
};

export function ProductsBatchesPanel({
  categories,
  products,
  batchSummaries,
}: {
  categories: ServiceCategory[];
  products: Product[];
  batchSummaries: BatchSummary[];
}) {
  const [openProduct, setOpenProduct] = useState(categories.length > 0 && products.length === 0);
  const catById = Object.fromEntries(categories.map((c) => [c.id, c.name]));
  const activeBatches = batchSummaries.filter((s) => !s.batch.retiredAtIso);

  return (
    <div className="card p-5">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-500/15 text-brand-300">
          <Package className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-lg font-semibold text-ink">Products &amp; batches</h2>
          <p className="mt-1 text-sm leading-relaxed text-ink-soft">
            Log lot numbers for adhesives, tints and lift solutions. Link batches to patch tests and
            treatments so you can trace reactions back to a specific product.
          </p>
        </div>
      </div>

      {products.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-sm font-medium text-ink">Your products</p>
          {products.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between gap-2 rounded-xl border border-edge bg-cream px-4 py-2.5 text-sm"
            >
              <div className="min-w-0">
                <span className="font-medium">{p.name}</span>
                {p.brand && <span className="text-ink-faint"> · {p.brand}</span>}
                <span className="ml-2 text-ink-faint">
                  {catById[p.categoryId]} · {productTypeLabel(p.productType)}
                </span>
              </div>
              <form action={deleteProductAction}>
                <input type="hidden" name="id" value={p.id} />
                <button
                  type="submit"
                  className="grid h-8 w-8 place-items-center rounded-lg text-ink-faint hover:bg-red-500/10 hover:text-red-400"
                  title="Delete product"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </form>
            </div>
          ))}
        </div>
      )}

      <details className="mt-4" open={openProduct}>
        <summary className="cursor-pointer text-sm font-medium text-brand-400">
          {products.length === 0 ? "Add your first product" : "Add another product"}
        </summary>
        <form action={addProductAction} className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Category</Label>
            <Select name="categoryId" required defaultValue="">
              <option value="" disabled>Choose</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Type</Label>
            <Select name="productType" defaultValue="adhesive">
              <option value="adhesive">Adhesive</option>
              <option value="tint">Tint</option>
              <option value="lift">Lift solution</option>
              <option value="other">Other</option>
            </Select>
          </div>
          <div>
            <Label>Product name</Label>
            <Input name="name" placeholder="e.g. Elite Bond" required />
          </div>
          <div>
            <Label>Brand (optional)</Label>
            <Input name="brand" placeholder="e.g. LashBase" />
          </div>
          <div className="sm:col-span-2">
            <SubmitButton size="sm" pendingLabel="Adding…">
              <Plus className="h-4 w-4" /> Add product
            </SubmitButton>
          </div>
        </form>
      </details>

      {products.length > 0 && (
        <div className="mt-5 border-t border-edge pt-4">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <Beaker className="h-4 w-4 text-brand-400" /> Open batches
          </p>
          {activeBatches.length === 0 ? (
            <p className="mt-2 text-sm text-ink-faint">No open batches. Open one when you start a new bottle or tube.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {activeBatches.map(({ batch, product, usageCount, reactionCount }) => (
                <li
                  key={batch.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-edge bg-white/[0.03] px-4 py-2.5 text-sm"
                >
                  <div className="min-w-0">
                    <span className="font-medium">{product?.name ?? "Product"}</span>
                    {batch.lotNumber && (
                      <span className="ml-2 text-ink-faint">Lot {batch.lotNumber}</span>
                    )}
                    <p className="text-xs text-ink-faint">
                      Opened {batch.openedAtIso ? fmtDate(batch.openedAtIso) : "—"}
                      {batch.expiresAtIso && ` · expires ${fmtDate(batch.expiresAtIso)}`}
                      {" · "}{usageCount} use{usageCount === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {reactionCount > 0 && <Badge tone="red">{reactionCount} reaction{reactionCount === 1 ? "" : "s"}</Badge>}
                    <form action={retireBatchAction}>
                      <input type="hidden" name="id" value={batch.id} />
                      <button
                        type="submit"
                        className="rounded-lg border border-edge px-2.5 py-1 text-xs font-medium text-ink-soft hover:text-ink"
                      >
                        Retire
                      </button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <details className="mt-3">
            <summary className="cursor-pointer text-sm font-medium text-brand-400">Open a new batch</summary>
            <form action={addBatchAction} className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label>Product</Label>
                <Select name="productId" required defaultValue="">
                  <option value="" disabled>Choose</option>
                  {products.filter((p) => p.active).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}{p.brand ? ` (${p.brand})` : ""} · {catById[p.categoryId]}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Lot / batch number</Label>
                <Input name="lotNumber" placeholder="e.g. A12345" />
              </div>
              <div>
                <Label>Opened on</Label>
                <Input name="openedAt" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
              </div>
              <div>
                <Label>Expires (optional)</Label>
                <Input name="expiresAt" type="date" />
              </div>
              <div>
                <Label>Notes (optional)</Label>
                <Textarea name="notes" rows={2} placeholder="e.g. New formula from supplier" />
              </div>
              <div className="sm:col-span-2">
                <SubmitButton size="sm" pendingLabel="Opening…">
                  <Plus className="h-4 w-4" /> Open batch
                </SubmitButton>
              </div>
            </form>
          </details>
        </div>
      )}
    </div>
  );
}
