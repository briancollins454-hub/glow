"use client";

import { useState } from "react";
import { MessageSquareQuote, Pencil, Trash2, Plus } from "lucide-react";
import {
  createTestimonialAction,
  updateTestimonialAction,
  deleteTestimonialAction,
} from "@/app/dashboard/actions";
import { clearDashboardCache } from "@/lib/dashboard/client-cache";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { Badge } from "@/components/ui/badge";
import { fmtDate } from "@/lib/format";
import {
  TESTIMONIAL_CAP,
  defaultTestimonialShowUntil,
  isTestimonialVisible,
} from "@/lib/testimonials";
import type { Testimonial } from "@/lib/db/types";

function toDateInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function TestimonialForm({
  initial,
  onCancel,
}: {
  initial?: Testimonial;
  onCancel?: () => void;
}) {
  const isEdit = !!initial;
  const [keepForever, setKeepForever] = useState(!initial?.showUntil && !!initial);
  const defaultUntil = toDateInputValue(
    initial?.showUntil ?? defaultTestimonialShowUntil(),
  );

  return (
    <form
      action={isEdit ? updateTestimonialAction : createTestimonialAction}
      onSubmit={() => clearDashboardCache("reviews")}
      className="space-y-3 rounded-xl border border-edge bg-cream p-4"
    >
      {isEdit && <input type="hidden" name="id" value={initial.id} />}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor={`author-${initial?.id ?? "new"}`}>Author label</Label>
          <Input
            id={`author-${initial?.id ?? "new"}`}
            name="authorLabel"
            required
            defaultValue={initial?.authorLabel ?? ""}
            placeholder="e.g. Sarah M"
          />
        </div>
        <div>
          <Label htmlFor={`rating-${initial?.id ?? "new"}`}>Rating (optional)</Label>
          <Select
            id={`rating-${initial?.id ?? "new"}`}
            name="rating"
            defaultValue={initial?.rating != null ? String(initial.rating) : ""}
          >
            <option value="">No star rating</option>
            <option value="5">5 stars</option>
            <option value="4">4 stars</option>
            <option value="3">3 stars</option>
            <option value="2">2 stars</option>
            <option value="1">1 star</option>
          </Select>
        </div>
      </div>
      <div>
        <Label htmlFor={`body-${initial?.id ?? "new"}`}>Testimonial</Label>
        <Textarea
          id={`body-${initial?.id ?? "new"}`}
          name="body"
          required
          rows={3}
          defaultValue={initial?.body ?? ""}
          placeholder="What they said…"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor={`source-${initial?.id ?? "new"}`}>Source label</Label>
          <Input
            id={`source-${initial?.id ?? "new"}`}
            name="sourceLabel"
            defaultValue={initial?.sourceLabel ?? "previous platform"}
            placeholder="Fresha, Booksy, …"
          />
        </div>
        <div>
          <Label htmlFor={`until-${initial?.id ?? "new"}`}>Show until</Label>
          <Input
            id={`until-${initial?.id ?? "new"}`}
            name="showUntil"
            type="date"
            defaultValue={defaultUntil}
            disabled={keepForever}
          />
          <label className="mt-2 flex items-center gap-2 text-xs text-ink-soft">
            <input
              type="checkbox"
              name="keepIndefinitely"
              value="1"
              checked={keepForever}
              onChange={(e) => setKeepForever(e.target.checked)}
            />
            Keep indefinitely (no end date)
          </label>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <SubmitButton size="sm" pendingLabel="Saving…">
          {isEdit ? "Save changes" : "Add testimonial"}
        </SubmitButton>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-edge px-3 py-2 text-sm text-ink-soft hover:text-ink"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

export function TestimonialsManager({ testimonials }: { testimonials: Testimonial[] }) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const used = testimonials.length;
  const atCap = used >= TESTIMONIAL_CAP;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquareQuote className="h-5 w-5 text-brand-400" />
          Imported testimonials ({used}/{TESTIMONIAL_CAP})
        </CardTitle>
        <CardDescription>
          Unverified quotes from a previous platform. They show in a separate
          &ldquo;From before Glow&rdquo; section on your booking page and never affect your Glow
          star rating or review count.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          Be honest with clients: these are labelled as imported and not verified Glow bookings.
          Default display window is 6 months; you can clear that to keep them indefinitely.
        </p>

        {!adding && !atCap && (
          <button
            type="button"
            onClick={() => {
              setAdding(true);
              setEditingId(null);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-edge bg-white/[0.04] px-3 py-2 text-sm font-medium text-ink-soft hover:text-ink"
          >
            <Plus className="h-4 w-4" /> Add testimonial
          </button>
        )}
        {atCap && (
          <p className="text-sm text-ink-faint">
            You&apos;ve reached the {TESTIMONIAL_CAP} testimonial limit. Delete one to add another.
          </p>
        )}
        {adding && (
          <TestimonialForm
            onCancel={() => setAdding(false)}
          />
        )}

        {testimonials.length === 0 && !adding && (
          <p className="py-4 text-center text-sm text-ink-faint">
            No imported testimonials yet. Add a few manually or import a CSV from Move to Glow.
          </p>
        )}

        {testimonials.map((t) => {
          const visible = isTestimonialVisible(t);
          if (editingId === t.id) {
            return (
              <TestimonialForm
                key={t.id}
                initial={t}
                onCancel={() => setEditingId(null)}
              />
            );
          }
          return (
            <div key={t.id} className="rounded-xl border border-edge bg-cream p-4">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">{t.authorLabel}</p>
                {t.rating != null && (
                  <span className="text-xs text-amber-300">{t.rating}/5</span>
                )}
                <Badge tone="neutral">via {t.sourceLabel}</Badge>
                {visible ? (
                  <Badge tone="green">Showing</Badge>
                ) : (
                  <Badge tone="amber">Expired</Badge>
                )}
                <span className="text-xs text-ink-faint">
                  Added {fmtDate(t.createdAt)}
                  {t.showUntil ? ` · until ${fmtDate(t.showUntil)}` : " · no end date"}
                </span>
              </div>
              <p className="mt-2 text-sm text-ink-soft">&ldquo;{t.body}&rdquo;</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(t.id);
                    setAdding(false);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-white/[0.06] px-3 py-1.5 text-xs font-medium text-ink-soft hover:bg-white/[0.1]"
                >
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </button>
                <form
                  action={deleteTestimonialAction}
                  onSubmit={() => clearDashboardCache("reviews")}
                >
                  <input type="hidden" name="id" value={t.id} />
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-ink-faint hover:bg-red-500/10 hover:text-red-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </button>
                </form>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
