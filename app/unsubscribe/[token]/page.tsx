import { notFound } from "next/navigation";
import { heroBrand } from "@/lib/booking/brand";
import { BellOff, CalendarHeart, CheckCircle2 } from "lucide-react";
import { supabaseService } from "@/lib/supabase/service";
import { getClientByMessageToken, getTechById } from "@/lib/db/queries";
import { SubmitButton } from "@/components/ui/submit-button";
import { setMarketingOptOutAction } from "./actions";

export const metadata = { title: "Email preferences", robots: { index: false, follow: false } };

export default async function UnsubscribePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ done?: string }>;
}) {
  const { token } = await params;
  const sp = await searchParams;
  const sb = supabaseService();
  const client = await getClientByMessageToken(sb, token);
  if (!client) notFound();
  const tech = await getTechById(sb, client.techId);
  const biz = tech?.businessName ?? "this studio";
  const brand = heroBrand(tech?.brandColor || "#db2777");

  return (
    <div className="grid min-h-screen place-items-center bg-cream px-4 py-10">
      <div className="w-full max-w-md animate-fade-in">
        <div className="card overflow-hidden">
          <div className="px-6 py-7 text-white" style={{ backgroundColor: brand }}>
            <p className="text-sm text-white/80">{biz}</p>
            <h1 className="font-display text-2xl font-semibold">Email preferences</h1>
          </div>
          <div className="space-y-4 p-6">
            {sp.done === "out" && (
              <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
                <CheckCircle2 className="h-4 w-4" /> Done - no more marketing emails from {biz}.
              </div>
            )}
            {sp.done === "in" && (
              <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
                <CheckCircle2 className="h-4 w-4" /> You&apos;re back on the list.
              </div>
            )}
            <p className="text-sm text-ink-soft">
              This controls friendly &ldquo;time to rebook&rdquo; emails from {biz}. Appointment
              confirmations and reminders for bookings you make are always sent.
            </p>
            <p className="text-sm">
              Current setting:{" "}
              <span className="font-semibold">
                {client.marketingOptOut ? "Not receiving marketing emails" : "Receiving marketing emails"}
              </span>
            </p>
            <form action={setMarketingOptOutAction}>
              <input type="hidden" name="token" value={token} />
              <input type="hidden" name="optOut" value={client.marketingOptOut ? "0" : "1"} />
              <SubmitButton
                className="w-full bg-none py-3 font-semibold shadow-none"
                style={{ backgroundColor: client.marketingOptOut ? brand : "#57534e" }}
                pendingLabel="Saving…"
              >
                <BellOff className="h-4 w-4" />
                {client.marketingOptOut ? "Turn marketing emails back on" : "Unsubscribe from marketing emails"}
              </SubmitButton>
            </form>
          </div>
        </div>
        <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-xs text-ink-faint">
          <CalendarHeart className="h-3.5 w-3.5" /> Powered by Glow
        </p>
      </div>
    </div>
  );
}
