import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getDashboardContext } from "@/lib/auth/session";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { isAdminTech } from "@/lib/admin";
import DashboardLoading from "./loading";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getDashboardContext();
  if (!ctx) redirect("/login");
  const { tech } = ctx;

  return (
    <DashboardShell tech={tech} admin={isAdminTech(tech)}>
      <Suspense fallback={<DashboardLoading />}>{children}</Suspense>
    </DashboardShell>
  );
}
