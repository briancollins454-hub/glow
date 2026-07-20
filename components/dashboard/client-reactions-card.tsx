"use client";

import { AlertTriangle, Plus, Trash2 } from "lucide-react";
import { SubmitButton } from "@/components/ui/submit-button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { fmtDate } from "@/lib/format";
import { severityLabel } from "@/lib/product-batches";
import type { ClientReaction, Product, ProductBatch, ServiceCategory } from "@/lib/db/types";
import { addReactionAction, deleteReactionAction } from "@/app/dashboard/actions";

type BatchOption = {
  batch: ProductBatch;
  product: Product;
  label: string;
};

export function ClientReactionsCard({
  clientId,
  categories,
  reactions,
  batchOptions,
}: {
  clientId: string;
  categories: ServiceCategory[];
  reactions: ClientReaction[];
  batchOptions: BatchOption[];
}) {
  const catById = Object.fromEntries(categories.map((c) => [c.id, c.name]));
  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <div className="card p-5">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-red-500/15 text-danger-text">
          <AlertTriangle className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-lg font-semibold text-ink">Reactions</h2>
          <p className="mt-1 text-sm leading-relaxed text-ink-soft">
            Record adverse reactions and link them to a product batch when you know which lot was used.
          </p>
        </div>
      </div>

      {reactions.length === 0 ? (
        <p className="mt-4 text-sm text-ink-faint">No reactions recorded for this client.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {reactions.map((r) => {
            const batch = batchOptions.find((o) => o.batch.id === r.batchId);
            const tone = r.severity === "severe" ? "red" : r.severity === "moderate" ? "amber" : "neutral";
            return (
              <li
                key={r.id}
                className="flex items-start justify-between gap-2 rounded-xl border border-edge bg-cream px-4 py-2.5 text-sm"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={tone}>{severityLabel(r.severity)}</Badge>
                    <span className="font-medium">{catById[r.categoryId] ?? "Category"}</span>
                    <span className="text-xs text-ink-faint">{fmtDate(r.onsetIso)}</span>
                  </div>
                  {r.symptoms && <p className="mt-1">{r.symptoms}</p>}
                  {batch && (
                    <p className="mt-0.5 text-xs text-ink-faint">
                      Linked batch: {batch.product.name}
                      {batch.batch.lotNumber && ` · Lot ${batch.batch.lotNumber}`}
                    </p>
                  )}
                  {r.notes && <p className="mt-0.5 text-xs text-ink-faint">{r.notes}</p>}
                </div>
                <form action={deleteReactionAction}>
                  <input type="hidden" name="id" value={r.id} />
                  <input type="hidden" name="clientId" value={clientId} />
                  <button
                    type="submit"
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ink-faint hover:bg-danger-soft hover:text-red-400"
                    title="Delete reaction"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      )}

      {categories.length > 0 && (
        <form action={addReactionAction} className="mt-4 grid gap-2 border-t border-edge pt-4 sm:grid-cols-2">
          <input type="hidden" name="clientId" value={clientId} />
          <div className="sm:col-span-2">
            <Label>Category</Label>
            <Select name="categoryId" required defaultValue="">
              <option value="" disabled>Choose</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Severity</Label>
            <Select name="severity" defaultValue="mild">
              <option value="mild">Mild</option>
              <option value="moderate">Moderate</option>
              <option value="severe">Severe</option>
            </Select>
          </div>
          <div>
            <Label>Onset date</Label>
            <Input name="onsetAt" type="date" defaultValue={todayStr} required />
          </div>
          <div className="sm:col-span-2">
            <Label>Symptoms</Label>
            <Textarea name="symptoms" rows={2} placeholder="e.g. Redness, swelling, itching" />
          </div>
          {batchOptions.length > 0 && (
            <div className="sm:col-span-2">
              <Label>Link to batch (optional)</Label>
              <Select name="batchId" defaultValue="">
                <option value="">Not sure / not linked</option>
                {batchOptions.map((o) => (
                  <option key={o.batch.id} value={o.batch.id}>{o.label}</option>
                ))}
              </Select>
            </div>
          )}
          <div className="sm:col-span-2">
            <Label>Notes (optional)</Label>
            <Textarea name="notes" rows={1} placeholder="Follow-up, GP referral, etc." />
          </div>
          <div className="sm:col-span-2">
            <SubmitButton variant="secondary" size="sm" pendingLabel="Saving…">
              <Plus className="h-4 w-4" /> Record reaction
            </SubmitButton>
          </div>
        </form>
      )}
    </div>
  );
}
