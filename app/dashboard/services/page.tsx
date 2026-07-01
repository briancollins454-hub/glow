import { redirect } from "next/navigation";
import { Plus, Trash2, ShieldCheck, RefreshCw, FolderPlus } from "lucide-react";
import { getDashboardContext } from "@/lib/auth/session";
import { listCategories, listServices } from "@/lib/db/queries";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { gbp, minutesToLabel } from "@/lib/format";
import { depositFor } from "@/lib/rules";
import { ServiceForm } from "@/components/dashboard/service-form";
import { addCategoryAction, deleteServiceAction } from "../actions";

export default async function ServicesPage() {
  const c = await getDashboardContext();
  if (!c) redirect("/login");
  const { sb, tech } = c;
  const [categories, services] = await Promise.all([listCategories(sb, tech.id), listServices(sb, tech.id)]);
  const fullSets = services.filter((s) => !s.isInfill);
  const catById = new Map(categories.map((c) => [c.id, c.name]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Services</h1>
        <p className="text-sm text-ink-soft">Set prices, deposits, patch-test rules and infill windows.</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><FolderPlus className="h-5 w-5 text-brand-600" /> Add a category</CardTitle>
            <CardDescription>Categories hold patch-test defaults (e.g. Lashes, Brows).</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={addCategoryAction} className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2"><Label>Category name</Label><Input name="name" placeholder="Lashes" required /></div>
              <div><Label>Patch test valid for (days)</Label><Input name="validityDays" type="number" defaultValue={180} /></div>
              <div><Label>Min lead before appt (hours)</Label><Input name="minLeadHours" type="number" defaultValue={24} /></div>
              <div className="sm:col-span-2"><Button type="submit" variant="secondary" className="w-full"><Plus className="h-4 w-4" /> Add category</Button></div>
            </form>
            {categories.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {categories.map((c) => <Badge key={c.id} tone="brand">{c.name} · {c.patchTestValidityDays}d</Badge>)}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Plus className="h-5 w-5 text-brand-600" /> Add a service</CardTitle>
            <CardDescription>{categories.length === 0 ? "Add a category first." : "New services appear on your booking page immediately."}</CardDescription>
          </CardHeader>
          <CardContent>
            {categories.length === 0 ? (
              <p className="text-sm text-ink-faint">You need at least one category before adding services.</p>
            ) : (
              <ServiceForm categories={categories} fullSetOptions={fullSets} />
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your services ({services.length})</CardTitle>
          <CardDescription>Click a service to edit it.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {services.length === 0 && <p className="text-sm text-ink-faint">No services yet.</p>}
          {services.map((s) => (
            <details key={s.id} className="group rounded-xl border border-black/5 bg-cream">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{s.name}</span>
                    {!s.active && <Badge tone="neutral">Hidden</Badge>}
                    {s.isInfill && <Badge tone="purple"><RefreshCw className="h-3 w-3" /> Infill ≤{s.infillMaxGapDays}d</Badge>}
                    {s.requiresPatchTest && <Badge tone="amber"><ShieldCheck className="h-3 w-3" /> Patch test</Badge>}
                  </div>
                  <p className="mt-0.5 text-xs text-ink-faint">
                    {catById.get(s.categoryId)} · {minutesToLabel(s.durationMin)} · {gbp(s.pricePennies)} · {depositFor(s) > 0 ? `${gbp(depositFor(s))} deposit` : "no deposit"}
                  </p>
                </div>
                <span className="text-xs font-medium text-brand-600 group-open:hidden">Edit</span>
              </summary>
              <div className="border-t border-black/5 p-4">
                <ServiceForm service={s} categories={categories} fullSetOptions={fullSets} />
                <form action={deleteServiceAction} className="mt-3 border-t border-black/5 pt-3">
                  <input type="hidden" name="id" value={s.id} />
                  <Button type="submit" variant="ghost" size="sm" className="text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /> Delete service</Button>
                </form>
              </div>
            </details>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
