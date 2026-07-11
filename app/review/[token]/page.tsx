import { notFound } from "next/navigation";
import { CalendarHeart, CheckCircle2, Star } from "lucide-react";
import { supabaseService } from "@/lib/supabase/service";
import { getBookingByToken, getReviewByBookingId, getService, getTechById } from "@/lib/db/queries";
import { SubmitButton } from "@/components/ui/submit-button";
import { rateLimit } from "@/lib/rate-limit";
import { submitReviewAction } from "./actions";

export const metadata = { title: "Leave a review", robots: { index: false, follow: false } };

export default async function ReviewPage({
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
  const booking = await getBookingByToken(sb, token);
  if (!booking) notFound();
  const [tech, service, existing] = await Promise.all([
    getTechById(sb, booking.techId),
    getService(sb, booking.serviceId),
    getReviewByBookingId(sb, booking.id),
  ]);
  if (!tech) notFound();

  const brand = tech.brandColor || "#db2777";
  const submitted = !!existing || sp.done === "1";

  return (
    <div className="grid min-h-screen place-items-center bg-cream px-4 py-10">
      <div className="w-full max-w-md animate-fade-in">
        <div className="card overflow-hidden">
          <div className="px-6 py-7 text-white" style={{ backgroundColor: brand }}>
            <p className="text-sm text-white/80">{tech.businessName}</p>
            <h1 className="font-display text-2xl font-semibold">
              {submitted ? "Thank you!" : "How did it go?"}
            </h1>
          </div>
          <div className="p-6">
            {submitted ? (
              <div className="flex items-center justify-center gap-2 rounded-xl bg-emerald-500/10 px-4 py-4 text-sm font-medium text-emerald-300">
                <CheckCircle2 className="h-5 w-5" /> Your review has been sent to {tech.businessName}.
              </div>
            ) : (
              <form action={submitReviewAction} className="space-y-4">
                <input type="hidden" name="token" value={token} />
                <p className="text-sm text-ink-soft">
                  Rate your {service?.name?.toLowerCase() ?? "appointment"} with {tech.businessName}.
                </p>
                {sp.err === "rating" && (
                  <p className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-300">Please pick a star rating.</p>
                )}
                {/* Row-reversed so "this label or any later sibling checked" fills the
                    star and every star to its left - a pure-CSS star picker. */}
                <div className="flex flex-row-reverse items-center justify-center gap-1">
                  {[5, 4, 3, 2, 1].map((n) => (
                    <label key={n} className="group cursor-pointer p-1" title={`${n} star${n > 1 ? "s" : ""}`}>
                      <input type="radio" name="rating" value={n} required className="sr-only" />
                      <Star className="h-9 w-9 text-ink-faint transition group-has-[input:checked]:fill-amber-400 group-has-[input:checked]:text-amber-400 [label:has(input:checked)~label_&]:fill-amber-400 [label:has(input:checked)~label_&]:text-amber-400" />
                    </label>
                  ))}
                </div>
                <textarea
                  name="comment"
                  placeholder="Anything you'd like to say? (optional)"
                  className="input min-h-[90px]"
                  maxLength={1000}
                />
                <SubmitButton className="w-full bg-none py-3 font-semibold shadow-none" style={{ backgroundColor: brand }} pendingLabel="Sending…">
                  Send review
                </SubmitButton>
              </form>
            )}
          </div>
        </div>
        <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-xs text-ink-faint">
          <CalendarHeart className="h-3.5 w-3.5" /> Powered by Glow
        </p>
      </div>
    </div>
  );
}
