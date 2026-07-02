import Link from "next/link";
import { CalendarHeart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { loginAction } from "../actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
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
          <h1 className="font-display text-2xl font-semibold">Welcome back</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Log in to manage your bookings.
          </p>

          {error && (
            <p className="mt-4 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-300">
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
                defaultValue="demo@glow.app"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                defaultValue="password123"
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
        <p className="mt-4 text-center text-xs text-ink-faint">
          Demo: demo@glow.app / password123
        </p>
      </div>
    </div>
  );
}
