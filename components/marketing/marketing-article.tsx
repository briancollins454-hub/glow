import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { MarketingShell } from "@/components/marketing/marketing-shell";
import { PageViewBeacon } from "@/components/analytics/page-view-beacon";
import { JsonLd } from "@/components/seo/json-ld";
import { breadcrumbJsonLd } from "@/lib/seo/json-ld";
import {
  COMPARE_LINKS,
  SWITCH_LINKS,
  type MarketingPageContent,
} from "@/lib/marketing/types";

function breadcrumbItems(page: MarketingPageContent): { name: string; path: string }[] | null {
  if (page.breadcrumbs?.length) {
    return [{ name: "Home", path: "/" }, ...page.breadcrumbs];
  }
  if (page.path.startsWith("/vs/")) {
    const label = COMPARE_LINKS.find((l) => l.href === page.path)?.label ?? page.h1;
    return [
      { name: "Home", path: "/" },
      { name: "Compare", path: "/vs/fresha" },
      { name: label, path: page.path },
    ];
  }
  if (page.path.startsWith("/switch/")) {
    const label = SWITCH_LINKS.find((l) => l.href === page.path)?.label ?? page.h1;
    return [
      { name: "Home", path: "/" },
      { name: "Switching", path: "/switch/fresha" },
      { name: label, path: page.path },
    ];
  }
  return null;
}

export function MarketingArticle({ page }: { page: MarketingPageContent }) {
  const crumbs = breadcrumbItems(page);

  return (
    <MarketingShell>
      {crumbs ? <JsonLd data={breadcrumbJsonLd(crumbs)} /> : null}
      <PageViewBeacon path={page.path} />
      <article className="container-page pb-12 pt-4 lg:pb-16">
        <nav aria-label="Breadcrumb" className="text-sm text-ink-faint">
          <ol className="flex flex-wrap items-center gap-x-2">
            <li>
              <Link href="/" className="hover:text-ink">
                Home
              </Link>
            </li>
            {crumbs
              ?.slice(1)
              .map((c, i, arr) => (
                <li key={c.path} className="flex items-center gap-x-2">
                  <span aria-hidden="true">/</span>
                  {i === arr.length - 1 ? (
                    <span className="text-ink-soft">{c.name}</span>
                  ) : (
                    <Link href={c.path} className="hover:text-ink">
                      {c.name}
                    </Link>
                  )}
                </li>
              ))}
          </ol>
        </nav>
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
                  {/* Fixed min size reduces CLS when wide tables paint. */}
                  <table className="w-full min-h-[12rem] min-w-[32rem] table-fixed text-left text-sm">
                    <colgroup>
                      {section.table.headers.map((h, idx) => (
                        <col
                          key={h || `col-${idx}`}
                          style={{ width: `${Math.floor(100 / section.table!.headers.length)}%` }}
                        />
                      ))}
                    </colgroup>
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
