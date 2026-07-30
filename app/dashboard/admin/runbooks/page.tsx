import Link from "next/link";
import { requireOwner } from "@/lib/owner/require-owner";
import { OwnerNav } from "@/components/owner/owner-nav";
import { RUNBOOKS } from "@/lib/owner/runbooks";

export const dynamic = "force-dynamic";

export default async function OwnerRunbooksPage() {
  await requireOwner();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Runbooks</h1>
        <p className="text-sm text-ink-soft">
          Short playbooks for recurring incidents. Linked from matching alerts.
        </p>
      </div>
      <OwnerNav />

      <div className="space-y-4">
        {RUNBOOKS.map((r) => (
          <section key={r.id} id={r.id} className="rounded-xl border border-edge bg-surface p-4">
            <h2 className="font-display text-lg font-semibold">{r.title}</h2>
            <p className="mt-1 text-sm text-ink-soft">{r.summary}</p>
            <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm">
              {r.steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
            <div className="mt-3 flex flex-wrap gap-2 text-sm">
              {r.links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="rounded-lg border border-edge px-2 py-1 text-brand-text hover:underline"
                >
                  {l.label}
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
