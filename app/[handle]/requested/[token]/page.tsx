import Link from "next/link";
import { heroBrand } from "@/lib/booking/brand";
import { notFound } from "next/navigation";
import { Clock, CalendarHeart } from "lucide-react";
import { supabaseService } from "@/lib/supabase/service";
import { getBookingByToken, getService, getTechByHandle, listBookingsByGroup } from "@/lib/db/queries";
import { fmtDateTime } from "@/lib/format";

export const metadata = { robots: { index: false, follow: false } };

export default async function RequestedBookingPage({
  params,
}: {
  params: Promise<{ handle: string; token: string }>;
}) {
  const { handle, token } = await params;

  const sb = supabaseService();
  const [tech, booking] = await Promise.all([
    getTechByHandle(sb, handle),
    getBookingByToken(sb, token),
  ]);
  if (!tech || !booking || booking.techId !== tech.id) notFound();

  const service = await getService(sb, booking.serviceId);
  let serviceLabel = service?.name ?? "Appointment";
  if (booking.groupId) {
    const group = await listBookingsByGroup(sb, booking.groupId);
    if (group.length > 1) {
      const names = (
        await Promise.all(group.map((b) => getService(sb, b.serviceId)))
      ).map((s) => s?.name ?? "Treatment");
      serviceLabel = names.join(" + ");
    }
  }
  const brand = heroBrand(tech.brandColor || "#db2777");

  return (
    <div className="grid min-h-screen place-items-center bg-cream px-4 py-10">
      <div className="w-full max-w-md animate-fade-in">
        <div className="card overflow-hidden">
          <div className="px-6 py-8 text-center text-white" style={{ backgroundColor: brand }}>
            <Clock className="mx-auto h-12 w-12" />
            <h1 className="mt-3 font-display text-2xl font-semibold">Request sent</h1>
            <p className="mt-1 text-sm text-white/85">
              {tech.businessName} will review your booking. You&apos;ll get an email to pay your deposit once
              approved.
            </p>
          </div>
          <div className="space-y-4 p-6">
            <Row label={serviceLabel.includes("+") ? "Treatments" : "Service"} value={serviceLabel} />
            <Row label="Requested time" value={fmtDateTime(booking.startIso)} />
            <p className="text-sm text-ink-soft">
              No payment has been taken yet. If you don&apos;t hear back, contact {tech.businessName} directly.
            </p>
            <Link
              href={`/${tech.handle}`}
              className="flex w-full items-center justify-center rounded-xl border border-edge py-3 text-sm font-medium text-ink-soft hover:bg-white/[0.06]"
            >
              Back to {tech.businessName}
            </Link>
          </div>
        </div>
        <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-xs text-ink-faint">
          <CalendarHeart className="h-3.5 w-3.5" /> Powered by Glow
        </p>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-ink-faint">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
