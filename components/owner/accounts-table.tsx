"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { bulkOwnerAction } from "@/app/dashboard/admin/phase4-actions";
import { Badge } from "@/components/ui/badge";

export type AccountTableRow = {
  id: string;
  label: string;
  handle: string;
  email: string;
  offer: string;
  status: string;
  plan: string | null;
  healthScore: number | null;
  healthBand: string | null;
  trialEnds: string | null;
  daysLeft: string;
  firstCharge: string;
  mrr: string;
  staff: number;
  clients: number;
  bookings: number;
  connect: string;
  joined: string;
  flags: string[];
  tags: string[];
};

const FLAG_LABEL: Record<string, string> = {
  connect_pending: "Connect pending",
  no_services: "No services",
  no_bookings: "No bookings",
  past_due: "Past due",
  trialing: "Trialing",
  signup_trial: "Signup trial",
  blocked: "Blocked",
  internal: "Internal",
  closure_requested: "Closure requested",
};

const ALL_COLS = [
  "account",
  "offer",
  "status",
  "health",
  "trial",
  "mrr",
  "staff",
  "clients",
  "bookings",
  "connect",
  "joined",
  "flags",
] as const;

export function AccountsTable({
  rows,
  columns,
  returnTo = "/dashboard/admin/accounts",
}: {
  rows: AccountTableRow[];
  columns?: string[];
  /** Current accounts list URL (path + query) so confirm failures keep filters. */
  returnTo?: string;
}) {
  const cols = useMemo(() => {
    const wanted = columns?.length ? columns : [...ALL_COLS];
    return ALL_COLS.filter((c) => wanted.includes(c) || c === "account");
  }, [columns]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const chosen = rows.map((r) => r.id).filter((id) => selected[id]);

  return (
    <div className="space-y-3">
      <form action={bulkOwnerAction} className="rounded-xl border border-edge bg-cream p-3 space-y-2">
        <input type="hidden" name="returnTo" value={returnTo} />
        {chosen.map((id) => (
          <input key={id} type="hidden" name="ids" value={id} />
        ))}
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <button
            type="button"
            className="rounded-lg border border-edge px-2 py-1"
            onClick={() => {
              const next: Record<string, boolean> = {};
              for (const r of rows) next[r.id] = true;
              setSelected(next);
            }}
          >
            Select page
          </button>
          <button type="button" className="rounded-lg border border-edge px-2 py-1" onClick={() => setSelected({})}>
            Clear
          </button>
          <span className="text-ink-faint">{chosen.length} selected</span>
        </div>
        <p className="text-sm font-medium">Bulk actions (never delete)</p>
        <div className="flex flex-wrap gap-2">
          <select name="bulkAction" className="rounded-lg border border-edge px-2 py-1.5 text-sm" required>
            <option value="add_tag">Add tag</option>
            <option value="add_note">Add note</option>
            <option value="nudge">Send nudge</option>
            <option value="mark_internal">Mark internal</option>
            <option value="mark_at_risk">Mark at risk</option>
          </select>
          <input name="tag" placeholder="tag" className="w-28 rounded-lg border border-edge px-2 py-1.5 text-sm" />
          <input
            name="note"
            placeholder="message to send"
            className="min-w-[140px] flex-1 rounded-lg border border-edge px-2 py-1.5 text-sm"
          />
          <select name="kind" className="rounded-lg border border-edge px-2 py-1.5 text-sm">
            <option value="setup_help">setup help</option>
            <option value="go_live">go live</option>
            <option value="win_back">win back</option>
            <option value="trial_nudge">trial nudge</option>
          </select>
          <input
            name="confirm"
            placeholder="type yes"
            className="w-20 rounded-lg border border-edge px-2 py-1.5 text-sm"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            autoComplete="off"
            />
          <button
            type="submit"
            disabled={chosen.length === 0}
            className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm text-white disabled:opacity-40"
          >
            Run
          </button>
        </div>
      </form>

      {/* Mobile cards */}
      <div className="space-y-2 md:hidden">
        {rows.map((row) => (
          <article key={row.id} className="rounded-xl border border-edge bg-surface p-3 text-sm">
            <div className="flex items-start gap-2">
              <input
                type="checkbox"
                className="mt-1"
                checked={!!selected[row.id]}
                onChange={(e) => setSelected((s) => ({ ...s, [row.id]: e.target.checked }))}
              />
              <div className="min-w-0 flex-1">
                <Link href={`/dashboard/admin/accounts/${row.id}`} className="font-medium hover:underline">
                  {row.label}
                </Link>
                <p className="text-xs text-ink-faint">
                  /{row.handle} · {row.email}
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  <Badge tone="neutral">{row.status}</Badge>
                  {row.healthScore != null ? (
                    <Badge tone={row.healthBand === "at_risk" ? "amber" : "green"}>
                      {row.healthScore} {row.healthBand}
                    </Badge>
                  ) : null}
                  <span className="text-xs text-ink-faint">{row.mrr}</span>
                </div>
                {row.flags.length ? (
                  <p className="mt-1 text-xs text-ink-faint">
                    {row.flags.map((f) => FLAG_LABEL[f] || f).join(" · ")}
                  </p>
                ) : null}
              </div>
            </div>
          </article>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-x-auto rounded-xl border border-edge md:block">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-fill text-xs text-ink-faint">
            <tr>
              <th className="px-2 py-2 w-8" />
              {cols.includes("account") ? <th className="px-3 py-2">Account</th> : null}
              {cols.includes("offer") ? <th className="px-3 py-2">Offer</th> : null}
              {cols.includes("status") ? <th className="px-3 py-2">Status</th> : null}
              {cols.includes("health") ? <th className="px-3 py-2">Health</th> : null}
              {cols.includes("trial") ? <th className="px-3 py-2">Trial</th> : null}
              {cols.includes("mrr") ? <th className="px-3 py-2">MRR</th> : null}
              {cols.includes("staff") ? <th className="px-3 py-2">Staff</th> : null}
              {cols.includes("clients") ? <th className="px-3 py-2">Clients</th> : null}
              {cols.includes("bookings") ? <th className="px-3 py-2">Bookings</th> : null}
              {cols.includes("connect") ? <th className="px-3 py-2">Connect</th> : null}
              {cols.includes("joined") ? <th className="px-3 py-2">Joined</th> : null}
              {cols.includes("flags") ? <th className="px-3 py-2">Flags</th> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-edge">
                <td className="px-2 py-2">
                  <input
                    type="checkbox"
                    checked={!!selected[row.id]}
                    onChange={(e) => setSelected((s) => ({ ...s, [row.id]: e.target.checked }))}
                  />
                </td>
                {cols.includes("account") ? (
                  <td className="px-3 py-2">
                    <Link href={`/dashboard/admin/accounts/${row.id}`} className="font-medium hover:underline">
                      {row.label}
                    </Link>
                    <p className="text-xs text-ink-faint">
                      /{row.handle} · {row.email}
                    </p>
                  </td>
                ) : null}
                {cols.includes("offer") ? (
                  <td className="px-3 py-2">
                    <Badge tone="neutral">{row.offer}</Badge>
                  </td>
                ) : null}
                {cols.includes("status") ? (
                  <td className="px-3 py-2">
                    <Badge tone={row.status === "trialing" ? "amber" : "neutral"}>{row.status}</Badge>
                  </td>
                ) : null}
                {cols.includes("health") ? (
                  <td className="px-3 py-2">
                    {row.healthScore == null ? (
                      "—"
                    ) : (
                      <Badge tone={row.healthBand === "at_risk" ? "amber" : "green"}>
                        {row.healthScore} {row.healthBand}
                      </Badge>
                    )}
                  </td>
                ) : null}
                {cols.includes("trial") ? (
                  <td className="px-3 py-2 text-xs">
                    {row.trialEnds || "—"}
                    {row.daysLeft !== "—" ? ` · ${row.daysLeft}d` : ""}
                  </td>
                ) : null}
                {cols.includes("mrr") ? <td className="px-3 py-2">{row.mrr}</td> : null}
                {cols.includes("staff") ? <td className="px-3 py-2">{row.staff}</td> : null}
                {cols.includes("clients") ? <td className="px-3 py-2">{row.clients}</td> : null}
                {cols.includes("bookings") ? <td className="px-3 py-2">{row.bookings}</td> : null}
                {cols.includes("connect") ? <td className="px-3 py-2">{row.connect}</td> : null}
                {cols.includes("joined") ? <td className="px-3 py-2">{row.joined}</td> : null}
                {cols.includes("flags") ? (
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {row.flags.map((f) => (
                        <Badge key={f} tone="neutral">
                          {FLAG_LABEL[f] || f}
                        </Badge>
                      ))}
                    </div>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
