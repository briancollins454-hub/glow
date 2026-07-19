"use client";

import { useSearchParams } from "next/navigation";
import { AsyncDashboardPage } from "@/components/dashboard/async-dashboard-page";
import { MoveToGlowImport } from "@/components/dashboard/move-to-glow-import";
import { importClientsAction, importServicesAction, importBookingsAction } from "../actions";

export default function ImportPage() {
  return (
    <AsyncDashboardPage<Record<string, never>> pageKey="import">
      {() => <ImportView />}
    </AsyncDashboardPage>
  );
}

function ImportView() {
  const searchParams = useSearchParams();
  return (
    <MoveToGlowImport
      actions={{
        importClients: importClientsAction,
        importServices: importServicesAction,
        importBookings: importBookingsAction,
      }}
      returnTo="/dashboard/import"
      importStatus={searchParams.get("import")}
      what={searchParams.get("what")}
      n={searchParams.get("n")}
      s={searchParams.get("s")}
      skipServices={searchParams.get("skipServices")}
      skipDupes={searchParams.get("skipDupes")}
    />
  );
}
