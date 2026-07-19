import { SubmitButton } from "@/components/ui/submit-button";
import { DepositFields } from "@/components/dashboard/deposit-fields";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { ImageFileInput } from "@/components/ui/image-file-input";
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
  const saveButton = (
    <SubmitButton size={s ? "md" : "lg"} pendingLabel={s ? "Saving your changes…" : "Adding your service…"}>
      {s ? "Save changes" : "Add service"}
    </SubmitButton>
  );

  return (
    <form action={saveServiceAction} className="grid gap-4 sm:grid-cols-2">
      {s && <input type="hidden" name="id" value={s.id} />}

      {s && (
        <div className="flex items-center justify-between gap-3 sm:col-span-2">
          <p className="text-sm text-ink-soft">Edit this service, then save.</p>
          {saveButton}
        </div>
      )}

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

      <DepositFields
        defaultType={s?.depositType ?? "percent"}
        defaultValue={
          s
            ? s.depositType === "fixed"
              ? (s.depositValue / 100).toFixed(2)
              : String(s.depositValue)
            : "30"
        }
      />

      <label className="flex items-center gap-2.5 rounded-xl border border-edge bg-cream px-4 py-3 text-sm">
        <input type="checkbox" name="requiresPatchTest" defaultChecked={s?.requiresPatchTest} className="h-4 w-4 rounded border-black/20 text-brand-400 focus:ring-brand-300" />
        Requires a valid patch test
      </label>

      <label className="flex items-center gap-2.5 rounded-xl border border-edge bg-cream px-4 py-3 text-sm sm:col-span-2">
        <input type="checkbox" name="isPatchTestService" defaultChecked={s?.isPatchTestService} className="h-4 w-4 rounded border-black/20 text-brand-400 focus:ring-brand-300" />
        <span>
          <span className="font-medium">This is the patch test appointment</span>
          <span className="mt-0.5 block text-xs text-ink-faint">
            Hidden from your public menu. Clients book it automatically when pairing with a treatment.
          </span>
        </span>
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

      {!s && (
        <div className="sm:col-span-2">
          <Label>Photo for your booking page (optional)</Label>
          <ImageFileInput
            name="photo"
            maxDimension={1600}
            className="input h-auto py-2 text-sm file:mr-2 file:rounded-lg file:border-0 file:bg-brand-500/15 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-brand-300"
          />
          <p className="mt-1 text-xs text-ink-faint">Shows next to the service on your booking page. You can add or change it later too.</p>
        </div>
      )}

      <div className="sm:col-span-2">
        <Label>Pre-care instructions (sent before the appointment)</Label>
        <Textarea
          name="precareText"
          defaultValue={s?.precareText}
          placeholder="e.g. Arrive with clean lashes, no mascara or oils. Avoid caffeine 2 hours before. Wear comfortable clothing…"
        />
        <p className="mt-1 text-xs text-ink-faint">
          Sent 48 hours before the appointment. Clients confirm via a one-tap link. Leave blank to skip.
        </p>
      </div>

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

      <div className="sticky bottom-0 z-10 -mx-4 flex items-center justify-between gap-3 border-t border-edge bg-cream/95 px-4 py-3 backdrop-blur-sm sm:col-span-2 sm:-mx-0 sm:rounded-xl sm:border sm:px-4">
        <label className="flex items-center gap-2.5 text-sm">
          <input type="checkbox" name="active" defaultChecked={s ? s.active : true} className="h-4 w-4 rounded border-black/20 text-brand-400 focus:ring-brand-300" />
          Active (visible on booking page)
        </label>
        {saveButton}
      </div>
    </form>
  );
}
