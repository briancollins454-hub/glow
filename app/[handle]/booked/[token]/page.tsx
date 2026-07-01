import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, CalendarHeart, CreditCard } from "lucide-react";
import { supabaseService } from "@/lib/supabase/service";
import { getBookingByToken, getService, getTechByHandle } from "@/lib/db/queries";
import { gbp, fmtDateTime } from "@/lib/format";

export default async function BookedPage({ params }: { params: Promise<{ handle: string; token: string }> }) {
  const { handle, token } = await params;
  const sb = supabaseService();
  const [tech, booking] = await Promise.all([getTechByHandle(sb, handle), getBookingByToken(sb, token)]);
  if (!tech || !booking || booking.techId !== tech.id) notFound();
  const service = await getService(sb, booking.serviceId);
  const brand = tech.brandColor || "#db2777";

  return (
    <div className="grid min-h-screen place-items-center bg-cream px-4 py-10">
      <div className="w-full max-w-md animate-fade-in">
        <div className="card overflow-hidden">
          <div className="px-6 py-8 text-center text-white" style={{ backgroundColor: brand }}>
            <CheckCircle2 className="mx-auto h-12 w-12" />
            <h1 className="mt-3 font-display text-2xl font-semibold">You&apos;re booked in!</h1>
            <p className="mt-1 text-sm text-white/85">A confirmation has been sent to you.</p>
          </div>
          <div className="space-y-4 p-6">
            <Row label="Service" value={service?.name ?? "Appointment"} />
            <Row label="When" value={fmtDateTime(booking.startIso)} />
            <Row label="With" value={tech.businessName} />
            <hr className="border-black/5" />
            <Row label="Total" value={gbp(booking.pricePennies)} />
            <Row label="Deposit paid" value={booking.depositStatus === "paid" ? gbp(booking.depositPennies) : "—"} />
            <Row label="Balance due on the day" value={gbp(booking.balancePennies)} strong />
            {booking.balancePennies > 0 && booking.balanceStatus !== "paid" && (
              <Link href={`/pay/${booking.balanceToken}`} className="flex w-full items-center justify-center gap-2 rounded-xl py-3 font-semibold text-white" style={{ backgroundColor: brand }}>
                <CreditCard className="h-4 w-4" /> Pay balance now (optional)
              </Link>
            )}
            <Link href={`/${tech.handle}`} className="flex w-full items-center justify-center gap-2 rounded-xl border border-black/10 py-3 text-sm font-medium text-ink-soft hover:bg-black/[0.03]">Back to {tech.businessName}</Link>
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
