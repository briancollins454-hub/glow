import Link from "next/link";
import { requireOwner } from "@/lib/owner/require-owner";
import { OwnerNav } from "@/components/owner/owner-nav";
import { runDataQualityChecks } from "@/lib/owner/data-quality";

export const dynamic = "force-dynamic";

export default async function OwnerDataQualityPage() {
  await requireOwner();
  const issues = await runDataQualityChecks();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Data quality</h1>
        <p className="text-sm text-ink-soft">
          Structural issues that break bookings, billing, or messaging. Sampled across live accounts.
        </p>
      </div>
      <OwnerNav />

      {issues.length === 0 ? (
        <p className="rounded-xl border border-edge bg-surface px-4 py-6 text-sm text-ink-soft">
          No issues detected in the sampled set.
        </p>
      ) : (
        <div className="space-y-3">
          {issues.map((issue) => (
            <section key={issue.rule} className="rounded-xl border border-edge bg-surface p-4">
              <h2 className="font-display text-lg font-semibold">
                {issue.title}{" "}
                <span className="text-ink-soft font-normal">({issue.count})</span>
              </h2>
              <p className="mt-1 text-xs text-ink-faint">{issue.rule}</p>
              {issue.sampleTechIds.length > 0 ? (
                <ul className="mt-2 flex flex-wrap gap-2 text-sm">
                  {issue.sampleTechIds.map((id) => (
                    <li key={id}>
                      <Link
                        href={`/dashboard/admin/accounts/${id}`}
                        className="text-brand-text hover:underline"
                      >
                        {id.slice(0, 10)}…
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
