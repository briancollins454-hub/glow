"use client";

import Link from "next/link";
import { useState } from "react";
import { formatInTimeZone } from "date-fns-tz";
import {
  ArrowLeft,
  Calendar,
  AlertTriangle,
  Lock,
  ShieldCheck,
  RefreshCw,
  Clock,
} from "lucide-react";
import type { ConsultationQuestion, Service, ServiceAddon, Tech } from "@/lib/db/types";
import { SubmitButton } from "@/components/ui/submit-button";
import { YesNoQuestion } from "@/components/booking/yesno-question";
import { DateSlotPicker } from "@/components/booking/date-slot-picker";
import { RemoteImage } from "@/components/ui/remote-image";
import { gbp, minutesToLabel, TZ } from "@/lib/format";
import { depositFor } from "@/lib/rules";
import { withAlpha } from "@/lib/booking/brand";
import { createPublicBookingAction, joinWaitlistAction } from "@/app/[handle]/actions";

type DayOption = { dateStr: string; slots: string[] };

const ERR: Record<string, string> = {
  missing: "Please fill in your name and email.",
  slot: "Sorry, that time was just taken. Please pick another slot.",
  not_live: "This studio isn't accepting online bookings just yet. Please check back soon.",
  blocked: "We can't complete this booking online. Please contact the studio directly.",
  patch: "This service needs a valid patch test on file. Please get in touch to arrange one first.",
  infill: "Infills are only available to returning clients within the rebooking window. Please book a full set instead.",
  form: "Please complete the required questions and agree to the booking policy.",
};

export function BookingStepInteractive({
  tech,
  service,
  brand,
  days,
  live,
  questions,
  addons,
  err,
  wl,
  initialDate,
  initialSlot,
  photoUrl,
}: {
  tech: Tech;
  service: Service;
  brand: string;
  days: DayOption[];
  live: boolean;
  questions: ConsultationQuestion[];
  addons: ServiceAddon[];
  err?: string;
  wl?: string;
  initialDate?: string;
  initialSlot?: string;
  photoUrl?: string;
}) {
  const deposit = depositFor(service);
  const balance = Math.max(0, service.pricePennies - deposit);
  const [slot, setSlot] = useState(initialSlot ?? "");
  const step = !slot ? 1 : 2;

  return (
    <div className="space-y-6 animate-fade-in">
      <Link
        href={`/${tech.handle}`}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-soft transition hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" /> All services
      </Link>

      {/* Service summary card */}
      <div className="overflow-hidden rounded-2xl border border-edge bg-surface/90 shadow-card">
        {photoUrl && (
          <div className="relative aspect-[21/9] w-full overflow-hidden">
            <RemoteImage
              src={photoUrl}
              alt={service.name}
              fill
              className="object-cover"
              sizes="640px"
            />
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(180deg, transparent 30%, ${withAlpha("#0b0910", 0.85)} 100%)`,
              }}
            />
          </div>
        )}
        <div className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-ink-faint">
                You&apos;re booking
              </p>
              <h2 className="mt-1 font-display text-2xl font-semibold leading-tight text-ink sm:text-3xl">
                {service.name}
              </h2>
              {service.description && (
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">{service.description}</p>
              )}
            </div>
            <div className="shrink-0 text-right">
              <p className="font-display text-2xl font-semibold text-ink">
                {gbp(service.pricePennies)}
              </p>
              <p className="mt-0.5 flex items-center justify-end gap-1 text-xs text-ink-faint">
                <Clock className="h-3.5 w-3.5" />
                {minutesToLabel(service.durationMin)}
              </p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2 rounded-xl border border-edge bg-cream/50 p-3 text-sm sm:gap-3 sm:p-4">
            <Stat label="Deposit now" value={deposit > 0 ? gbp(deposit) : "None"} highlight={deposit > 0} brand={brand} />
            <Stat label="Balance on the day" value={gbp(balance)} />
            <Stat label="Cancellation" value={`${tech.cancellationWindowHours}h notice`} />
          </div>

          {(service.requiresPatchTest || service.isInfill) && (
            <div className="mt-4 space-y-2">
              {service.requiresPatchTest && (
                <Notice tone="amber" icon={<ShieldCheck className="h-4 w-4" />}>
                  A valid patch test is required before this service.
                </Notice>
              )}
              {service.isInfill && (
                <Notice tone="violet" icon={<RefreshCw className="h-4 w-4" />}>
                  Infills are for returning clients within {service.infillMaxGapDays} days of their
                  last appointment.
                </Notice>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-3 text-sm">
        <StepDot n={1} label="Pick a time" active={step >= 1} done={step > 1} brand={brand} />
        <div className="h-px flex-1 bg-edge" />
        <StepDot n={2} label="Your details" active={step >= 2} done={false} brand={brand} />
      </div>

      {err && ERR[err] && (
        <Notice tone="red" icon={<AlertTriangle className="h-4 w-4" />}>
          {ERR[err]}
        </Notice>
      )}

      {!live && (
        <Notice tone="amber" icon={<AlertTriangle className="h-4 w-4" />}>
          This studio isn&apos;t accepting online bookings just yet. Please check back soon.
        </Notice>
      )}

      {wl === "1" && (
        <Notice tone="amber" icon={<Calendar className="h-4 w-4" />}>
          You&apos;re on the cancellation list! We&apos;ll email you the moment a slot frees up.
        </Notice>
      )}

      {live &&
        (days.length === 0 ? (
          <div className="rounded-2xl border border-edge bg-surface/80 p-8 text-center text-sm text-ink-soft">
            No available times in the next two weeks. Please check back soon.
          </div>
        ) : (
          <div className="rounded-2xl border border-edge bg-surface/80 p-5 sm:p-6">
            <h3 className="font-display text-lg font-semibold text-ink">Choose your appointment</h3>
            <p className="mt-1 text-sm text-ink-soft">Pick a date and time that works for you.</p>
            <DateSlotPicker
              days={days}
              initialDate={initialDate}
              initialSlot={initialSlot}
              brand={brand}
              onSlotChange={setSlot}
            />
          </div>
        ))}

      {live && wl !== "1" && (
        <details className="rounded-2xl border border-edge bg-surface/80">
          <summary className="cursor-pointer list-none p-4 text-sm font-medium text-ink-soft [&::-webkit-details-marker]:hidden">
            Can&apos;t see a time that works?{" "}
            <span style={{ color: brand }}>Join the cancellation list</span>
          </summary>
          <form action={joinWaitlistAction} className="space-y-3 border-t border-edge p-4 sm:p-5">
            <input type="hidden" name="handle" value={tech.handle} />
            <input type="hidden" name="serviceId" value={service.id} />
            <p className="text-sm text-ink-soft">
              Leave your details and we&apos;ll email you the moment someone cancels.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <input name="name" required placeholder="Full name *" className="input" />
              <input name="email" type="email" required placeholder="Email *" className="input" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <input name="phone" placeholder="Mobile number" className="input" />
              <div>
                <input name="date" type="date" className="input" />
                <p className="mt-1 text-xs text-ink-faint">
                  Only want a certain day? Pick it — or leave blank for any day.
                </p>
              </div>
            </div>
            <SubmitButton
              className="w-full bg-none py-3 font-semibold shadow-none"
              style={{ backgroundColor: brand }}
              pendingLabel="Adding you…"
            >
              Join the cancellation list
            </SubmitButton>
          </form>
        </details>
      )}

      {live && slot && (
        <div className="rounded-2xl border border-edge bg-surface/80 p-5 sm:p-6">
          <h3 className="font-display text-lg font-semibold text-ink">Your details</h3>
          <p className="mt-1 text-sm text-ink-soft">
            Booking <strong className="text-ink">{service.name}</strong> on{" "}
            <strong className="text-ink">
              {formatInTimeZone(new Date(slot), TZ, "EEE d MMM 'at' HH:mm")}
            </strong>
          </p>
          <form action={createPublicBookingAction} className="mt-5 space-y-4">
            <input type="hidden" name="handle" value={tech.handle} />
            <input type="hidden" name="serviceId" value={service.id} />
            <input type="hidden" name="slot" value={slot} />
            <div className="grid gap-3 sm:grid-cols-2">
              <input name="name" required placeholder="Full name *" className="input" />
              <input name="email" type="email" required placeholder="Email *" className="input" />
            </div>
            <input name="phone" placeholder="Mobile number" className="input" />

            {addons.length > 0 && (
              <div className="space-y-2 border-t border-edge pt-4">
                <p className="text-sm font-medium text-ink">Extras (optional)</p>
                {addons.map((a) => (
                  <label
                    key={a.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-edge bg-white/[0.03] px-4 py-3 text-sm transition hover:border-white/15"
                  >
                    <span className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        name={`addon_${a.id}`}
                        className="h-4 w-4 rounded border-white/20 text-brand-400 focus:ring-brand-300"
                      />
                      {a.name}
                    </span>
                    <span className="font-medium">+{gbp(a.pricePennies)}</span>
                  </label>
                ))}
                <p className="text-xs text-ink-faint">Extras are added to your balance on the day.</p>
              </div>
            )}

            {questions.length > 0 && (
              <div className="space-y-3 border-t border-edge pt-4">
                <p className="text-sm font-medium text-ink">A few quick questions</p>
                {questions.map((q) => (
                  <div key={q.id}>
                    <label className="mb-1 block text-sm text-ink-soft">
                      {q.prompt}
                      {q.required && <span className="text-red-400"> *</span>}
                    </label>
                    {q.type === "longtext" ? (
                      <textarea name={`q_${q.id}`} required={q.required} className="input min-h-[70px]" />
                    ) : q.type === "yesno" ? (
                      <YesNoQuestion name={`q_${q.id}`} required={q.required} />
                    ) : (
                      <input name={`q_${q.id}`} required={q.required} className="input" />
                    )}
                  </div>
                ))}
              </div>
            )}

            <label className="flex items-start gap-2.5 text-sm text-ink-soft">
              <input
                name="policyAccepted"
                type="checkbox"
                required
                className="mt-1 h-4 w-4 rounded border-white/20 text-brand-400 focus:ring-brand-300"
              />
              <span>
                I agree to the {tech.cancellationWindowHours}h cancellation policy and Glow&apos;s{" "}
                <Link href="/terms" className="text-brand-400 underline-offset-2 hover:underline">
                  terms
                </Link>{" "}
                and{" "}
                <Link href="/privacy" className="text-brand-400 underline-offset-2 hover:underline">
                  privacy policy
                </Link>
                . My {deposit > 0 ? gbp(deposit) + " deposit" : "deposit"} secures the slot and is
                deducted from the total.
              </span>
            </label>
            <SubmitButton
              className="w-full bg-none py-3.5 text-base font-semibold shadow-soft"
              style={{ backgroundColor: brand }}
              pendingLabel="Securing your slot…"
            >
              <Lock className="h-4 w-4" />
              {deposit > 0 ? `Pay ${gbp(deposit)} deposit & book` : "Confirm booking"}
            </SubmitButton>
            {(process.env.NEXT_PUBLIC_STRIPE_TEST_MODE === "1" ||
              (process.env.STRIPE_SECRET_KEY ?? "").startsWith("sk_test")) && (
              <p className="text-center text-xs text-ink-faint">Test mode — no real payment is taken.</p>
            )}
          </form>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
  brand,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  brand?: string;
}) {
  return (
    <div>
      <p className="text-[11px] text-ink-faint sm:text-xs">{label}</p>
      <p
        className="mt-0.5 font-semibold"
        style={highlight && brand ? { color: brand } : undefined}
      >
        {value}
      </p>
    </div>
  );
}

function StepDot({
  n,
  label,
  active,
  done,
  brand,
}: {
  n: number;
  label: string;
  active: boolean;
  done: boolean;
  brand: string;
}) {
  return (
    <div className={`flex items-center gap-2 ${active ? "text-ink" : "text-ink-faint"}`}>
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
        style={
          done || active
            ? { backgroundColor: brand, color: "white" }
            : { backgroundColor: "rgba(255,255,255,0.08)", color: "inherit" }
        }
      >
        {done ? "✓" : n}
      </span>
      <span className="hidden font-medium sm:inline">{label}</span>
    </div>
  );
}

function Notice({
  tone,
  icon,
  children,
}: {
  tone: "amber" | "violet" | "red";
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const map = {
    amber: "border-amber-500/20 bg-amber-500/10 text-amber-200",
    violet: "border-violet-500/20 bg-violet-500/10 text-violet-200",
    red: "border-red-500/20 bg-red-500/10 text-red-300",
  };
  return (
    <div className={`flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm ${map[tone]}`}>
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span>{children}</span>
    </div>
  );
}
