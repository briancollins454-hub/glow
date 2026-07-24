import Link from "next/link";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { CalendarHeart, PartyPopper } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { ClearSessionCache } from "@/components/auth/clear-session-cache";
import { OnceSubmitForm } from "@/components/auth/once-submit-form";
import { SignupAttributionFields } from "@/components/auth/signup-attribution-fields";
import { signupAction } from "../actions";
import { PageViewBeacon } from "@/components/analytics/page-view-beacon";
import { HEAR_ABOUT_OPTIONS } from "@/lib/signup-attribution";
import { launchOfferEnabled, partnerOfferEnabled } from "@/lib/offers";
import { getPartnerBySlug } from "@/lib/partners";

const errors: Record<string, ReactNode> = {
  email: (
    <>
      An account with that email already exists.{" "}
      <Link href="/login" className="font-medium underline underline-offset-2">
        Log in
      </Link>{" "}
      or{" "}
      <Link href="/forgot" className="font-medium underline underline-offset-2">
        reset your password
      </Link>
      .
    </>
  ),
  missing: "Please fill in your business name, email and password.",
  password: "Password needs to be at least 8 characters.",
};

/** When the private tester cookie is set, keep the £1 offer out of search results. */
export async function generateMetadata(): Promise<Metadata> {
  const isTester = (await cookies()).get("glow_offer")?.value === "tester";
  if (!isTester) return {};
  return { robots: { index: false, follow: false } };
}

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ref?: string; partner?: string }>;
}) {
  const { error, ref, partner: partnerParam } = await searchParams;
  const isTester = (await cookies()).get("glow_offer")?.value === "tester";
  const partnerSlug = (partnerParam ?? "").trim().toLowerCase() || null;
  const partner =
    partnerSlug && partnerOfferEnabled() ? await getPartnerBySlug(partnerSlug).catch(() => null) : null;

  return (
    <div className="grid min-h-screen place-items-center bg-cream px-4 py-10">
      <PageViewBeacon path="/signup" />
      <ClearSessionCache />
      <div className="w-full max-w-md animate-fade-in">
        <Link href="/" className="mb-6 flex items-center justify-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-600 text-white">
            <CalendarHeart className="h-5 w-5" />
          </span>
          <span className="font-display text-xl font-semibold">Glow</span>
        </Link>

        {isTester && (
          <div className="mb-4 rounded-2xl border-2 border-brand-400 bg-gradient-to-r from-brand-600 to-brand-700 p-5 text-center text-white shadow-glow">
            <p className="flex items-center justify-center gap-2 font-display text-xl font-semibold">
              <PartyPopper className="h-6 w-6" /> You&apos;re an invited tester!
            </p>
            <p className="mt-1 text-2xl font-bold">
              Your first month is just £1
            </p>
            <p className="mt-1 text-sm text-white/85">
              Then £19/mo. Cancel anytime. Thanks for helping us build Glow.
            </p>
          </div>
        )}

        {partner && !isTester && (
          <div className="mb-4 rounded-2xl border-2 border-brand-400 bg-gradient-to-r from-brand-600 to-brand-700 p-5 text-center text-white shadow-glow">
            {partner.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={partner.logoUrl}
                alt={`${partner.name} academy logo`}
                className="mx-auto mb-3 h-12 w-auto max-w-[180px] object-contain"
                width={180}
                height={48}
                loading="eager"
                decoding="async"
              />
            ) : null}
            <p className="font-display text-xl font-semibold">
              {partner.name} students get 3 months of Glow free
            </p>
            <p className="mt-1 text-sm text-white/85">
              Then £19/mo. Cancel anytime.
            </p>
          </div>
        )}

        <div className="card p-7">
          <h1 className="font-display text-2xl font-semibold">
            Create your booking page
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            {isTester
              ? "£1 your first month, then £19. No commission, ever."
              : partner
                ? "3 months free via your academy, then £19/mo. No commission, ever."
                : launchOfferEnabled()
                  ? "£9.50 your first month, then £19. No commission, ever."
                  : "£19/mo when you go live. No commission, ever."}
          </p>

          {error && (
            <p className="mt-4 rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger-text">
              {errors[error] ?? "Something went wrong. Please try again."}
            </p>
          )}

          <OnceSubmitForm action={signupAction} className="mt-6 space-y-4">
            {ref && <input type="hidden" name="ref" value={ref} />}
            <SignupAttributionFields partnerSlug={partner?.slug ?? partnerSlug} />
            <div>
              <Label htmlFor="businessName">Business name</Label>
              <Input
                id="businessName"
                name="businessName"
                required
                placeholder="Bella Rose Beauty"
              />
            </div>
            <div>
              <Label htmlFor="name">Your name</Label>
              <Input id="name" name="name" placeholder="Bella Rose" />
            </div>
            <div>
              <Label htmlFor="handle">Booking link</Label>
              <div className="flex items-center gap-1.5 rounded-xl border border-edge bg-fill px-3.5 focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-500/30">
                <span className="text-sm text-ink-faint">glow.app/</span>
                <input
                  id="handle"
                  name="handle"
                  placeholder="bellarose"
                  className="w-full bg-transparent py-2.5 text-base outline-none sm:text-sm"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required autoComplete="email" />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            <div>
              <Label htmlFor="heardAbout">How did you hear about us? (optional)</Label>
              <select
                id="heardAbout"
                name="heardAbout"
                defaultValue=""
                className="mt-1 w-full rounded-xl border border-edge bg-fill px-3.5 py-2.5 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/30"
              >
                <option value="">Prefer not to say</option>
                {HEAR_ABOUT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" className="w-full">
              Create my page
            </Button>
          </OnceSubmitForm>

          <p className="mt-5 text-center text-sm text-ink-soft">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-brand-400">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
