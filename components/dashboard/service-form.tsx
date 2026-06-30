import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { saveServiceAction } from "@/app/dashboard/actions";
import type { Service, ServiceCategory } from "@/lib/db/types";

export function ServiceForm({
  service,
  categories,
  fullSetOptions,
}: {
  service?: Service;
  categories: ServiceCategory[];
  fullSetOptions: Service[];
}) {
  const s = service;
  return (
    <form action={saveServiceAction} className="grid gap-4 sm:grid-cols-2">
      {s && <input type="hidden" name="id" value={s.id} />}

      <div className="sm:col-span-2">
        <Label htmlFor={`name_${s?.id ?? "new"}`}>Service name</Label>
        <Input
          id={`name_${s?.id ?? "new"}`}
          name="name"
          defaultValue={s?.name}
          placeholder="Classic Full Set"
          required
        />
      </div>

      <div className="sm:col-span-2">
        <Label>Description</Label>
        <Textarea name="description" defaultValue={s?.description} placeholder="What's included, aftercare notes, etc." />
      </div>

      <div>
        <Label>Category</Label>
        <Select name="categoryId" defaultValue={s?.categoryId} required>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Duration (mins)</Label>
          <Input name="durationMin" type="number" min={5} step={5} defaultValue={s?.durationMin ?? 60} />
        </div>
        <div>
          <Label>Price (£)</Label>
          <Input name="price" type="text" inputMode="decimal" defaultValue={s ? (s.pricePennies / 100).toFixed(2) : ""} placeholder="55.00" />
        </div>
      </div>

      <div>
        <Label>Deposit type</Label>
        <Select name="depositType" defaultValue={s?.depositType ?? "percent"}>
          <option value="percent">Percentage</option>
          <option value="fixed">Fixed amount</option>
          <option value="none">No deposit</option>
        </Select>
      </div>
      <div>
        <Label>Deposit value</Label>
        <Input
          name="depositValue"
          type="text"
          defaultValue={
            s
              ? s.depositType === "fixed"
                ? (s.depositValue / 100).toFixed(2)
                : String(s.depositValue)
              : "30"
          }
          placeholder="30 (%) or 15.00 (£)"
        />
        <p className="mt-1 text-xs text-ink-faint">Enter a % for percentage, or £ for fixed.</p>
      </div>

      <label className="flex items-center gap-2.5 rounded-xl border border-black/5 bg-cream px-4 py-3 text-sm">
        <input type="checkbox" name="requiresPatchTest" defaultChecked={s?.requiresPatchTest} className="h-4 w-4 rounded border-black/20 text-brand-600 focus:ring-brand-300" />
        Requires a valid patch test
      </label>

      <label className="flex items-center gap-2.5 rounded-xl border border-black/5 bg-cream px-4 py-3 text-sm">
        <input type="checkbox" name="isInfill" defaultChecked={s?.isInfill} className="h-4 w-4 rounded border-black/20 text-brand-600 focus:ring-brand-300" />
        This is an infill / maintenance service
      </label>

      <div>
        <Label>Infill window (max days since last)</Label>
        <Input name="infillMaxGapDays" type="number" min={1} max={365} defaultValue={s?.infillMaxGapDays ?? 21} />
      </div>
      <div>
        <Label>Linked full set (for infills)</Label>
        <Select name="fullSetServiceId" defaultValue={s?.fullSetServiceId ?? ""}>
          <option value="">— same category, any full set —</option>
          {fullSetOptions
            .filter((o) => o.id !== s?.id)
            .map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
        </Select>
      </div>

      <div className="flex items-center justify-between sm:col-span-2">
        <label className="flex items-center gap-2.5 text-sm">
          <input type="checkbox" name="active" defaultChecked={s ? s.active : true} className="h-4 w-4 rounded border-black/20 text-brand-600 focus:ring-brand-300" />
          Active (visible on booking page)
        </label>
        <Button type="submit">{s ? "Save changes" : "Add service"}</Button>
      </div>
    </form>
  );
}
