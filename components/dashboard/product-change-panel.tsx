"use client";

import { useState } from "react";
import { AlertTriangle, FlaskConical } from "lucide-react";
import { SubmitButton } from "@/components/ui/submit-button";
import { Label, Textarea } from "@/components/ui/input";
import type { Service, ServiceCategory } from "@/lib/db/types";
import { productChangeAction } from "@/app/dashboard/actions";

export function ProductChangePanel({
  categories,
  services,
  products = [],
}: {
  categories: ServiceCategory[];
  services: Service[];
  products?: { id: string; name: string; brand: string; categoryId: string }[];
}) {
  const [mode, setMode] = useState<"category" | "services">("category");
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [selectedServices, setSelectedServices] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);

  const toggleCategory = (id: string) => {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleService = (id: string) => {
    setSelectedServices((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const canSubmit =
    mode === "category" ? selectedCategories.size > 0 : selectedServices.size > 0;

  return (
    <div className="card border-amber-500/25 bg-amber-500/5 p-5">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-500/15 text-amber-300">
          <FlaskConical className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-lg font-semibold text-ink">Changed products?</h2>
          <p className="mt-1 text-sm leading-relaxed text-ink-soft">
            If you have switched lash adhesive, tint, lift solution or similar, invalidate existing patch
            tests and email affected clients. Clients with upcoming appointments are notified first.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setMode("category")}
          className={
            "rounded-lg px-3 py-1.5 text-sm font-medium transition " +
            (mode === "category"
              ? "bg-brand-500/20 text-brand-300"
              : "bg-white/[0.04] text-ink-soft hover:text-ink")
          }
        >
          Whole category
        </button>
        <button
          type="button"
          onClick={() => setMode("services")}
          className={
            "rounded-lg px-3 py-1.5 text-sm font-medium transition " +
            (mode === "services"
              ? "bg-brand-500/20 text-brand-300"
              : "bg-white/[0.04] text-ink-soft hover:text-ink")
          }
        >
          Specific services
        </button>
      </div>

      <form action={productChangeAction} className="mt-4 space-y-4">
        {mode === "category" ? (
          <div className="space-y-2">
            <Label>Which category?</Label>
            {categories.length === 0 ? (
              <p className="text-sm text-ink-faint">Add a category first.</p>
            ) : (
              categories.map((c) => (
                <label
                  key={c.id}
                  className="flex cursor-pointer items-center gap-3 rounded-xl border border-edge bg-cream/60 px-4 py-3 text-sm"
                >
                  <input
                    type="checkbox"
                    name="categoryId"
                    value={c.id}
                    checked={selectedCategories.has(c.id)}
                    onChange={() => toggleCategory(c.id)}
                    className="h-4 w-4 rounded border-black/20 text-brand-400"
                  />
                  <span>
                    {c.name}
                    <span className="ml-2 text-ink-faint">
                      {services.filter((s) => s.categoryId === c.id).length} service
                      {services.filter((s) => s.categoryId === c.id).length === 1 ? "" : "s"}
                    </span>
                  </span>
                </label>
              ))
            )}
          </div>
        ) : (
          <div className="max-h-64 space-y-2 overflow-y-auto">
            <Label>Which services?</Label>
            {services.map((s) => (
              <label
                key={s.id}
                className="flex cursor-pointer items-center gap-3 rounded-xl border border-edge bg-cream/60 px-4 py-3 text-sm"
              >
                <input
                  type="checkbox"
                  name="serviceId"
                  value={s.id}
                  checked={selectedServices.has(s.id)}
                  onChange={() => toggleService(s.id)}
                  className="h-4 w-4 rounded border-black/20 text-brand-400"
                />
                <span>
                  {s.name}
                  <span className="ml-2 text-ink-faint">{catLabel(categories, s.categoryId)}</span>
                </span>
              </label>
            ))}
          </div>
        )}

        <div>
          <Label htmlFor="product-change-note">Note (optional, for your records)</Label>
          <Textarea
            id="product-change-note"
            name="note"
            rows={2}
            placeholder="e.g. Switched to new adhesive brand"
          />
        </div>

        {products.length > 0 && (
          <div className="rounded-xl border border-edge bg-cream/60 p-4 space-y-3">
            <p className="text-sm font-medium text-ink">Link a new batch (optional)</p>
            <p className="text-xs text-ink-faint">
              Open a fresh lot number at the same time as logging the product change.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label>Product</Label>
                <select
                  name="newBatchProductId"
                  className="input w-full"
                  defaultValue=""
                >
                  <option value="">Skip — no new batch</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}{p.brand ? ` (${p.brand})` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Lot number</Label>
                <input name="newBatchLot" className="input w-full" placeholder="e.g. B98765" />
              </div>
              <div>
                <Label>Expires (optional)</Label>
                <input name="newBatchExpires" type="date" className="input w-full" />
              </div>
            </div>
          </div>
        )}

        {!confirmOpen ? (
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => setConfirmOpen(true)}
            className="w-full rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-100 transition hover:bg-amber-500/15 disabled:opacity-50"
          >
            I&apos;ve changed products
          </button>
        ) : (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
            <p className="flex items-start gap-2 text-sm text-amber-100">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              This will expire valid patch tests for the selected scope and email every affected client.
              Continue?
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <SubmitButton
                size="lg"
                pendingLabel="Notifying clients…"
                className="bg-amber-600 hover:bg-amber-500"
              >
                Yes, notify clients
              </SubmitButton>
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="rounded-xl border border-edge px-4 py-2.5 text-sm font-medium text-ink-soft hover:text-ink"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}

function catLabel(categories: ServiceCategory[], id: string) {
  return categories.find((c) => c.id === id)?.name ?? "";
}
