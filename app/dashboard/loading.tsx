export default function DashboardLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="space-y-2">
        <div className="h-8 w-48 rounded-lg bg-white/[0.06]" />
        <div className="h-4 w-64 rounded bg-white/[0.04]" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card h-32" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card h-80 lg:col-span-2" />
        <div className="space-y-4">
          <div className="card h-40" />
          <div className="card h-48" />
        </div>
      </div>
    </div>
  );
}
