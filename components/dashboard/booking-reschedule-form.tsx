"use client";

import { useCallback, useMemo, useState } from "react";
import { SubmitButton } from "@/components/ui/submit-button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DateTimePicker, type TimeSlotOption } from "@/components/dashboard/date-time-picker";
import { ServicePicker } from "@/components/dashboard/service-picker";
import { rowsForStaff } from "@/lib/booking/staff";
import { timeOffAppliesToStaff } from "@/lib/booking/staff-day";
import { gbp, fmtTime } from "@/lib/format";
import {
  bufferMapFromServices,
  daySlotChoicesForDuration,
  flexibleHoursFromTech,
} from "@/lib/rules";
import { rescheduleBookingAction } from "@/app/dashboard/actions";
import type {
  Booking,
  RotaHour,
  Service,
  ServiceCategory,
  StaffMember,
  Tech,
  TimeOff,
  WorkingHour,
} from "@/lib/db/types";

function clientInitial(name: string): string {
  const trimmed = name.trim();
  return trimmed ? trimmed[0]!.toUpperCase() : "?";
}

export function BookingRescheduleForm({
  booking,
  services,
  categories,
  currentLocal,
  staff = [],
  bookings = [],
  offs = [],
  hoursByStaff = {},
  rotaHours = [],
  clientById = {},
  tech = null,
  depositLocked,
}: {
  booking: Booking;
  services: Service[];
  categories: ServiceCategory[];
  currentLocal: string;
  staff?: StaffMember[];
  bookings?: Booking[];
  offs?: TimeOff[];
  hoursByStaff?: Record<string, WorkingHour[]>;
  rotaHours?: RotaHour[];
  clientById?: Record<string, string>;
  tech?: Pick<
    Tech,
    | "flexibleHoursEnabled"
    | "flexibleStartMinutes"
    | "flexibleEndMinutes"
    | "flexibleLastStartMinutes"
  > | null;
  depositLocked: boolean;
}) {
  const [serviceId, setServiceId] = useState(booking.serviceId);
  const selectedService =
    services.find((s) => s.id === serviceId) ??
    services.find((s) => s.id === booking.serviceId) ??
    null;
  const bufferByServiceId = useMemo(() => bufferMapFromServices(services), [services]);
  const flexibleHours = useMemo(() => flexibleHoursFromTech(tech), [tech]);
  const member =
    (booking.staffId ? staff.find((s) => s.id === booking.staffId) : null) ??
    staff.find((s) => s.role === "owner") ??
    staff[0] ??
    null;

  const timesForDate = useCallback(
    (dateStr: string): TimeSlotOption[] => {
      if (!selectedService) return [];
      const workingHours = member ? (hoursByStaff[member.id] ?? []) : [];
      const scopedBookings = member
        ? rowsForStaff(bookings, member)
        : bookings.filter((b) => !b.staffId);
      const scopedOffs = member ? timeOffAppliesToStaff(offs, member.id) : offs;
      const scopedRota = member ? rowsForStaff(rotaHours, member) : [];
      // Exclude this booking so moving within its own slot stays free.
      const others = scopedBookings.filter((b) => b.id !== booking.id);
      const choices = daySlotChoicesForDuration(selectedService.durationMin, dateStr, {
        workingHours,
        timeOff: scopedOffs,
        bookings: others,
        flexibleHours,
        rotaHours: scopedRota,
        bufferByServiceId,
      }, 0);
      return choices.map((c) => {
        if (!c.takenByBookingId) return { time: fmtTime(c.iso) };
        const clash = others.find((b) => b.id === c.takenByBookingId);
        const name = clash ? clientById[clash.clientId] ?? "Client" : "Client";
        return {
          time: fmtTime(c.iso),
          takenInitial: clientInitial(name),
          takenName: name,
        };
      });
    },
    [
      selectedService,
      member,
      hoursByStaff,
      bookings,
      offs,
      rotaHours,
      flexibleHours,
      bufferByServiceId,
      booking.id,
      clientById,
    ],
  );

  return (
    <form action={rescheduleBookingAction} className="space-y-4">
      <input type="hidden" name="id" value={booking.id} />
      <div>
        <Label>Service</Label>
        <ServicePicker
          name="serviceId"
          services={services}
          categories={categories}
          value={serviceId}
          onValueChange={setServiceId}
          required
        />
      </div>
      <div>
        <Label>Date &amp; time</Label>
        <DateTimePicker
          name="startsAt"
          defaultValue={currentLocal}
          timesForDate={timesForDate}
          emptyTimesHint="No times — they may be fully booked or not working that day"
        />
        <p className="mt-1.5 text-xs text-ink-faint">
          Taken times show the other client&apos;s initial. Confirm before double-booking.
        </p>
      </div>
      <div>
        <Label>Deposit for this booking (£)</Label>
        {depositLocked ? (
          <p className="rounded-xl border border-edge bg-fill px-3.5 py-2.5 text-sm text-ink-soft">
            {gbp(booking.depositPennies)} - already paid, so the amount is locked.
          </p>
        ) : (
          <>
            <Input
              name="depositPounds"
              type="number"
              min={0}
              step="0.01"
              defaultValue={(booking.depositPennies / 100).toFixed(2)}
            />
            <p className="mt-1.5 text-xs text-ink-faint">
              Set to 0 for no deposit - the client pays the full {gbp(booking.pricePennies)} on the day.
            </p>
          </>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <Label>Lash map</Label>
          <Input name="lashMap" defaultValue={booking.lashMap} placeholder="e.g. Cat eye" />
        </div>
        <div>
          <Label>Curl</Label>
          <Input name="lashCurl" defaultValue={booking.lashCurl} placeholder="e.g. C / CC / D" />
        </div>
        <div>
          <Label>Length</Label>
          <Input name="lashLength" defaultValue={booking.lashLength} placeholder="e.g. 8-12mm" />
        </div>
      </div>
      {booking.addons.length > 0 && (
        <div>
          <Label>Extras chosen</Label>
          <div className="flex flex-wrap gap-2">
            {booking.addons.map((a, i) => (
              <Badge key={i} tone="brand">
                {a.name} +{gbp(a.pricePennies)}
              </Badge>
            ))}
          </div>
        </div>
      )}
      <div>
        <Label>Notes</Label>
        <Textarea name="notes" defaultValue={booking.notes} rows={3} />
      </div>
      <SubmitButton pendingLabel="Saving…">Save changes</SubmitButton>
    </form>
  );
}
