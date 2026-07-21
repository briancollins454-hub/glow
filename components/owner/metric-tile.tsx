import { fmtDate, gbp } from "@/lib/format";
import type { MetricValue } from "@/lib/owner/overview";
import { gbpFromPennies } from "@/lib/owner/mrr";

export function MetricTile({
  label,
  value,
  hint,
  tone = "brand",
}: {
  label: string;
  value: string;
  hint?: string | null;
  tone?: "brand" | "green" | "amber" | "red" | "neutral";
}) {
  const tones = {
    brand: "bg-brand-500/15 text-brand-text",
    green: "bg-emerald-500/15 text-success-text",
    amber: "bg-amber-500/15 text-warning-text",
    red: "bg-red-500/15 text-danger-text",
    neutral: "bg-fill-hover text-ink-soft",
  };
  return (
    <div className="rounded-xl border border-edge bg-surface p-4">
      <p className="text-xs font-medium text-ink-faint">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${value === "Unavailable" ? "text-ink-faint" : ""}`}>
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-ink-faint">{hint}</p> : null}
      <span className={`mt-2 inline-block rounded-md px-1.5 py-0.5 text-[10px] font-medium ${tones[tone]}`}>
        {tone === "red" && value === "Unavailable" ? "check source" : "live query"}
      </span>
    </div>
  );
}

export function formatMetric(m: MetricValue, opts?: { money?: boolean }): string {
  if (!m.ok) return "Unavailable";
  if (opts?.money) return gbpFromPennies(m.value);
  return m.value.toLocaleString("en-GB");
}

export function metricReason(m: MetricValue): string | null {
  return m.ok ? null : m.reason;
}

export function AsOf({ iso, ttlSeconds }: { iso: string; ttlSeconds: number }) {
  const ageMin = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  return (
    <p className="text-xs text-ink-faint">
      As of {ageMin === 0 ? "just now" : `${ageMin}m ago`} · cached up to {ttlSeconds}s · {fmtDate(iso)}
    </p>
  );
}

export { gbp, gbpFromPennies };
