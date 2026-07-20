"use client";

import DashboardLoading from "@/app/dashboard/loading";
import { useDashboardQuery } from "@/hooks/use-dashboard-query";

export function AsyncDashboardPage<T>({
  pageKey,
  children,
}: {
  pageKey: string;
  children: (data: T) => React.ReactNode;
}) {
  const { data, isLoading, error } = useDashboardQuery<T>(pageKey);

  if (isLoading && !data) return <DashboardLoading />;
  if (error && !data) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-danger-soft px-4 py-3 text-sm text-danger-text">
        {error}
      </div>
    );
  }
  if (!data) return <DashboardLoading />;
  return <>{children(data)}</>;
}
