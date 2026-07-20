export default function DashboardLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 w-40 rounded-lg bg-fill-hover" />
      <div className="h-4 w-56 rounded bg-fill" />
      <div className="card h-48" />
      <div className="card h-48" />
      <div className="card h-32" />
    </div>
  );
}
