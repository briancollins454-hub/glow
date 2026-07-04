import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { saveServiceAction } from "@/app/dashboard/actions";
import type { Service, ServiceCategory } from "@/lib/db/types";

export function ServiceForm({
  service,
  categories,
}: {
  service?: Service;
  categories: ServiceCategory[];
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
        <Label>Deposit</Label>
        <Select name="depositType" defaultValue={s?.depositType ?? "percent"}>
          <option value="fixed">Set amount (£)</option>
          <option value="percent">Percentage of price (%)</option>
          <option value="none">No deposit</option>
        </Select>
      </div>
      <div>
        <Label>Deposit amount</Label>
        <Input
          name="depositValue"
          type="text"
          inputMode="decimal"
          defaultValue={
            s
              ? s.depositType === "fixed"
                ? (s.depositValue / 100).toFixed(2)
                : String(s.depositValue)
              : "15.00"
          }
          placeholder="15.00"
        />
        <p className="mt-1 text-xs text-ink-faint">e.g. 15.00 for £15, or 30 if you chose percentage.</p>
      </div>

      <label className="flex items-center gap-2.5 rounded-xl border border-edge bg-cream px-4 py-3 text-sm">
        <input type="checkbox" name="requiresPatchTest" defaultChecked={s?.requiresPatchTest} className="h-4 w-4 rounded border-black/20 text-brand-400 focus:ring-brand-300" />
        Requires a valid patch test
      </label>

      <label className="flex items-center gap-2.5 rounded-xl border border-edge bg-cream px-4 py-3 text-sm">
        <input type="checkbox" name="isInfill" defaultChecked={s?.isInfill} className="h-4 w-4 rounded border-black/20 text-brand-400 focus:ring-brand-300" />
        This is an infill / top-up (returning clients only)
      </label>

      <div>
        <Label>Infills allowed up to (days since their last visit)</Label>
        <Input name="infillMaxGapDays" type="number" min={1} max={365} defaultValue={s?.infillMaxGapDays ?? 21} />
        <p className="mt-1 text-xs text-ink-faint">e.g. 21 = clients can only book this within 3 weeks of their last appointment.</p>
      </div>
      {s?.fullSetServiceId && <input type="hidden" name="fullSetServiceId" value={s.fullSetServiceId} />}

      <div className="sm:col-span-2">
        <Label>Aftercare instructions (emailed after the appointment)</Label>
        <Textarea
          name="aftercareText"
          defaultValue={s?.aftercareText}
          placeholder="e.g. Keep lashes dry for 24 hours. No oil-based products. Brush daily with the spoolie provided…"
        />
        <p className="mt-1 text-xs text-ink-faint">
          When you mark an appointment completed, the client gets this by email with a one-tap rebook button. Leave blank to skip.
        </p>
      </div>

      <div className="flex items-center justify-between sm:col-span-2">
        <label className="flex items-center gap-2.5 text-sm">
          <input type="checkbox" name="active" defaultChecked={s ? s.active : true} className="h-4 w-4 rounded border-black/20 text-brand-400 focus:ring-brand-300" />
          Active (visible on booking page)
        </label>
        <Button type="submit">{s ? "Save changes" : "Add service"}</Button>
      </div>
    </form>
  );
}
