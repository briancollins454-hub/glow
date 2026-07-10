"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Plus, Trash2, ShieldCheck, RefreshCw, FolderPlus, ImagePlus, Sparkles, CheckCircle2 } from "lucide-react";
import { AsyncDashboardPage } from "@/components/dashboard/async-dashboard-page";
import { ServiceSortableList } from "@/components/dashboard/service-sortable-list";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { Input, Label } from "@/components/ui/input";
import { gbp, minutesToLabel } from "@/lib/format";
import { depositFor } from "@/lib/rules";
import { ServiceForm } from "@/components/dashboard/service-form";
import { ServiceListItem } from "@/components/dashboard/service-list-item";
import { ServicesPageEffects } from "@/components/dashboard/services-page-effects";
import { ProductChangePanel } from "@/components/dashboard/product-change-panel";
import { PriceRisePanel } from "@/components/dashboard/price-rise-panel";
import { ProductsBatchesPanel } from "@/components/dashboard/products-batches-panel";
import { RetestQueue } from "@/components/dashboard/retest-queue";
import {
  addCategoryAction,
  deleteCategoryAction,
  deleteServiceAction,
  setServicePhotoAction,
  removeServicePhotoAction,
  addAddonAction,
  deleteAddonAction,
} from "../actions";
import type { Booking, Client, Product, ProductChangeRetest, ServiceAddon, ServiceCategory, Service, Tech } from "@/lib/db/types";
import type { batchSummaries } from "@/lib/product-batches";

type ServicesData = {
  categories: ServiceCategory[];
  services: Service[];
  addons: ServiceAddon[];
  photoByService: Record<string, string>;
  retests: ProductChangeRetest[];
  clients: Client[];
  bookings: Booking[];
  products: Product[];
  batchSummaries: Awaited<ReturnType<typeof batchSummaries>>;
  tech: Tech;
};

export default function ServicesPage() {
  return (
    <AsyncDashboardPage<ServicesData> pageKey="services">
      {(data) => <ServicesView {...data} />}
    </AsyncDashboardPage>
  );
}

function ServicesView({
  categories,
  services,
  addons,
  photoByService,
  retests,
  clients,
  bookings,
  products,
  batchSummaries: batchSummary,
  tech,
}: ServicesData) {
  const searchParams = useSearchParams();
  const open = searchParams.get("open") ?? undefined;
  const [openServiceId, setOpenServiceId] = useState<string | null>(open ?? null);
  const collapseTools = services.length >= 3;

  useEffect(() => {
    if (open) setOpenServiceId(open);
  }, [open]);

  const toggleService = (id: string) => {
    setOpenServiceId((current) => (current === id ? null : id));
  };
  const priceRiseDone = searchParams.get("pricerise");
  const retestDone = searchParams.get("retest");
  const retestErr = searchParams.get("retesterr");
  const affected = searchParams.get("affected");
  const notified = searchParams.get("notified");
  const productDone = searchParams.get("product");
  const batchDone = searchParams.get("batch");
  const catById = Object.fromEntries(categories.map((c) => [c.id, c.name]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Services</h1>
        <p className="text-sm text-ink-soft">Set prices, deposits, patch-test rules and infill windows.</p>
      </div>

      {retestDone && (
        <div className="flex items-start gap-2 rounded-xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Product change recorded. {affected ?? "0"} client{(affected === "1" ? "" : "s")} affected,{" "}
            {notified ?? "0"} notified by email or SMS.
          </span>
        </div>
      )}
      {retestErr && (
        <div className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-300">{retestErr}</div>
      )}
      {productDone && (
        <div className="flex items-start gap-2 rounded-xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Product added to your catalog.</span>
        </div>
      )}
      {batchDone && (
        <div className="flex items-start gap-2 rounded-xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>New batch opened. You can link it when recording patch tests or completing appointments.</span>
        </div>
      )}
      {priceRiseDone && (
        <div className="flex items-start gap-2 rounded-xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Menu prices updated. Share the announcement copy with your clients when you&apos;re ready.</span>
        </div>
      )}

      <ServicesPageEffects />

      {services.some((s) => s.active) && (
        <details className="card" open={!collapseTools}>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 [&::-webkit-details-marker]:hidden">
            <span className="font-medium">Price rise assistant</span>
            <span className="text-xs text-ink-faint">Tap to {collapseTools ? "open" : "collapse"}</span>
          </summary>
          <div className="border-t border-edge p-5">
            <PriceRisePanel services={services} tech={tech} />
          </div>
        </details>
      )}

      {categories.length > 0 && (
        <details className="card" open={!collapseTools}>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 [&::-webkit-details-marker]:hidden">
            <span className="font-medium">Product change &amp; re-tests</span>
            <span className="text-xs text-ink-faint">Tap to open</span>
          </summary>
          <div className="border-t border-edge p-5">
            <ProductChangePanel categories={categories} services={services} products={products} />
          </div>
        </details>
      )}

      {categories.length > 0 && (
        <details className="card" open={!collapseTools}>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 [&::-webkit-details-marker]:hidden">
            <span className="font-medium">Products &amp; batches</span>
            <span className="text-xs text-ink-faint">Tap to open</span>
          </summary>
          <div className="border-t border-edge p-5">
            <ProductsBatchesPanel
              categories={categories}
              products={products}
              batchSummaries={batchSummary}
            />
          </div>
        </details>
      )}

      <details className="card" open={!collapseTools && retests.length > 0}>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 [&::-webkit-details-marker]:hidden">
          <span className="font-medium">Re-test queue ({retests.length})</span>
          <span className="text-xs text-ink-faint">Tap to open</span>
        </summary>
        <div className="border-t border-edge p-5">
          <RetestQueue retests={retests} clients={clients} categories={categories} bookings={bookings} />
        </div>
      </details>

      <details className="card" open={categories.length === 0}>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4">
          <span className="flex items-center gap-2 font-medium"><FolderPlus className="h-5 w-5 text-brand-400" /> Add a category</span>
          <span className="text-xs text-ink-faint">Tap to open</span>
        </summary>
        <div className="border-t border-edge p-5">
          <p className="mb-3 text-sm text-ink-soft">Categories hold patch-test rules (e.g. Lashes, Brows).</p>
          <form action={addCategoryAction} className="grid gap-3 sm:grid-cols-3">
            <div><Label>Category name</Label><Input name="name" placeholder="Lashes" required /></div>
            <div>
              <Label>A patch test lasts (days)</Label>
              <Input name="validityDays" type="number" defaultValue={180} />
              <p className="mt-1 text-xs text-ink-faint">After this many days, the client needs a new test.</p>
            </div>
            <div>
              <Label>Test needed how long before the appointment? (hours)</Label>
              <Input name="minLeadHours" type="number" min={0} defaultValue={24} />
              <p className="mt-1 text-xs text-ink-faint">e.g. 24 = the test must be done at least a day before, so reactions have time to show.</p>
            </div>
            <div className="sm:col-span-3">
              <SubmitButton size="lg" className="w-full" pendingLabel="Adding your category…">
                <Plus className="h-5 w-5" /> Add category
              </SubmitButton>
            </div>
          </form>
          {categories.length > 0 && (
            <div className="mt-4 space-y-2">
              {categories.map((c) => {
                const count = services.filter((s) => s.categoryId === c.id).length;
                return (
                  <div key={c.id} className="flex items-center justify-between gap-2 rounded-xl border border-edge bg-white/[0.03] px-3 py-2 text-sm">
                    <span>{c.name} <span className="text-ink-faint">· patch test {c.patchTestValidityDays}d · {count} service{count === 1 ? "" : "s"}</span></span>
                    <form action={deleteCategoryAction}>
                      <input type="hidden" name="id" value={c.id} />
                      <button
                        type="submit"
                        className="grid h-8 w-8 place-items-center rounded-lg text-ink-faint hover:bg-red-500/10 hover:text-red-400"
                        title={count > 0 ? `Deletes the category AND its ${count} service(s)` : "Delete category"}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </form>
                  </div>
                );
              })}
              <p className="text-xs text-ink-faint">Deleting a category also deletes the services inside it.</p>
            </div>
          )}
        </div>
      </details>

      <details className="card">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4">
          <span className="flex items-center gap-2 font-medium"><Plus className="h-5 w-5 text-brand-400" /> Add a service</span>
          <span className="text-xs text-ink-faint">Tap to open</span>
        </summary>
        <div className="border-t border-edge p-5">
          {categories.length === 0 ? (
            <p className="text-sm text-ink-faint">You need at least one category before adding services.</p>
          ) : (
            <>
              <p className="mb-3 text-sm text-ink-soft">New services appear on your booking page immediately.</p>
              <ServiceForm categories={categories} />
            </>
          )}
        </div>
      </details>

      <Card>
        <CardHeader>
          <CardTitle>Your services ({services.length})</CardTitle>
          <CardDescription>Tap a service name to open it — only one open at a time. Drag the handle to reorder.</CardDescription>
        </CardHeader>
        <CardContent>
          <ServiceSortableList
            services={services}
            renderService={(s) => (
              <ServiceListItem
                serviceId={s.id}
                isOpen={openServiceId === s.id}
                onToggle={() => toggleService(s.id)}
                summary={
                  <>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{s.name}</span>
                        {!s.active && <Badge tone="neutral">Hidden</Badge>}
                        {s.isInfill && (
                          <Badge tone="purple">
                            <RefreshCw className="h-3 w-3" /> Infill ≤{s.infillMaxGapDays}d
                          </Badge>
                        )}
                        {s.requiresPatchTest && (
                          <Badge tone="amber">
                            <ShieldCheck className="h-3 w-3" /> Patch test
                          </Badge>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-ink-faint">
                        {catById[s.categoryId]} · {minutesToLabel(s.durationMin)} · {gbp(s.pricePennies)} ·{" "}
                        {depositFor(s) > 0 ? `${gbp(depositFor(s))} deposit` : "no deposit"}
                      </p>
                    </div>
                  </>
                }
              >
                <ServiceForm service={s} categories={categories} />

                <div className="mt-4 border-t border-edge pt-4">
                  <p className="mb-2 flex items-center gap-1.5 text-sm font-medium"><ImagePlus className="h-4 w-4 text-brand-400" /> Photo on your booking page</p>
                  <div className="flex flex-wrap items-center gap-3">
                    {photoByService[s.id] && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={photoByService[s.id]} alt={s.name} className="h-16 w-16 rounded-xl object-cover" />
                    )}
                    <form action={setServicePhotoAction} className="flex flex-wrap items-center gap-2">
                      <input type="hidden" name="serviceId" value={s.id} />
                      <input type="file" name="photo" accept="image/*" required className="text-xs text-ink-soft file:mr-2 file:rounded-lg file:border-0 file:bg-brand-500/15 file:px-3 file:py-2 file:text-xs file:font-medium file:text-brand-300" />
                      <SubmitButton size="sm" pendingLabel="Uploading…">{photoByService[s.id] ? "Replace" : "Upload"}</SubmitButton>
                    </form>
                    {photoByService[s.id] && (
                      <form action={removeServicePhotoAction}>
                        <input type="hidden" name="serviceId" value={s.id} />
                        <Button type="submit" variant="ghost" size="sm" className="text-red-400 hover:bg-red-500/10">Remove</Button>
                      </form>
                    )}
                  </div>
                </div>

                <div className="mt-4 border-t border-edge pt-4">
                  <p className="mb-2 flex items-center gap-1.5 text-sm font-medium"><Sparkles className="h-4 w-4 text-brand-400" /> Extras clients can add</p>
                  <div className="space-y-2">
                    {addons.filter((a) => a.serviceId === s.id).map((a) => (
                      <div key={a.id} className="flex items-center justify-between gap-3 rounded-xl border border-edge bg-white/[0.03] px-4 py-2.5 text-sm">
                        <span>{a.name} <span className="text-ink-faint">+{gbp(a.pricePennies)}</span></span>
                        <form action={deleteAddonAction}>
                          <input type="hidden" name="id" value={a.id} />
                          <input type="hidden" name="serviceId" value={s.id} />
                          <button type="submit" className="grid h-8 w-8 place-items-center rounded-lg text-ink-faint hover:bg-red-500/10 hover:text-red-400"><Trash2 className="h-3.5 w-3.5" /></button>
                        </form>
                      </div>
                    ))}
                    <form action={addAddonAction} className="flex flex-wrap items-end gap-2">
                      <input type="hidden" name="serviceId" value={s.id} />
                      <div className="min-w-32 flex-1"><Label>Extra name</Label><Input name="name" placeholder="Wispy" required /></div>
                      <div className="w-28"><Label>Price (£)</Label><Input name="pricePounds" type="number" min={0} step="0.01" placeholder="5.00" required /></div>
                      <SubmitButton pendingLabel="Adding…">
                        <Plus className="h-4 w-4" /> Add extra
                      </SubmitButton>
                    </form>
                  </div>
                </div>

                <form action={deleteServiceAction} className="mt-4 border-t border-edge pt-3">
                  <input type="hidden" name="id" value={s.id} />
                  <Button type="submit" variant="ghost" size="sm" className="text-red-400 hover:bg-red-500/10">
                    <Trash2 className="h-4 w-4" /> Delete service
                  </Button>
                  <p className="mt-1 text-xs text-ink-faint">
                    Also removes any imported appointments linked to this service.
                  </p>
                </form>
              </ServiceListItem>
            )}
          />
        </CardContent>
      </Card>
    </div>
  );
}
