import Link from "next/link";
import { CalendarHeart } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center bg-cream px-4 py-10">
      <div className="w-full max-w-md animate-fade-in text-center">
        <Link href="/" className="mb-6 inline-flex items-center justify-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-600 text-white">
            <CalendarHeart className="h-5 w-5" />
          </span>
          <span className="font-display text-xl font-semibold">Glow</span>
        </Link>
        <p className="font-display text-6xl font-semibold text-brand-400">404</p>
        <h1 className="mt-3 font-display text-2xl font-semibold text-ink">Page not found</h1>
        <p className="mt-2 text-sm text-ink-soft">
          That link doesn&apos;t match a booking page or Glow page.
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <ButtonLink href="/">Back to Glow</ButtonLink>
          <ButtonLink href="/signup" variant="outline">
            Create a booking page
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}
