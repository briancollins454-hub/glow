"use client";

export function BookingFooterCta({
  brand,
  minPriceLabel,
  serviceCount,
}: {
  brand: string;
  minPriceLabel: string;
  serviceCount: number;
}) {
  if (serviceCount === 0) return null;

  const scrollToServices = () => {
    document.getElementById("services")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <section className="rounded-2xl border border-edge bg-surface/90 px-6 py-10 text-center shadow-card sm:px-10">
      <h2 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
        Ready to book?
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-ink-soft sm:text-base">
        Pick a treatment and secure your slot. Deposits shown upfront, no hidden fees.
      </p>
      <button
        type="button"
        onClick={scrollToServices}
        className="mt-6 rounded-xl px-8 py-3.5 text-sm font-semibold text-white transition hover:brightness-110"
        style={{ backgroundColor: brand }}
      >
        View treatments from {minPriceLabel}
      </button>
    </section>
  );
}
