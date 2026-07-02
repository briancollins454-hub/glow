import Link from "next/link";
import { CalendarHeart, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { forgotPasswordAction } from "../actions";

export default async function ForgotPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string }>;
}) {
  const { sent } = await searchParams;
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
          <h1 className="font-display text-2xl font-semibold">Forgot your password?</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Enter your email and we&apos;ll send you a link to choose a new one.
          </p>

          {sent === "1" ? (
            <div className="mt-6 flex items-start gap-3 rounded-xl bg-emerald-500/10 px-4 py-4 text-sm text-emerald-300">
              <MailCheck className="mt-0.5 h-5 w-5 shrink-0" />
              <span>
                If an account exists for that email, a reset link is on its way.
                Check your inbox (and spam folder). The link expires in 1 hour.
              </span>
            </div>
          ) : (
            <form action={forgotPasswordAction} className="mt-6 space-y-4">
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
              <Button type="submit" className="w-full">
                Send reset link
              </Button>
            </form>
          )}

          <p className="mt-5 text-center text-sm text-ink-soft">
            Remembered it?{" "}
            <Link href="/login" className="font-medium text-brand-400">
              Back to log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
