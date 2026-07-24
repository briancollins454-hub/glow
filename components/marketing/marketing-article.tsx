import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { MarketingShell } from "@/components/marketing/marketing-shell";
import { PageViewBeacon } from "@/components/analytics/page-view-beacon";
import type { MarketingPageContent } from "@/lib/marketing/types";

export function MarketingArticle({ page }: { page: MarketingPageContent }) {
  return (
    <MarketingShell>
      <PageViewBeacon path={page.path} />
      <article className="container-page pb-12 pt-4 lg:pb-16">
        <p className="text-sm text-ink-faint">
          <Link href="/" className="hover:text-ink">
            Home
          </Link>
          <span className="mx-2">/</span>
          <span className="text-ink-soft">{page.h1}</span>
        </p>
        <h1 className="mt-4 max-w-3xl font-display text-3xl font-semibold leading-tight tracking-tight text-ink sm:text-4xl lg:text-[2.75rem]">
          {page.h1}
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-ink-soft">{page.intro}</p>

        <div className="mt-10 space-y-10">
          {page.sections.map((section, i) => (
            <section key={section.heading ?? i} className="max-w-3xl">
              {section.heading && (
                <h2 className="font-display text-2xl font-semibold tracking-tight text-ink">
                  {section.heading}
                </h2>
              )}
              {section.paragraphs?.map((p) => (
                <p key={p.slice(0, 48)} className="mt-3 leading-relaxed text-ink-soft">
                  {p}
                </p>
              ))}
              {section.bullets && (
                <ul className="mt-4 space-y-2">
                  {section.bullets.map((b) => (
                    <li key={b} className="flex gap-2 text-ink-soft">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              )}
              {section.numbered && (
                <ol className="mt-4 list-decimal space-y-3 pl-5 text-ink-soft">
                  {section.numbered.map((n) => (
                    <li key={n} className="leading-relaxed pl-1">
                      {n}
                    </li>
                  ))}
                </ol>
              )}
              {section.table && (
                <div className="mt-5 overflow-x-auto rounded-xl border border-edge">
                  <table className="w-full min-w-[32rem] text-left text-sm">
                    <thead className="bg-cream">
                      <tr>
                        {section.table.headers.map((h) => (
                          <th key={h || "blank"} className="px-3 py-2.5 font-semibold text-ink">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {section.table.rows.map((row) => (
                        <tr key={row[0]} className="border-t border-edge align-top">
                          {row.map((cell, idx) => (
                            <td
                              key={`${row[0]}-${idx}`}
                              className={`px-3 py-3 text-ink-soft ${idx === 0 ? "font-medium text-ink" : ""}`}
                            >
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          ))}
        </div>

        <div className="mt-12 max-w-3xl rounded-2xl border border-brand-500/30 bg-gradient-to-br from-brand-500/15 to-transparent p-6 sm:p-8">
          {page.cta.note && <p className="text-ink-soft">{page.cta.note}</p>}
          <ButtonLink href={page.cta.href ?? "/signup"} size="lg" className="mt-4 min-h-12">
            {page.cta.label}
          </ButtonLink>
        </div>
      </article>
    </MarketingShell>
  );
}

export function ComingSoonCustomer({
  name,
  path,
  demoLabel = "Lash studio",
}: {
  name: string;
  path: string;
  /** Label for the public demo booking page button. */
  demoLabel?: string;
}) {
  return (
    <MarketingShell>
      <PageViewBeacon path={path} />
      <div className="container-page py-16 text-center">
        <p className="text-sm font-medium uppercase tracking-wider text-brand-text">Customer story</p>
        <h1 className="mt-3 font-display text-4xl font-semibold text-ink">{name}</h1>
        <p className="mx-auto mt-4 max-w-lg text-ink-soft">
          This page is coming soon. In the meantime, get started with first month half price, or see a live
          booking page.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <ButtonLink href="/signup" size="lg">
            Get started, £9.50 your first month
          </ButtonLink>
          <ButtonLink href="/bellarose" variant="outline" size="lg">
            {demoLabel}
          </ButtonLink>
        </div>
      </div>
    </MarketingShell>
  );
}
