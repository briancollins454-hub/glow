"use client";

import { useCallback, useMemo, useState } from "react";
import { SubmitButton } from "@/components/ui/submit-button";
import { Input, Label, Select } from "@/components/ui/input";
import { ClientPicker } from "@/components/dashboard/client-picker";
import { LazyDateTimePicker } from "@/components/dashboard/lazy-date-time-picker";
import { groupServicesForDashboard } from "@/lib/booking/service-groups";
import { rowsForStaff } from "@/lib/booking/staff";
import { timeOffAppliesToStaff } from "@/lib/booking/staff-day";
import { gbp, fmtTime } from "@/lib/format";
import {
  basketDurationMin,
  bufferMapFromServices,
  daySlotsForDuration,
  flexibleHoursFromTech,
} from "@/lib/rules";
import { cn } from "@/lib/utils";
import { addManualBookingAction } from "@/app/dashboard/actions";
import type {
  Booking,
  Client,
  RotaHour,
  Service,
  ServiceAddon,
  ServiceCategory,
  StaffMember,
  Tech,
  TimeOff,
  WorkingHour,
} from "@/lib/db/types";

export function ManualBookingForm({
  services,
  categories,
  clients,
  staff = [],
  addons = [],
  bookings = [],
  offs = [],
  hoursByStaff = {},
  rotaHours = [],
  tech,
}: {
  services: Service[];
  categories: ServiceCategory[];
  clients: Client[];
  staff?: StaffMember[];
  addons?: ServiceAddon[];
  bookings?: Booking[];
  offs?: TimeOff[];
  hoursByStaff?: Record<string, WorkingHour[]>;
  rotaHours?: RotaHour[];
  tech?: Pick<
    Tech,
    | "flexibleHoursEnabled"
    | "flexibleStartMinutes"
    | "flexibleEndMinutes"
    | "flexibleLastStartMinutes"
  > | null;
}) {
  const activeServices = useMemo(() => services.filter((s) => s.active), [services]);
  const groups = useMemo(
    () => groupServicesForDashboard(categories, activeServices),
    [categories, activeServices],
  );
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const defaultStaffId = staff[0]?.id ?? "";
  const [staffId, setStaffId] = useState(defaultStaffId);

  const selectedServices = useMemo(
    () =>
      selectedIds
        .map((id) => activeServices.find((s) => s.id === id))
        .filter((s): s is Service => !!s),
    [selectedIds, activeServices],
  );

  // Add-ons attach to the primary (first) treatment, matching online baskets.
  const primaryId = selectedServices[0]?.id ?? "";
  const primaryAddons = useMemo(
    () => addons.filter((a) => a.serviceId === primaryId && a.active),
    [addons, primaryId],
  );

  const totalMins = selectedServices.reduce((sum, s) => sum + s.durationMin, 0);
  const totalPennies = selectedServices.reduce((sum, s) => sum + s.pricePennies, 0);
  const bufferByServiceId = useMemo(() => bufferMapFromServices(activeServices), [activeServices]);
  const flexibleHours = useMemo(() => flexibleHoursFromTech(tech), [tech]);

  const timesForDate = useCallback(
    (dateStr: string) => {
      if (selectedServices.length === 0) return [];
      const duration = basketDurationMin(selectedServices);
      const member = staff.find((s) => s.id === staffId) ?? staff[0] ?? null;
      const workingHours = member ? (hoursByStaff[member.id] ?? []) : [];
      const scopedBookings = member
        ? rowsForStaff(bookings, member)
        : bookings.filter((b) => !b.staffId);
      const scopedOffs = member ? timeOffAppliesToStaff(offs, member.id) : offs;
      const scopedRota = member ? rowsForStaff(rotaHours, member) : [];
      const slots = daySlotsForDuration(duration, dateStr, {
        workingHours,
        timeOff: scopedOffs,
        bookings: scopedBookings,
        flexibleHours,
        rotaHours: scopedRota,
        bufferByServiceId,
      }, 0);
      return slots.map((iso) => fmtTime(iso));
    },
    [
      selectedServices,
      staff,
      staffId,
      hoursByStaff,
      bookings,
      offs,
      rotaHours,
      flexibleHours,
      bufferByServiceId,
    ],
  );

  function toggleService(id: string) {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      return [...prev, id];
    });
  }

  return (
    <form action={addManualBookingAction} className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Label>Existing client</Label>
        <ClientPicker clients={clients} name="clientId" />
      </div>

      <div className="sm:col-span-2">
        <Label>Services</Label>
        <p className="mb-2 text-xs text-ink-faint">
          Tick one or more. Multiple treatments book back-to-back in one visit (first is the
          primary for extras and payment).
        </p>
        <div className="max-h-56 overflow-y-auto rounded-xl border border-edge bg-fill">
          {groups.length === 0 ? (
            <p className="px-3.5 py-3 text-sm text-ink-faint">No active services yet.</p>
          ) : (
            groups.map((group) => (
              <div key={group.id}>
                <div className="sticky top-0 border-b border-edge bg-surface/95 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-faint backdrop-blur-sm">
                  {group.title}
                </div>
                <ul>
                  {group.services.map((s) => {
                    const checked = selectedIds.includes(s.id);
                    return (
                      <li key={s.id}>
                        <label
                          className={cn(
                            "flex cursor-pointer items-center justify-between gap-3 px-3.5 py-2.5 text-sm transition",
                            checked ? "bg-brand-500/15 text-ink" : "text-ink-soft hover:bg-fill-hover",
                          )}
                        >
                          <span className="flex min-w-0 items-center gap-2.5">
                            <input
                              type="checkbox"
                              name="serviceId"
                              value={s.id}
                              checked={checked}
                              onChange={() => toggleService(s.id)}
                              className="h-4 w-4 rounded border-edge text-brand-400 focus:ring-brand-300"
                            />
                            <span className="truncate font-medium">{s.name}</span>
                          </span>
                          <span className="shrink-0 text-xs text-ink-faint">
                            {s.durationMin}m · {gbp(s.pricePennies)}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          )}
        </div>
        {selectedServices.length > 0 && (
          <p className="mt-2 text-xs text-ink-faint">
            {selectedServices.length} treatment{selectedServices.length === 1 ? "" : "s"} ·{" "}
            {totalMins} mins · {gbp(totalPennies)}
            {selectedServices.length > 1
              ? ` · order: ${selectedServices.map((s) => s.name).join(" → ")}`
              : ""}
          </p>
        )}
        {selectedServices.length === 0 && (
          <p className="mt-2 text-xs text-ink-faint">Choose at least one service.</p>
        )}
      </div>

      {primaryAddons.length > 0 && (
        <div className="sm:col-span-2 rounded-xl border border-edge bg-cream px-4 py-3">
          <p className="text-sm font-medium text-ink">Extras for {selectedServices[0]?.name}</p>
          <p className="mt-0.5 text-xs text-ink-faint">Added to the price (same as online booking).</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {primaryAddons.map((a) => (
              <label
                key={a.id}
                className="flex items-center gap-2 rounded-lg border border-edge bg-surface/60 px-3 py-2 text-sm"
              >
                <input
                  type="checkbox"
                  name={`addon_${a.id}`}
                  className="h-4 w-4 rounded border-edge text-brand-400 focus:ring-brand-300"
                />
                {a.name}
                <span className="text-ink-faint">+{gbp(a.pricePennies)}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {staff.length > 1 && (
        <div>
          <Label>With</Label>
          <Select
            name="staffId"
            value={staffId}
            onChange={(e) => setStaffId(e.target.value)}
          >
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </div>
      )}
      {staff.length === 1 && staff[0] && (
        <input type="hidden" name="staffId" value={staff[0].id} />
      )}

      <div>
        <Label>New client name</Label>
        <Input name="clientName" placeholder="(if new)" />
      </div>
      <div>
        <Label>Email</Label>
        <Input name="clientEmail" type="email" placeholder="(optional)" />
      </div>
      <div>
        <Label>Phone</Label>
        <Input name="clientPhone" placeholder="(optional)" />
      </div>
      <p className="text-xs text-ink-faint sm:col-span-2">
        Add an email or mobile if you want them to get confirmations and reminders — without one,
        those are skipped.
      </p>
      <div className="sm:col-span-2">
        <Label>Date &amp; time</Label>
        {selectedServices.length === 0 ? (
          <p className="rounded-xl border border-edge bg-fill px-3.5 py-3 text-sm text-ink-faint">
            Choose a service first — times only show when that person is free and working.
          </p>
        ) : (
          <>
            <LazyDateTimePicker
              name="startsAt"
              timesForDate={timesForDate}
              emptyTimesHint="No free times — they may be fully booked or not working that day"
            />
            <p className="mt-1.5 text-xs text-ink-faint">
              Times match working hours and skip slots that already have an appointment.
            </p>
          </>
        )}
      </div>
      <div>
        <Label>Deposit for this booking (£)</Label>
        <Input
          name="depositPounds"
          type="number"
          min={0}
          step="0.01"
          placeholder="Blank = service default, 0 = none"
        />
      </div>
      <div>
        <Label>Payment taken?</Label>
        <Select name="paymentTaken" defaultValue="none">
          <option value="none">Nothing yet</option>
          <option value="deposit">Deposit taken</option>
          <option value="full">Paid in full</option>
        </Select>
      </div>
      <div>
        <Label>How was it paid?</Label>
        <Select name="paymentMethod" defaultValue="cash">
          <option value="cash">Cash</option>
          <option value="bank_transfer">Bank transfer</option>
          <option value="paypal">PayPal</option>
          <option value="card_machine">Card machine</option>
          <option value="other">Other</option>
        </Select>
      </div>
      <div className="sm:col-span-2">
        <SubmitButton variant="secondary" pendingLabel="Adding…" disabled={selectedServices.length === 0}>
          Add booking
        </SubmitButton>
      </div>
    </form>
  );
}
