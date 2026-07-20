"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Link2, MessageCircle, Sparkles, CheckCircle2 } from "lucide-react";
import { SubmitButton } from "@/components/ui/submit-button";
import { CopyButton } from "@/components/ui/copy-button";
import { Input, Label } from "@/components/ui/input";
import { ServicePicker } from "@/components/dashboard/service-picker";
import { createDmQuoteAction } from "@/app/dashboard/actions";
import type { Service, ServiceAddon, ServiceCategory } from "@/lib/db/types";

export function DmQuotePanel({
  services,
  categories,
  addons,
  clientId,
  clientName = "",
  returnTo = "/dashboard/messages",
}: {
  services: Service[];
  categories: ServiceCategory[];
  addons: ServiceAddon[];
  clientId?: string;
  clientName?: string;
  returnTo?: string;
}) {
  const searchParams = useSearchParams();
  const createdToken = searchParams.get("qt");
  const activeServices = useMemo(() => services.filter((s) => s.active), [services]);
  const [serviceId, setServiceId] = useState(activeServices[0]?.id ?? "");
  const [greeting, setGreeting] = useState(clientName);
  const [note, setNote] = useState("");
  const [selectedAddons, setSelectedAddons] = useState<Set<string>>(new Set());
  const [created, setCreated] = useState<{
    url: string;
    copy: { instagram: string; whatsapp: string };
  } | null>(null);

  const serviceAddons = useMemo(
    () => addons.filter((a) => a.serviceId === serviceId && a.active),
    [addons, serviceId],
  );

  useEffect(() => {
    if (!createdToken) return;
    let cancelled = false;
    fetch(`/api/dm-quote/${createdToken}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data?.url) {
          setCreated({ url: data.url, copy: data.copy });
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [createdToken]);

  const toggleAddon = (id: string) => {
    setSelectedAddons((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (activeServices.length === 0) return null;

  return (
    <div className="card border-brand-500/25 bg-brand-500/5 p-5">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-500/15 text-brand-text">
          <MessageCircle className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-lg font-semibold text-ink">DM quote link</h2>
          <p className="mt-1 text-sm leading-relaxed text-ink-soft">
            Build a quote for Instagram or WhatsApp. Your client gets a branded page with price, deposit and a book-now button.
          </p>
        </div>
      </div>

      {created ? (
        <div className="mt-4 space-y-3 rounded-xl border border-emerald-500/30 bg-success-soft p-4">
          <p className="flex items-center gap-2 text-sm font-medium text-emerald-200">
            <CheckCircle2 className="h-4 w-4" />
            Quote link ready - paste into your DM
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="max-w-full truncate rounded-lg bg-fill-hover px-2 py-1 text-xs text-ink-soft">
              {created.url}
            </code>
            <CopyButton text={created.url} label="Copy link" />
          </div>
          <div>
            <p className="text-xs font-medium text-ink-faint">DM message</p>
            <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-fill-hover p-3 text-xs text-ink-soft">
              {created.copy.instagram}
            </pre>
            <div className="mt-2">
              <CopyButton text={created.copy.instagram} label="Copy message" />
            </div>
          </div>
        </div>
      ) : (
        <form action={createDmQuoteAction} className="mt-4 space-y-4">
          <input type="hidden" name="returnTo" value={returnTo} />
          {clientId && <input type="hidden" name="clientId" value={clientId} />}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Service</Label>
              <ServicePicker
                name="serviceId"
                services={activeServices}
                categories={categories}
                value={serviceId}
                onValueChange={(id) => {
                  setServiceId(id);
                  setSelectedAddons(new Set());
                }}
                required
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="dm-client-name">Client first name (optional)</Label>
              <Input
                id="dm-client-name"
                name="clientName"
                value={greeting}
                onChange={(e) => setGreeting(e.target.value)}
                placeholder="e.g. Sophie"
                className="mt-2"
              />
            </div>
          </div>

          {serviceAddons.length > 0 && (
            <div>
              <Label>Extras on the quote</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {serviceAddons.map((a) => (
                  <label
                    key={a.id}
                    className={
                      "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm " +
                      (selectedAddons.has(a.id)
                        ? "border-brand-500/40 bg-brand-500/10"
                        : "border-edge bg-cream")
                    }
                  >
                    <input
                      type="checkbox"
                      name="addonId"
                      value={a.id}
                      checked={selectedAddons.has(a.id)}
                      onChange={() => toggleAddon(a.id)}
                      className="h-4 w-4 rounded border-edge text-brand-400"
                    />
                    <Sparkles className="h-3.5 w-3.5 text-brand-text" />
                    {a.name}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div>
            <Label htmlFor="dm-note">Personal note (optional)</Label>
            <Input
              id="dm-note"
              name="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. So excited to see you!"
              className="mt-2"
            />
          </div>

          <SubmitButton className="w-full sm:w-auto" pendingLabel="Creating link…">
            <Link2 className="h-4 w-4" /> Generate quote link
          </SubmitButton>
        </form>
      )}
    </div>
  );
}
