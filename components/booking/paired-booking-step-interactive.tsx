"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, useTransition } from "react";
import { formatInTimeZone } from "date-fns-tz";
import {
  ArrowLeft,
  AlertTriangle,
  Lock,
  ShieldCheck,
  Clock,
  Calendar,
} from "lucide-react";
import type { ConsultationQuestion, PublicTech, Service, ServiceAddon } from "@/lib/db/types";
import { SubmitButton } from "@/components/ui/submit-button";
import { YesNoQuestion } from "@/components/booking/yesno-question";
import { DateSlotPicker } from "@/components/booking/date-slot-picker";
import { ServicePhoto } from "@/components/booking/service-photo";
import { gbp, minutesToLabel, TZ } from "@/lib/format";
import { depositFor } from "@/lib/rules";
import {
  createPairedPublicBookingAction,
  joinWaitlistAction,
  loadTreatmentSlotsAfterPatchAction,
} from "@/app/[handle]/actions";

type DayOption = { dateStr: string; slots: string[] };

const ERR: Record<string, string> = {
  missing: "Please fill in your name and email.",
  slot: "Sorry, that time was just taken. Please pick another slot.",
  pair_timing: "Your treatment must be far enough after your patch test. Please adjust your times.",
  not_live: "This studio isn't accepting online bookings just yet. Please check back soon.",
  blocked: "We can't complete this booking online. Please contact the studio directly.",
  infill: "Infills are only available to returning clients within the rebooking window. Please book a full set instead.",
  form: "Please complete the required questions and agree to the booking policy.",
  rate: "Too many attempts, try again shortly.",
};

export function PairedBookingStepInteractive({
  tech,
  treatmentService,
  patchTestService,
  brand,
  patchTestDays,
  minLeadHours,
  live,
  questions,
  addons,
  err,
  wl,
  initialPatchSlot,
  initialTreatmentSlot,
  photoUrl,
}: {
  tech: PublicTech;
  treatmentService: Service;
  patchTestService: Service;
  brand: string;
  patchTestDays: DayOption[];
  minLeadHours: number;
  live: boolean;
  questions: ConsultationQuestion[];
  addons: ServiceAddon[];
  err?: string;
  wl?: string;
  initialPatchSlot?: string;
  initialTreatmentSlot?: string;
  photoUrl?: string;
}) {
  const deposit = depositFor(treatmentService);
  const balance = Math.max(0, treatmentService.pricePennies - deposit);
  const [patchSlot, setPatchSlot] = useState(initialPatchSlot ?? "");
  const [treatmentSlot, setTreatmentSlot] = useState(initialTreatmentSlot ?? "");
  const [treatmentDays, setTreatmentDays] = useState<DayOption[]>([]);
  const [loadingTreatment, startTransition] = useTransition();

  const step = !patchSlot ? 1 : !treatmentSlot ? 2 : 3;

  const loadTreatmentDays = useCallback(
    (patch: string) => {
      if (!patch) {
        setTreatmentDays([]);
        setTreatmentSlot("");
        return;
      }
      startTransition(async () => {
        const days = await loadTreatmentSlotsAfterPatchAction(
          tech.handle,
          treatmentService.id,
          patch,
        );
        setTreatmentDays(days);
        const first = days[0]?.slots[0] ?? "";
        setTreatmentSlot((prev) => {
          if (prev && days.some((d) => d.slots.includes(prev))) return prev;
          return first;
        });
      });
    },
    [tech.handle, treatmentService.id],
  );

  useEffect(() => {
    if (patchSlot) loadTreatmentDays(patchSlot);
  }, [patchSlot, loadTreatmentDays]);

  return (
    <div className="space-y-6 animate-fade-in">
      <Link
        href={`/${tech.handle}`}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-soft transition hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" /> All services
      </Link>

      <div className="overflow-hidden rounded-2xl border border-edge bg-surface/90 shadow-card">
        {photoUrl && <ServicePhoto src={photoUrl} alt={treatmentService.name} />}
        <div className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-ink-faint">
                Patch test + treatment
              </p>
              <h2 className="mt-1 font-display text-2xl font-semibold leading-tight text-ink sm:text-3xl">
                {treatmentService.name}
              </h2>
              {treatmentService.description && (
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">{treatmentService.description}</p>
              )}
            </div>
            <div className="shrink-0 text-right">
              <p className="font-display text-2xl font-semibold text-ink">
                {gbp(treatmentService.pricePennies)}
              </p>
              <p className="mt-0.5 flex items-center justify-end gap-1 text-xs text-ink-faint">
                <Clock className="h-3.5 w-3.5" />
                {minutesToLabel(treatmentService.durationMin)}
              </p>
            </div>
          </div>

          <Notice tone="amber" icon={<ShieldCheck className="h-4 w-4" />}>
            Book your {patchTestService.name.toLowerCase()} and treatment together. Your treatment must be at
            least {minLeadHours} hours after your patch test finishes.
          </Notice>

          <div className="mt-5 grid grid-cols-3 gap-2 rounded-xl border border-edge bg-cream/50 p-3 text-sm sm:gap-3 sm:p-4">
            <Stat label="Patch test" value={gbp(patchTestService.pricePennies)} brand={brand} />
            <Stat
              label="Treatment deposit"
              value={deposit > 0 ? gbp(deposit) : "None"}
              highlight={deposit > 0}
              brand={brand}
            />
            <Stat label="Balance on the day" value={gbp(balance)} />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 text-sm">
        <StepDot n={1} label="Patch test" active={step >= 1} done={step > 1} brand={brand} />
        <div className="h-px flex-1 bg-edge" />
        <StepDot n={2} label="Treatment" active={step >= 2} done={step > 2} brand={brand} />
        <div className="h-px flex-1 bg-edge" />
        <StepDot n={3} label="Details" active={step >= 3} done={false} brand={brand} />
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

      {live && patchTestDays.length === 0 && (
        <div className="rounded-2xl border border-edge bg-surface/80 p-8 text-center text-sm text-ink-soft">
          No patch test times available in the next two weeks. Please contact the studio.
        </div>
      )}

      {live && patchTestDays.length > 0 && (
        <div className="rounded-2xl border border-edge bg-surface/80 p-5 sm:p-6">
          <h3 className="font-display text-lg font-semibold text-ink">1. Patch test time</h3>
          <p className="mt-1 text-sm text-ink-soft">
            Quick {minutesToLabel(patchTestService.durationMin)} appointment ({gbp(patchTestService.pricePennies)}).
          </p>
          <DateSlotPicker
            days={patchTestDays}
            initialSlot={initialPatchSlot}
            brand={brand}
            onSlotChange={setPatchSlot}
          />
        </div>
      )}

      {live && patchSlot && (
        <div className="rounded-2xl border border-edge bg-surface/80 p-5 sm:p-6">
          <h3 className="font-display text-lg font-semibold text-ink">2. Treatment time</h3>
          <p className="mt-1 text-sm text-ink-soft">
            At least {minLeadHours} hours after your patch test on{" "}
            {formatInTimeZone(new Date(patchSlot), TZ, "EEE d MMM 'at' HH:mm")}.
          </p>
          {loadingTreatment ? (
            <p className="mt-4 text-sm text-ink-faint">Loading available treatment times…</p>
          ) : treatmentDays.length === 0 ? (
            <p className="mt-4 text-sm text-amber-200">
              No treatment slots far enough after that patch test. Try an earlier patch test time.
            </p>
          ) : (
            <DateSlotPicker
              days={treatmentDays}
              initialSlot={initialTreatmentSlot}
              brand={brand}
              onSlotChange={setTreatmentSlot}
            />
          )}
        </div>
      )}

      {live && patchSlot && treatmentSlot && (
        <div className="rounded-2xl border border-edge bg-surface/80 p-5 sm:p-6">
          <h3 className="font-display text-lg font-semibold text-ink">3. Your details</h3>
          <p className="mt-1 text-sm text-ink-soft">
            <strong className="text-ink">{patchTestService.name}</strong> on{" "}
            <strong className="text-ink">
              {formatInTimeZone(new Date(patchSlot), TZ, "EEE d MMM 'at' HH:mm")}
            </strong>
            , then <strong className="text-ink">{treatmentService.name}</strong> on{" "}
            <strong className="text-ink">
              {formatInTimeZone(new Date(treatmentSlot), TZ, "EEE d MMM 'at' HH:mm")}
            </strong>
          </p>
          <form action={createPairedPublicBookingAction} className="mt-5 space-y-4">
            <input type="hidden" name="handle" value={tech.handle} />
            <input type="hidden" name="serviceId" value={treatmentService.id} />
            <input type="hidden" name="patchSlot" value={patchSlot} />
            <input type="hidden" name="slot" value={treatmentSlot} />
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
                    className="flex items-center justify-between gap-3 rounded-xl border border-edge bg-white/[0.03] px-4 py-3 text-sm"
                  >
                    <span className="flex items-center gap-2.5">
                      <input type="checkbox" name={`addon_${a.id}`} className="h-4 w-4 rounded" />
                      {a.name}
                    </span>
                    <span className="font-medium">+{gbp(a.pricePennies)}</span>
                  </label>
                ))}
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
              <input name="policyAccepted" type="checkbox" required className="mt-1 h-4 w-4 rounded" />
              <span>
                I agree to the {tech.cancellationWindowHours}h cancellation policy. My patch test and treatment
                are booked together.
              </span>
            </label>
            <SubmitButton
              className="w-full bg-none py-3.5 text-base font-semibold shadow-soft"
              style={{ backgroundColor: brand }}
              pendingLabel="Securing your slots…"
            >
              <Lock className="h-4 w-4" />
              {deposit > 0 ? `Pay ${gbp(deposit)} deposit & book both` : "Confirm both appointments"}
            </SubmitButton>
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
      <p className="mt-0.5 font-semibold" style={highlight && brand ? { color: brand } : undefined}>
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
  tone: "amber" | "red";
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const map = {
    amber: "border-amber-500/20 bg-amber-500/10 text-amber-200",
    red: "border-red-500/20 bg-red-500/10 text-red-300",
  };
  return (
    <div className={`mt-4 flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm ${map[tone]}`}>
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span>{children}</span>
    </div>
  );
}
