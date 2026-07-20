import { notFound } from "next/navigation";
import { heroBrand } from "@/lib/booking/brand";
import { CalendarHeart, CheckCircle2, HeartPulse } from "lucide-react";
import { supabaseService } from "@/lib/supabase/service";
import { getCategory, getReactionCheckinByToken, getTechById } from "@/lib/db/queries";
import { SubmitButton } from "@/components/ui/submit-button";
import { rateLimit } from "@/lib/rate-limit";
import { submitCheckinAction } from "./actions";
import { BookingThemedPage } from "@/components/theme/booking-themed-page";

export const metadata = { title: "Reaction check-in", robots: { index: false, follow: false } };

export default async function CheckinPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ done?: string; err?: string }>;
}) {
  const { token } = await params;
  const sp = await searchParams;
  if (!(await rateLimit("token-lookup", { limit: 30, windowMs: 60_000 })).ok || sp.err === "rate") {
    return (
      <div className="grid min-h-screen place-items-center bg-cream px-4 py-10 text-center text-sm text-ink-soft">
        Too many attempts, try again shortly.
      </div>
    );
  }
  const sb = supabaseService();
  const checkin = await getReactionCheckinByToken(sb, token);
  if (!checkin) notFound();

  const [tech, category] = await Promise.all([
    getTechById(sb, checkin.techId),
    getCategory(sb, checkin.categoryId),
  ]);
  if (!tech) notFound();

  const brand = heroBrand(tech.brandColor || "#db2777");
  const responded = checkin.status === "responded" || sp.done === "1";
  const catName = category?.name?.toLowerCase() ?? "your treatment";

  return (
    <BookingThemedPage preference={tech?.bookingTheme}>
    <div className="grid min-h-screen place-items-center bg-cream px-4 py-10">
      <div className="w-full max-w-md animate-fade-in">
        <div className="card overflow-hidden">
          <div className="px-6 py-7 text-white" style={{ backgroundColor: brand }}>
            <p className="text-sm text-white/80">{tech.businessName}</p>
            <h1 className="font-display text-2xl font-semibold">
              {responded ? "Thanks for letting us know" : "Quick check-in"}
            </h1>
          </div>
          <div className="p-6">
            {responded ? (
              <div className="flex items-center justify-center gap-2 rounded-xl bg-emerald-500/10 px-4 py-4 text-sm font-medium text-emerald-300">
                <CheckCircle2 className="h-5 w-5" />
                {checkin.response === "reaction"
                  ? `${tech.businessName} has been notified and will be in touch.`
                  : "Glad to hear you're doing well!"}
              </div>
            ) : checkin.status === "skipped" ? (
              <p className="text-sm text-ink-soft">This check-in link is no longer active.</p>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-ink-soft">
                  It&apos;s been 48 hours since your {catName} patch test or treatment. Delayed reactions
                  can sometimes appear around now.
                </p>
                <p className="text-sm font-medium text-ink">
                  Any redness, swelling, itching or irritation?
                </p>

                {sp.err === "symptoms" && (
                  <p className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-300">
                    Please describe what you&apos;re experiencing.
                  </p>
                )}
                {sp.err && sp.err !== "symptoms" && (
                  <p className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-300">
                    Something went wrong. Please try again or message your tech directly.
                  </p>
                )}

                <form action={submitCheckinAction}>
                  <input type="hidden" name="token" value={token} />
                  <input type="hidden" name="response" value="fine" />
                  <SubmitButton
                    className="w-full bg-none py-3 font-semibold shadow-none"
                    style={{ backgroundColor: brand }}
                    pendingLabel="Sending…"
                  >
                    <HeartPulse className="h-4 w-4" /> I&apos;m fine, no reaction
                  </SubmitButton>
                </form>

                <form action={submitCheckinAction} className="space-y-3 border-t border-edge pt-4">
                  <input type="hidden" name="token" value={token} />
                  <input type="hidden" name="response" value="reaction" />
                  <label className="block text-sm font-medium text-ink">
                    I&apos;ve had a reaction
                  </label>
                  <textarea
                    name="symptoms"
                    required
                    placeholder="e.g. Redness and itching around my eyes since yesterday evening"
                    className="input min-h-[90px]"
                    maxLength={1000}
                  />
                  <SubmitButton variant="secondary" className="w-full" pendingLabel="Sending…">
                    Report reaction
                  </SubmitButton>
                </form>
              </div>
            )}
          </div>
        </div>
        <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-xs text-ink-faint">
          <CalendarHeart className="h-3.5 w-3.5" /> Powered by Glow
        </p>
      </div>
    </div>
  
    </BookingThemedPage>);
}
