export default function PublicBookingLoading() {
  return (
    <div className="min-h-screen bg-cream pb-16">
      {/* Hero skeleton */}
      <div className="relative h-72 overflow-hidden bg-surface sm:h-80">
        <div className="absolute inset-0 animate-pulse bg-gradient-to-b from-surface-raised to-cream" />
        <div className="relative mx-auto flex max-w-2xl flex-col items-center px-4 pt-16">
          <div className="h-24 w-24 animate-pulse rounded-[1.2rem] bg-white/10 sm:h-28 sm:w-28" />
          <div className="mt-5 h-8 w-48 animate-pulse rounded-lg bg-white/10" />
          <div className="mt-3 h-4 w-64 animate-pulse rounded bg-white/5" />
          <div className="mt-5 flex gap-2">
            <div className="h-8 w-28 animate-pulse rounded-full bg-white/10" />
            <div className="h-8 w-32 animate-pulse rounded-full bg-white/10" />
          </div>
        </div>
      </div>

      <div className="mx-auto -mt-6 max-w-2xl space-y-10 px-4 sm:-mt-8">
        {/* Portfolio skeleton */}
        <div>
          <div className="mb-4 h-7 w-36 animate-pulse rounded bg-white/10" />
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
            <div className="col-span-2 row-span-2 aspect-square animate-pulse rounded-xl bg-surface sm:min-h-[220px]" />
            {[1, 2, 3].map((i) => (
              <div key={i} className="aspect-square animate-pulse rounded-xl bg-surface" />
            ))}
          </div>
        </div>

        {/* Service card skeletons */}
        <div className="space-y-4">
          <div className="h-7 w-28 animate-pulse rounded bg-white/10" />
          {[1, 2].map((i) => (
            <div key={i} className="overflow-hidden rounded-2xl border border-edge bg-surface">
              <div className="aspect-square animate-pulse bg-white/5" />
              <div className="space-y-3 p-5">
                <div className="flex justify-between">
                  <div className="h-6 w-40 animate-pulse rounded bg-white/10" />
                  <div className="h-6 w-16 animate-pulse rounded bg-white/10" />
                </div>
                <div className="h-4 w-full animate-pulse rounded bg-white/5" />
                <div className="h-4 w-3/4 animate-pulse rounded bg-white/5" />
                <div className="h-11 animate-pulse rounded-xl bg-white/10" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
