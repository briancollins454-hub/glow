import Link from "next/link";
import { CalendarHeart } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { COMPARE_LINKS, SWITCH_LINKS, GUIDE_LINKS } from "@/lib/marketing/types";
import { AttributionCapture } from "@/components/marketing/attribution-capture";

export function MarketingShell({
  children,
  showStickyCta = false,
  partnerSlug,
}: {
  children: React.ReactNode;
  showStickyCta?: boolean;
  partnerSlug?: string | null;
}) {
  return (
    <div className={`min-h-screen ${showStickyCta ? "pb-24 lg:pb-0" : ""}`}>
      <AttributionCapture partnerSlug={partnerSlug} />
      <header className="container-page flex items-center justify-between py-5 sm:py-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-glow">
            <CalendarHeart className="h-5 w-5" />
          </span>
          <span className="font-display text-xl font-semibold tracking-tight">Glow</span>
        </Link>
        <nav className="flex items-center gap-2">
          <ButtonLink href="/login" variant="ghost" size="sm">
            Log in
          </ButtonLink>
          <ButtonLink href="/signup" size="sm" className="hidden sm:inline-flex">
            Sign up
          </ButtonLink>
        </nav>
      </header>

      {children}

      <footer className="container-page border-t border-edge py-10 text-sm text-ink-faint">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="font-medium text-ink">Glow</p>
            <p className="mt-2">© {new Date().getFullYear()} Glow. Made for UK beauty techs.</p>
            <div className="mt-3 flex flex-wrap gap-3">
              <Link href="/signup" className="hover:text-ink">
                Sign up
              </Link>
              <Link href="/login" className="hover:text-ink">
                Log in
              </Link>
              <Link href="/terms" className="hover:text-ink">
                Terms
              </Link>
              <Link href="/privacy" className="hover:text-ink">
                Privacy
              </Link>
            </div>
          </div>
          <div>
            <p className="font-medium text-ink">Compare</p>
            <ul className="mt-2 space-y-1.5">
              {COMPARE_LINKS.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="hover:text-ink">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="font-medium text-ink">Switching</p>
            <ul className="mt-2 space-y-1.5">
              {SWITCH_LINKS.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="hover:text-ink">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="font-medium text-ink">Guides</p>
            <ul className="mt-2 space-y-1.5">
              {GUIDE_LINKS.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="hover:text-ink">
                    {l.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/pricing" className="hover:text-ink">
                  Pricing
                </Link>
              </li>
              <li>
                <a href="mailto:support@glow-uk.com" className="hover:text-ink">
                  Support
                </a>
              </li>
            </ul>
          </div>
        </div>
      </footer>
    </div>
  );
}
