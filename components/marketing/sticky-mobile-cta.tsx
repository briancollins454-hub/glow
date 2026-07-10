import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";

/** Fixed signup bar on phones so the main CTA is always one tap away. */
export function StickyMobileCta() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-edge bg-cream/95 px-4 py-3 pb-safe backdrop-blur-md lg:hidden">
      <div className="mx-auto flex max-w-lg gap-2">
        <ButtonLink href="/signup" size="lg" className="min-h-12 flex-1">
          Start for £9.50
        </ButtonLink>
        <Link
          href="/bellarose"
          className="inline-flex min-h-12 flex-1 items-center justify-center rounded-xl border border-edge bg-white/[0.04] px-4 text-sm font-semibold text-ink transition hover:bg-white/[0.08]"
        >
          Live demo
        </Link>
      </div>
    </div>
  );
}
