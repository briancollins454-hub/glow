"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { notFound, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, FolderInput, Search } from "lucide-react";
import { AsyncDashboardPage } from "@/components/dashboard/async-dashboard-page";
import { MoveToGlowImport } from "@/components/dashboard/move-to-glow-import";
import { OwnerNav } from "@/components/owner/owner-nav";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { fmtDate } from "@/lib/format";
import type { Tech } from "@/lib/db/types";
import {
  supportImportBookingsAction,
  supportImportClientsAction,
  supportImportServicesAction,
} from "../actions";

type SupportImportData = { forbidden: true } | { techs: Tech[] };

export default function SupportImportPage() {
  return (
    <AsyncDashboardPage<SupportImportData> pageKey="admin-support-import">
      {(data) => <SupportImportGate data={data} />}
    </AsyncDashboardPage>
  );
}

function SupportImportGate({ data }: { data: SupportImportData }) {
  if ("forbidden" in data) notFound();
  return <SupportImportView techs={data.techs} />;
}

function SupportImportView({ techs }: { techs: Tech[] }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const selectedId = searchParams.get("tech") ?? "";
  const [query, setQuery] = useState("");

  const selected = techs.find((t) => t.id === selectedId) ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return techs;
    return techs.filter((t) => {
      const hay = `${t.businessName} ${t.handle} ${t.email} ${t.name}`.toLowerCase();
      return hay.includes(q);
    });
  }, [techs, query]);

  const returnTo = selected
    ? `/dashboard/admin/support-import?tech=${encodeURIComponent(selected.id)}`
    : "/dashboard/admin/support-import";

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/admin"
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" /> Owner
        </Link>
        <h1 className="flex items-center gap-2 font-display text-2xl font-semibold">
          <FolderInput className="h-6 w-6 text-brand-400" /> Support import
        </h1>
        <p className="text-sm text-ink-soft">
          Run Move to Glow on behalf of any tech account. Same pipeline as their dashboard. They are
          not notified automatically.
        </p>
      </div>

      <OwnerNav />

      <Card>
        <CardHeader>
          <CardTitle>Step 1 · Pick the account</CardTitle>
          <CardDescription>
            Search by business name, handle or email. Everything below imports into that account only.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search accounts…"
              className="pl-9"
              aria-label="Search accounts"
            />
          </div>
          <div className="max-h-72 space-y-1 overflow-y-auto rounded-xl border border-edge">
            {filtered.length === 0 ? (
              <p className="px-4 py-3 text-sm text-ink-faint">No accounts match that search.</p>
            ) : (
              filtered.map((t) => {
                const active = t.id === selectedId;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() =>
                      router.push(
                        `/dashboard/admin/support-import?tech=${encodeURIComponent(t.id)}`,
                      )
                    }
                    className={`flex w-full flex-col items-start gap-0.5 px-4 py-3 text-left text-sm transition ${
                      active
                        ? "bg-brand-500/15 text-ink"
                        : "hover:bg-fill text-ink-soft hover:text-ink"
                    }`}
                  >
                    <span className="font-medium text-ink">
                      {t.businessName || t.handle}{" "}
                      <span className="text-xs font-normal text-brand-400">/{t.handle}</span>
                    </span>
                    <span className="text-xs text-ink-faint">
                      {t.email} · joined {fmtDate(t.createdAt)}
                    </span>
                  </button>
                );
              })
            )}
          </div>
          {selected && (
            <p className="text-sm text-ink-soft">
              Importing into{" "}
              <span className="font-medium text-ink">
                {selected.businessName || selected.handle}
              </span>{" "}
              ({selected.email}).
            </p>
          )}
        </CardContent>
      </Card>

      {selected ? (
        <MoveToGlowImport
          title="Step 2 · Import files"
          subtitle={`Same Move to Glow flow, scoped to ${selected.businessName || selected.handle}. For Acuity multi-staff exports, tick every calendar — appointments land on the matching Glow team member.`}
          actions={{
            importClients: supportImportClientsAction,
            importServices: supportImportServicesAction,
            importBookings: supportImportBookingsAction,
          }}
          returnTo={returnTo}
          hiddenFields={{ techId: selected.id }}
          importStatus={searchParams.get("import")}
          what={searchParams.get("what")}
          n={searchParams.get("n")}
          s={searchParams.get("s")}
          skipServices={searchParams.get("skipServices")}
          skipDupes={searchParams.get("skipDupes")}
        />
      ) : (
        <p className="text-sm text-ink-faint">Pick an account above to show the import steps.</p>
      )}
    </div>
  );
}
