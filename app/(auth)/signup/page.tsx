import Link from "next/link";
import { cookies } from "next/headers";
import { CalendarHeart, PartyPopper } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { signupAction } from "../actions";

const errors: Record<string, string> = {
  email: "An account with that email already exists.",
  missing: "Please fill in your business name, email and password.",
};

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ref?: string }>;
}) {
  const { error, ref } = await searchParams;
  const isTester = (await cookies()).get("glow_offer")?.value === "tester";
  return (
    <div className="grid min-h-screen place-items-center bg-cream px-4 py-10">
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

        <div className="card p-7">
          <h1 className="font-display text-2xl font-semibold">
            Create your booking page
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            £19/mo when you go live. No commission, ever.
          </p>

          {error && (
            <p className="mt-4 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {errors[error] ?? "Something went wrong. Please try again."}
            </p>
          )}

          <form action={signupAction} className="mt-6 space-y-4">
            {ref && <input type="hidden" name="ref" value={ref} />}
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
              <div className="flex items-center gap-1.5 rounded-xl border border-edge bg-white/[0.04] px-3.5 focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-500/30">
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
              <Input id="email" name="email" type="email" required />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" required />
            </div>
            <Button type="submit" className="w-full">
              Create my page
            </Button>
          </form>

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
