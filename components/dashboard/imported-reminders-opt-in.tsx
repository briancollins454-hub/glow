"use client";

import { optInImportedBookingRemindersAction } from "@/app/dashboard/actions";
import { SubmitButton } from "@/components/ui/submit-button";

/**
 * Shown after an appointments import. Default is no client messaging —
 * the tech must explicitly opt in before Glow emails imported clients.
 */
export function ImportedRemindersOptIn({
  upcomingCount,
  alreadyOptedIn,
}: {
  upcomingCount: number;
  alreadyOptedIn?: boolean;
}) {
  if (alreadyOptedIn || upcomingCount <= 0) return null;

  return (
    <div
      role="region"
      aria-label="Imported booking reminders"
      className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-4 text-sm text-ink"
    >
      <p className="font-medium">
        {upcomingCount === 1
          ? "1 upcoming booking was imported."
          : `${upcomingCount} upcoming bookings were imported.`}
      </p>
      <p className="mt-1 text-ink-soft">
        Do you want Glow to send reminders to these clients? By default we will not email or text
        them — balances from your old system may already be settled, so Glow never sends balance
        payment requests for imported bookings unless you enable them on a booking yourself.
      </p>
      <form action={optInImportedBookingRemindersAction} className="mt-3 flex flex-wrap gap-2">
        <SubmitButton pendingLabel="Saving…">Yes, send reminders for imported bookings</SubmitButton>
      </form>
      <p className="mt-2 text-xs text-ink-faint">
        Leave this and we stay silent. You can turn reminders on later from Settings.
      </p>
    </div>
  );
}
