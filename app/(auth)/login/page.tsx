import Link from "next/link";
import { CalendarHeart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { ClearSessionCache } from "@/components/auth/clear-session-cache";
import { loginAction } from "../actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; reset?: string; signedup?: string }>;
}) {
  const { error, reset, signedup } = await searchParams;
  return (
    <div className="grid min-h-screen place-items-center bg-cream px-4">
      <ClearSessionCache />
      <div className="w-full max-w-md animate-fade-in">
        <Link href="/" className="mb-6 flex items-center justify-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-600 text-white">
            <CalendarHeart className="h-5 w-5" />
          </span>
          <span className="font-display text-xl font-semibold">Glow</span>
        </Link>
        <div className="card p-7">
          <h1 className="font-display text-2xl font-semibold">Welcome back</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Log in to manage your bookings.
          </p>

          {reset === "1" && (
            <p className="mt-4 rounded-xl bg-success-soft px-4 py-3 text-sm text-success-text">
              Password updated. Log in with your new password.
            </p>
          )}
          {signedup === "1" && (
            <p className="mt-4 rounded-xl bg-success-soft px-4 py-3 text-sm text-success-text">
              Your account is ready. Log in with the password you just chose.
            </p>
          )}
          {error && (
            <p className="mt-4 rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger-text">
              That email and password don&apos;t match. Try again.
            </p>
          )}

          <form action={loginAction} className="mt-6 space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                placeholder="you@example.com"
              />
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <Label htmlFor="password" className="mb-0">Password</Label>
                <Link href="/forgot" className="text-xs font-medium text-brand-400 hover:text-brand-text">
                  Forgot password?
                </Link>
              </div>
              <Input
                id="password"
                name="password"
                type="password"
                required
                placeholder="••••••••"
              />
            </div>
            <Button type="submit" className="w-full">
              Log in
            </Button>
          </form>

          <p className="mt-5 text-center text-sm text-ink-soft">
            No account?{" "}
            <Link href="/signup" className="font-medium text-brand-400">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
