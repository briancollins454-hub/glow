import Link from "next/link";
import { CalendarHeart, TimerOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { validateResetToken } from "@/lib/password-reset";
import { resetPasswordAction } from "./actions";

export const metadata = { robots: { index: false, follow: false } };

export default async function ResetPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const { error } = await searchParams;
  const tech = await validateResetToken(token);

  return (
    <div className="grid min-h-screen place-items-center bg-cream px-4">
      <div className="w-full max-w-md animate-fade-in">
        <Link href="/" className="mb-6 flex items-center justify-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-600 text-white">
            <CalendarHeart className="h-5 w-5" />
          </span>
          <span className="font-display text-xl font-semibold">Glow</span>
        </Link>
        <div className="card p-7">
          {!tech ? (
            <>
              <div className="flex items-start gap-3">
                <TimerOff className="mt-1 h-5 w-5 shrink-0 text-warning-text" />
                <div>
                  <h1 className="font-display text-2xl font-semibold">This link has expired</h1>
                  <p className="mt-1 text-sm text-ink-soft">
                    Reset links work once and expire after 1 hour. Request a fresh one and try again.
                  </p>
                </div>
              </div>
              <Link href="/forgot" className="mt-6 block">
                <Button type="button" className="w-full">Request a new link</Button>
              </Link>
            </>
          ) : (
            <>
              <h1 className="font-display text-2xl font-semibold">Choose a new password</h1>
              <p className="mt-1 text-sm text-ink-soft">for {tech.email}</p>

              {error === "short" && (
                <p className="mt-4 rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger-text">
                  Password needs to be at least 8 characters.
                </p>
              )}
              {error === "match" && (
                <p className="mt-4 rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger-text">
                  Those passwords don&apos;t match. Try again.
                </p>
              )}
              {error === "failed" && (
                <p className="mt-4 rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger-text">
                  Something went wrong. Request a new link and try again.
                </p>
              )}

              <form action={resetPasswordAction} className="mt-6 space-y-4">
                <input type="hidden" name="token" value={token} />
                <div>
                  <Label htmlFor="password">New password</Label>
                  <Input id="password" name="password" type="password" required minLength={8} placeholder="At least 8 characters" />
                </div>
                <div>
                  <Label htmlFor="confirm">Confirm new password</Label>
                  <Input id="confirm" name="confirm" type="password" required minLength={8} placeholder="Repeat it" />
                </div>
                <Button type="submit" className="w-full">Set new password</Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
