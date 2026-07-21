"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Search, UserRoundX, Wand2 } from "lucide-react";
import { AsyncDashboardPage } from "@/components/dashboard/async-dashboard-page";
import { OwnerNav } from "@/components/owner/owner-nav";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import type { Tech } from "@/lib/db/types";
import {
  applyClientNameCleanupAction,
  previewClientNameCleanupAction,
  type ClientNameCleanupRow,
} from "../actions";

type CleanupData = { forbidden: true } | { techs: Tech[] };

export default function ClientNameCleanupPage() {
  return (
    <AsyncDashboardPage<CleanupData> pageKey="admin-support-import">
      {(data) => <CleanupGate data={data} />}
    </AsyncDashboardPage>
  );
}

function CleanupGate({ data }: { data: CleanupData }) {
  if ("forbidden" in data) notFound();
  return <CleanupView techs={data.techs} />;
}

function CleanupView({ techs }: { techs: Tech[] }) {
  const [query, setQuery] = useState("");
  const [techId, setTechId] = useState("");
  const [rows, setRows] = useState<ClientNameCleanupRow[] | null>(null);
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const filteredTechs = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return techs;
    return techs.filter((t) =>
      `${t.businessName} ${t.handle} ${t.email} ${t.name}`.toLowerCase().includes(q),
    );
  }, [techs, query]);

  const selectedTech = techs.find((t) => t.id === techId) ?? null;
  const digitRows = (rows ?? []).filter((r) => r.issue === "digits");
  const blankRows = (rows ?? []).filter((r) => r.issue === "blank");

  function loadPreview(id: string) {
    setTechId(id);
    setRows(null);
    setTicked(new Set());
    setMessage(null);
    startTransition(async () => {
      const res = await previewClientNameCleanupAction(id);
      if (!res.ok) {
        setMessage(res.error);
        return;
      }
      setRows(res.rows);
      // Pre-tick the fixable (digits) rows; blank names are review-only.
      setTicked(new Set(res.rows.filter((r) => r.issue === "digits").map((r) => r.clientId)));
    });
  }

  function toggle(clientId: string) {
    setTicked((prev) => {
      const next = new Set(prev);
      if (next.has(clientId)) next.delete(clientId);
      else next.add(clientId);
      return next;
    });
  }

  function apply() {
    if (!selectedTech) return;
    const ids = [...ticked];
    const ok = window.confirm(
      `Fix ${ids.length} client name${ids.length === 1 ? "" : "s"} on ${selectedTech.businessName}?\n\n` +
        `Digit runs are removed from the name and moved into the phone field only when the phone is empty.\n\n` +
        `This cannot be undone in bulk.`,
    );
    if (!ok) return;
    startTransition(async () => {
      const res = await applyClientNameCleanupAction(selectedTech.id, ids);
      if (!res.ok) {
        setMessage(res.error);
        return;
      }
      setMessage(`Fixed ${res.fixed} client${res.fixed === 1 ? "" : "s"}${res.skipped ? ` (${res.skipped} skipped)` : ""}.`);
      loadPreview(selectedTech.id);
    });
  }

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
          <Wand2 className="h-6 w-6 text-brand-400" /> Client name cleanup
        </h1>
        <p className="text-sm text-ink-soft">
          Finds imported clients with a phone number stuck in their name (6+ digit run) or a
          blank name. Review the proposed change, then apply the ticked fixes. Blank names are
          listed for manual renaming only.
        </p>
      </div>

      <OwnerNav />

      <Card>
        <CardHeader>
          <CardTitle>1. Choose the account</CardTitle>
          <CardDescription>Cleanup is strictly scoped to one account at a time.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search accounts…"
              className="pl-9"
              aria-label="Search accounts"
            />
          </div>
          <div className="max-h-56 space-y-1.5 overflow-y-auto">
            {filteredTechs.map((t) => (
              <button
                key={t.id}
                type="button"
                disabled={pending}
                onClick={() => loadPreview(t.id)}
                className={`flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-2.5 text-left text-sm transition ${
                  t.id === techId
                    ? "border-brand-400/60 bg-brand-500/15 text-ink"
                    : "border-edge bg-cream text-ink-soft hover:bg-fill-hover"
                }`}
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">{t.businessName}</span>
                  <span className="block truncate text-xs text-ink-faint">
                    /{t.handle} · {t.email}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {message && (
        <div className="rounded-xl bg-info-soft px-4 py-3 text-sm text-info-text">{message}</div>
      )}

      {selectedTech && rows && (
        <Card>
          <CardHeader>
            <CardTitle>2. Review and apply — {selectedTech.businessName}</CardTitle>
            <CardDescription>
              {rows.length === 0
                ? "No malformed names found on this account."
                : `${digitRows.length} name${digitRows.length === 1 ? "" : "s"} with digit runs, ${blankRows.length} blank.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {digitRows.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-ink">Digits in the name (fixable)</p>
                {digitRows.map((r) => (
                  <label
                    key={r.clientId}
                    className="flex items-start gap-3 rounded-xl border border-edge bg-cream px-4 py-3 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={ticked.has(r.clientId)}
                      onChange={() => toggle(r.clientId)}
                      className="mt-0.5 h-4 w-4 rounded border-edge text-brand-400 focus:ring-brand-300"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block">
                        <span className="font-medium text-ink">{r.currentName}</span>
                        <span className="mx-2 text-ink-faint">→</span>
                        <span className="font-medium text-success-text">
                          {r.proposedName || "(nothing left - skipped)"}
                        </span>
                      </span>
                      <span className="mt-0.5 block text-xs text-ink-faint">
                        Phone: {r.currentPhone || "(empty)"}
                        {r.movedDigitsToPhone && (
                          <>
                            <span className="mx-1.5">→</span>
                            <span className="text-success-text">{r.proposedPhone}</span>
                            <span className="ml-1.5">(digits moved from name)</span>
                          </>
                        )}
                        {!r.movedDigitsToPhone && r.currentPhone && " (kept - already set)"}
                      </span>
                    </span>
                  </label>
                ))}
                <Button type="button" disabled={pending || ticked.size === 0} onClick={apply}>
                  <Wand2 className="h-4 w-4" /> Apply {ticked.size} fix{ticked.size === 1 ? "" : "es"}
                </Button>
              </div>
            )}

            {blankRows.length > 0 && (
              <div className="space-y-2">
                <p className="flex items-center gap-2 text-sm font-medium text-ink">
                  <UserRoundX className="h-4 w-4 text-warning" /> Blank names (rename manually)
                </p>
                {blankRows.map((r) => (
                  <div
                    key={r.clientId}
                    className="flex items-center justify-between gap-3 rounded-xl border border-edge bg-cream px-4 py-3 text-sm"
                  >
                    <span className="min-w-0">
                      <span className="block font-medium text-ink">(no name)</span>
                      <span className="block text-xs text-ink-faint">
                        {r.currentPhone || "No phone either"} · id {r.clientId}
                      </span>
                    </span>
                    <Badge tone="amber">Needs a name</Badge>
                  </div>
                ))}
                <p className="text-xs text-ink-faint">
                  These are not changed automatically. Open the client on that account and give
                  them a real name.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
