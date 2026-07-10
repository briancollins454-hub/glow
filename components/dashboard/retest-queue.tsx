import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { fmtDateTime } from "@/lib/format";
import type { Booking, Client, ProductChangeRetest, ServiceCategory } from "@/lib/db/types";

const STATUS_LABEL: Record<ProductChangeRetest["status"], string> = {
  needs_test: "Needs test",
  test_booked: "Test booked",
  passed: "Passed",
};

const STATUS_TONE: Record<ProductChangeRetest["status"], "amber" | "brand" | "green"> = {
  needs_test: "amber",
  test_booked: "brand",
  passed: "green",
};

export function RetestQueue({
  retests,
  clients,
  categories,
  bookings,
}: {
  retests: ProductChangeRetest[];
  clients: Client[];
  categories: ServiceCategory[];
  bookings: Booking[];
}) {
  const open = retests.filter((r) => r.status !== "passed");
  if (open.length === 0) return null;

  const clientById = Object.fromEntries(clients.map((c) => [c.id, c]));
  const catById = Object.fromEntries(categories.map((c) => [c.id, c]));
  const bookingById = Object.fromEntries(bookings.map((b) => [b.id, b]));

  return (
    <div className="card p-5">
      <h2 className="font-display text-lg font-semibold">Clients needing a re-test</h2>
      <p className="mt-1 text-sm text-ink-soft">
        After a product change. Booking is blocked until a new pass is on file.
      </p>
      <ul className="mt-4 space-y-2">
        {open.map((r) => {
          const client = clientById[r.clientId];
          const cat = catById[r.categoryId];
          const booking = r.futureBookingId ? bookingById[r.futureBookingId] : null;
          return (
            <li
              key={r.id}
              className="flex flex-col gap-2 rounded-xl border border-edge bg-cream/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <Link
                  href={`/dashboard/clients/${r.clientId}`}
                  className="font-medium text-ink hover:text-brand-300"
                >
                  {client?.name ?? "Client"}
                </Link>
                <p className="text-sm text-ink-soft">
                  {cat?.name ?? "Category"}
                  {booking && (
                    <span className="text-ink-faint">
                      {" "}
                      · appointment {fmtDateTime(booking.startIso)}
                    </span>
                  )}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {r.hasFutureBooking && <Badge tone="amber">Upcoming booking</Badge>}
                <Badge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Badge>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
