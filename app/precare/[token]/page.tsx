import { notFound } from "next/navigation";
import { CalendarHeart, CheckCircle2, ClipboardList } from "lucide-react";
import { supabaseService } from "@/lib/supabase/service";
import {
  getBooking,
  getPreCareConfirmationByToken,
  getService,
  getTechById,
} from "@/lib/db/queries";
import { fmtDateTime } from "@/lib/format";
import { SubmitButton } from "@/components/ui/submit-button";
import { submitPrecareAction } from "./actions";

export const metadata = { title: "Pre-care instructions", robots: { index: false, follow: false } };

export default async function PrecarePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ done?: string; err?: string }>;
}) {
  const { token } = await params;
  const sp = await searchParams;
  const sb = supabaseService();
  const row = await getPreCareConfirmationByToken(sb, token);
  if (!row) notFound();

  const [tech, booking] = await Promise.all([
    getTechById(sb, row.techId),
    getBooking(sb, row.bookingId),
  ]);
  if (!tech || !booking) notFound();

  const service = await getService(sb, booking.serviceId);
  const instructions = service?.precareText?.trim();
  if (!instructions) notFound();

  const brand = tech.brandColor || "#db2777";
  const confirmed = row.status === "confirmed" || sp.done === "1";
  const inactive = row.status === "skipped";

  return (
    <div className="grid min-h-screen place-items-center bg-cream px-4 py-10">
      <div className="w-full max-w-md animate-fade-in">
        <div className="card overflow-hidden">
          <div className="px-6 py-7 text-white" style={{ backgroundColor: brand }}>
            <p className="text-sm text-white/80">{tech.businessName}</p>
            <h1 className="font-display text-2xl font-semibold">
              {confirmed ? "Thanks — you're all set" : "Before your appointment"}
            </h1>
          </div>
          <div className="p-6">
            {confirmed ? (
              <div className="flex items-center justify-center gap-2 rounded-xl bg-emerald-500/10 px-4 py-4 text-sm font-medium text-emerald-300">
                <CheckCircle2 className="h-5 w-5" />
                We&apos;ve noted that you&apos;ve read the preparation instructions.
              </div>
            ) : inactive ? (
              <p className="text-sm text-ink-soft">This link is no longer active.</p>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-ink-soft">
                  Your <strong className="text-ink">{service?.name ?? "appointment"}</strong> is on{" "}
                  <strong className="text-ink">{fmtDateTime(booking.startIso)}</strong>.
                </p>

                <div className="rounded-xl border border-edge bg-cream px-4 py-3">
                  <p className="flex items-center gap-2 text-sm font-medium text-ink">
                    <ClipboardList className="h-4 w-4 text-brand-300" />
                    Preparation instructions
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-ink-soft">{instructions}</p>
                </div>

                {sp.err && (
                  <p className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-300">
                    {sp.err === "expired"
                      ? "This appointment is no longer active."
                      : "Something went wrong. Please try again."}
                  </p>
                )}

                <form action={submitPrecareAction}>
                  <input type="hidden" name="token" value={token} />
                  <SubmitButton
                    className="w-full bg-none py-3 font-semibold shadow-none"
                    style={{ backgroundColor: brand }}
                    pendingLabel="Saving…"
                  >
                    I&apos;ve read and understood
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
  );
}
