"use client";

import { useMemo, useState } from "react";
import { TrendingUp, AlertTriangle, CheckCircle2 } from "lucide-react";
import { SubmitButton } from "@/components/ui/submit-button";
import { CopyButton } from "@/components/ui/copy-button";
import { Input, Label } from "@/components/ui/input";
import { gbp } from "@/lib/format";
import {
  buildPriceRiseAnnouncement,
  previewPriceRise,
  priceRiseEmailSubjectForDate,
  type PriceRiseMode,
} from "@/lib/price-rise";
import { applyPriceRiseAction } from "@/app/dashboard/actions";
import type { Service, Tech } from "@/lib/db/types";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://glow-uk.com";

export function PriceRisePanel({
  services,
  tech,
}: {
  services: Service[];
  tech: Tech;
}) {
  const activeServices = useMemo(() => services.filter((s) => s.active), [services]);
  const [mode, setMode] = useState<PriceRiseMode>("percent");
  const [amount, setAmount] = useState(10);
  const [effectiveDate, setEffectiveDate] = useState("");
  const [note, setNote] = useState("");
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(activeServices.map((s) => s.id)),
  );
  const [confirmOpen, setConfirmOpen] = useState(false);

  const valuePennies =
    mode === "fixed" ? Math.round(Math.max(0, amount) * 100) : Math.max(0, amount);

  const preview = useMemo(
    () =>
      previewPriceRise(activeServices, [...selected], {
        mode,
        value: valuePennies,
        effectiveDate,
        note,
      }),
    [activeServices, selected, mode, valuePennies, effectiveDate, note],
  );

  const announcement = useMemo(
    () =>
      buildPriceRiseAnnouncement(
        tech,
        { mode, value: valuePennies, effectiveDate, note },
        preview,
        APP_URL,
      ),
    [tech, mode, valuePennies, effectiveDate, note, preview],
  );

  const emailSubject = priceRiseEmailSubjectForDate(tech, effectiveDate);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(activeServices.map((s) => s.id)));
  const selectNone = () => setSelected(new Set());

  if (activeServices.length === 0) return null;

  return (
    <div className="card border-emerald-500/25 bg-emerald-500/5 p-5">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-500/15 text-success-text">
          <TrendingUp className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-lg font-semibold text-ink">Price rise assistant</h2>
          <p className="mt-1 text-sm leading-relaxed text-ink-soft">
            Preview new menu prices, copy client announcement text, then apply in one tap.
            Existing bookings keep their booked price.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <Label>Increase by</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {(["percent", "fixed"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={
                  "rounded-lg px-3 py-1.5 text-sm font-medium transition " +
                  (mode === m
                    ? "bg-emerald-600 text-white"
                    : "bg-fill-hover text-ink-soft hover:text-ink")
                }
              >
                {m === "percent" ? "%" : "£ fixed"}
              </button>
            ))}
          </div>
          <Input
            type="number"
            min={0}
            step={mode === "percent" ? 1 : 0.5}
            value={amount}
            onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
            className="mt-2 w-32"
          />
          <p className="mt-1 text-xs text-ink-faint">
            {mode === "percent"
              ? "New prices round to the nearest 50p."
              : "Adds this amount to each selected service."}
          </p>
        </div>
        <div>
          <Label htmlFor="rise-effective">Effective from (optional)</Label>
          <Input
            id="rise-effective"
            type="date"
            value={effectiveDate}
            onChange={(e) => setEffectiveDate(e.target.value)}
            className="mt-2"
          />
          <Label htmlFor="rise-note" className="mt-3 block">
            Optional note for clients
          </Label>
          <Input
            id="rise-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Thank you for your continued support"
            className="mt-2"
          />
        </div>
      </div>

      <div className="mt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label>Services to update</Label>
          <div className="flex gap-2 text-xs">
            <button type="button" onClick={selectAll} className="text-brand-text hover:underline">
              All
            </button>
            <span className="text-ink-faint">·</span>
            <button type="button" onClick={selectNone} className="text-brand-text hover:underline">
              None
            </button>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {activeServices.map((s) => (
            <label
              key={s.id}
              className={
                "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition " +
                (selected.has(s.id)
                  ? "border-emerald-500/40 bg-success-soft"
                  : "border-edge bg-cream")
              }
            >
              <input
                type="checkbox"
                checked={selected.has(s.id)}
                onChange={() => toggle(s.id)}
                className="h-4 w-4 rounded border-edge text-emerald-500"
              />
              {s.name}
            </label>
          ))}
        </div>
      </div>

      {preview.length > 0 ? (
        <div className="mt-4 overflow-x-auto rounded-xl border border-edge">
          <table className="w-full min-w-[320px] text-sm">
            <thead>
              <tr className="border-b border-edge bg-fill text-left text-xs text-ink-faint">
                <th className="px-3 py-2 font-medium">Service</th>
                <th className="px-3 py-2 font-medium">Current</th>
                <th className="px-3 py-2 font-medium">New</th>
                <th className="px-3 py-2 font-medium text-right">Change</th>
              </tr>
            </thead>
            <tbody>
              {preview.map((row) => (
                <tr key={row.serviceId} className="border-b border-edge last:border-0">
                  <td className="px-3 py-2 font-medium">{row.name}</td>
                  <td className="px-3 py-2 text-ink-soft">{gbp(row.currentPennies)}</td>
                  <td className="px-3 py-2">{gbp(row.newPennies)}</td>
                  <td className="px-3 py-2 text-right text-success-text">+{gbp(row.deltaPennies)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-4 text-sm text-ink-faint">
          Select services and set an increase to preview new prices.
        </p>
      )}

      {preview.length > 0 && (
        <div className="mt-4 space-y-3 rounded-xl border border-edge bg-cream p-4">
          <p className="text-sm font-medium text-ink">Client announcement copy</p>
          <div className="space-y-3">
            <div>
              <p className="text-xs font-medium text-ink-faint">Email subject</p>
              <p className="mt-1 text-sm text-ink-soft">{emailSubject}</p>
              <div className="mt-2">
                <CopyButton text={emailSubject} label="Copy subject" />
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-ink-faint">Email / message body</p>
              <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-fill-hover p-3 text-xs text-ink-soft">
                {announcement.email}
              </pre>
              <div className="mt-2">
                <CopyButton text={announcement.email} label="Copy email" />
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-ink-faint">SMS</p>
              <pre className="mt-1 whitespace-pre-wrap rounded-lg bg-fill-hover p-3 text-xs text-ink-soft">
                {announcement.sms}
              </pre>
              <div className="mt-2">
                <CopyButton text={announcement.sms} label="Copy SMS" />
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-ink-faint">Instagram / social</p>
              <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-fill-hover p-3 text-xs text-ink-soft">
                {announcement.social}
              </pre>
              <div className="mt-2">
                <CopyButton text={announcement.social} label="Copy post" />
              </div>
            </div>
          </div>
        </div>
      )}

      {preview.length > 0 && (
        <form action={applyPriceRiseAction} className="mt-4">
          <input
            type="hidden"
            name="updates"
            value={JSON.stringify(
              preview.map((row) => ({ id: row.serviceId, pricePennies: row.newPennies })),
            )}
          />
          <input type="hidden" name="mode" value={mode} />
          <input type="hidden" name="value" value={String(valuePennies)} />
          <input type="hidden" name="effectiveDate" value={effectiveDate} />

          {!confirmOpen ? (
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              className="w-full rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-4 py-2.5 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/20"
            >
              Apply new prices to {preview.length} service{preview.length === 1 ? "" : "s"}
            </button>
          ) : (
            <div className="rounded-xl border border-emerald-500/30 bg-success-soft p-3">
              <p className="flex items-start gap-2 text-sm text-emerald-100">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                This updates your public booking page immediately. Existing appointments are unchanged.
                Continue?
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <SubmitButton
                  size="sm"
                  pendingLabel="Updating…"
                  className="bg-emerald-600 hover:bg-emerald-500"
                >
                  <CheckCircle2 className="h-4 w-4" /> Yes, update prices
                </SubmitButton>
                <button
                  type="button"
                  onClick={() => setConfirmOpen(false)}
                  className="rounded-lg border border-edge px-3 py-2 text-sm text-ink-soft hover:text-ink"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </form>
      )}
    </div>
  );
}
