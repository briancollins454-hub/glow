"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import type { OmniResult } from "@/lib/owner/omni-search";

export function OwnerOmniSearch({
  initialQuery = "",
  embedded = false,
}: {
  initialQuery?: string;
  embedded?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(embedded);
  const [q, setQ] = useState(initialQuery);
  const [results, setResults] = useState<OmniResult[]>([]);
  const [pending, startTransition] = useTransition();

  const run = useCallback((query: string) => {
    startTransition(async () => {
      if (query.trim().length < 2) {
        setResults([]);
        return;
      }
      const res = await fetch(`/api/owner/search?q=${encodeURIComponent(query)}`);
      if (!res.ok) {
        setResults([]);
        return;
      }
      const data = (await res.json()) as { results: OmniResult[] };
      setResults(data.results ?? []);
    });
  }, []);

  useEffect(() => {
    if (!embedded) {
      const onKey = (e: KeyboardEvent) => {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
          e.preventDefault();
          setOpen(true);
        }
        if (e.key === "Escape") setOpen(false);
      };
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }
  }, [embedded]);

  useEffect(() => {
    if (embedded && initialQuery) run(initialQuery);
  }, [embedded, initialQuery, run]);

  if (!embedded && !open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-xl border border-edge bg-surface px-3 py-1.5 text-sm text-ink-soft hover:bg-fill-hover"
      >
        <Search className="h-4 w-4" />
        Search
        <kbd className="rounded border border-edge px-1 text-[10px]">⌘K</kbd>
      </button>
    );
  }

  const panel = (
    <div className={embedded ? "space-y-3" : "fixed inset-0 z-50 grid place-items-start bg-black/40 p-4 pt-[10vh]"}>
      <div
        className={
          embedded
            ? "w-full rounded-xl border border-edge bg-surface p-4"
            : "mx-auto w-full max-w-2xl rounded-2xl border border-edge bg-surface p-4 shadow-xl"
        }
      >
        <input
          autoFocus
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            run(e.target.value);
          }}
          placeholder="Business, email, phone, bk_/cli_/pay_/pi_/cus_/sub_…"
          className="w-full rounded-xl border border-edge bg-cream px-3 py-2 text-sm"
        />
        <p className="mt-2 text-xs text-ink-faint">
          {pending ? "Searching…" : `${results.length} result${results.length === 1 ? "" : "s"}`}
        </p>
        <ul className="mt-3 max-h-[50vh] space-y-1 overflow-y-auto">
          {results.map((r) => (
            <li key={`${r.type}-${r.id}`}>
              <button
                type="button"
                className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-fill-hover"
                onClick={() => {
                  setOpen(false);
                  router.push(r.href);
                }}
              >
                <span className="font-medium">{r.label}</span>
                <span className="ml-2 text-xs uppercase text-ink-faint">{r.type}</span>
                <p className="text-xs text-ink-soft">{r.detail}</p>
                <p className="text-xs text-ink-faint">Account: {r.techLabel || "—"}</p>
              </button>
            </li>
          ))}
        </ul>
        {!embedded ? (
          <button
            type="button"
            className="mt-3 text-sm text-ink-soft underline"
            onClick={() => setOpen(false)}
          >
            Close
          </button>
        ) : null}
      </div>
    </div>
  );

  return panel;
}
