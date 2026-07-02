import Link from "next/link";
import { notFound } from "next/navigation";
import { CreditCard, CheckCircle2, CalendarHeart } from "lucide-react";
import { supabaseService } from "@/lib/supabase/service";
import { getBookingByToken, getService, getTechById } from "@/lib/db/queries";
import { retrieveCheckout } from "@/lib/payments";
import { applyBalancePaid } from "@/lib/bookings";
import { gbp, fmtDateTime } from "@/lib/format";
import { payBalanceAction } from "../actions";

export default async function PayPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ session_id?: string; paid?: string; err?: string }>;
}) {
  const { token } = await params;
  const sp = await searchParams;
  const sb = supabaseService();
  let booking = await getBookingByToken(sb, token);
  if (!booking) notFound();
  const tech = await getTechById(sb, booking.techId);

  // Verify balance payment on return from Stripe.
  if (sp.session_id && tech && booking.balanceStatus !== "paid") {
    const session = await retrieveCheckout(tech, sp.session_id);
    if (session?.payment_status === "paid") {
      const pi =
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : session.payment_intent?.id ?? "";
      await applyBalancePaid(sb, booking, pi);
      booking = (await getBookingByToken(sb, token)) ?? booking;
    }
  }

  const service = await getService(sb, booking.serviceId);
  const brand = tech?.brandColor || "#db2777";
  const settled = booking.balanceStatus === "paid" || booking.balancePennies === 0;

  return (
    <div className="grid min-h-screen place-items-center bg-cream px-4 py-10">
      <div className="w-full max-w-md animate-fade-in">
        <div className="card overflow-hidden">
          <div className="px-6 py-7 text-white" style={{ backgroundColor: brand }}>
            <p className="text-sm text-white/80">{tech?.businessName}</p>
            <h1 className="font-display text-2xl font-semibold">Pay your balance</h1>
          </div>
          <div className="space-y-4 p-6">
            <Row label="Service" value={service?.name ?? "Appointment"} />
            <Row label="Appointment" value={fmtDateTime(booking.startIso)} />
            <hr className="border-black/5" />
            <Row label="Total" value={gbp(booking.pricePennies)} />
            <Row label="Deposit paid" value={booking.depositStatus === "paid" ? `- ${gbp(booking.depositPennies)}` : "—"} />
            <Row label="Balance" value={gbp(booking.balancePennies)} strong />
            {sp.err === "unavailable" && (
              <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
                Online balance payment isn&apos;t available for this studio. Please pay on the day.
              </p>
            )}
            {settled ? (
              <div className="flex items-center justify-center gap-2 rounded-xl bg-emerald-50 px-4 py-4 text-sm font-medium text-emerald-700"><CheckCircle2 className="h-5 w-5" /> Balance paid in full. Thank you!</div>
            ) : (
              <form action={payBalanceAction}>
                <input type="hidden" name="token" value={token} />
                <button type="submit" className="flex w-full items-center justify-center gap-2 rounded-xl py-3 font-semibold text-white" style={{ backgroundColor: brand }}><CreditCard className="h-4 w-4" /> Pay {gbp(booking.balancePennies)} now</button>
              </form>
            )}
          </div>
        </div>
        <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-xs text-ink-faint"><CalendarHeart className="h-3.5 w-3.5" /> Powered by Glow</p>
      </div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-ink-faint">{label}</span>
      <span className={strong ? "text-base font-semibold" : "font-medium"}>{value}</span>
    </div>
  );
}
