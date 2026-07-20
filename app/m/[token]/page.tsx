import { notFound } from "next/navigation";
import { heroBrand } from "@/lib/booking/brand";
import { CalendarHeart } from "lucide-react";
import { supabaseService } from "@/lib/supabase/service";
import { getClientByMessageToken, getTechById, threadMessages } from "@/lib/db/queries";
import { isLive } from "@/lib/subscriptions";
import { rateLimit } from "@/lib/rate-limit";
import { MessageThread } from "@/components/messages/message-thread";
import { sendClientMessageAction } from "./actions";
import { BookingThemedPage } from "@/components/theme/booking-themed-page";

export const metadata = { robots: { index: false, follow: false } };

export default async function ClientThreadPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!(await rateLimit("token-lookup", { limit: 30, windowMs: 60_000 })).ok) {
    return (
      <div className="grid min-h-screen place-items-center bg-cream px-4 py-10 text-center text-sm text-ink-soft">
        Too many attempts, try again shortly.
      </div>
    );
  }
  const sb = supabaseService();
  const client = await getClientByMessageToken(sb, token);
  if (!client) notFound();
  const tech = await getTechById(sb, client.techId);
  const messages = await threadMessages(sb, client.id);
  const brand = heroBrand(tech?.brandColor || "#db2777");
  const send = sendClientMessageAction.bind(null, token);
  const live = !!tech && isLive(tech);

  if (!live) {
    return (
      <BookingThemedPage preference={tech?.bookingTheme}>
      <div className="grid min-h-screen place-items-center bg-cream px-4 py-8">
        <div className="w-full max-w-md">
          <div className="card overflow-hidden p-0">
            <div className="px-6 py-5 text-white" style={{ backgroundColor: brand }}>
              <p className="text-xs text-white/80">Chat with</p>
              <h1 className="font-display text-xl font-semibold">{tech?.businessName ?? "your beauty studio"}</h1>
            </div>
            <div className="p-6 text-center text-sm text-ink-soft">
              Messaging isn&apos;t available for this studio right now. Please contact them directly to get in touch.
            </div>
          </div>
          <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-xs text-ink-faint">
            <CalendarHeart className="h-3.5 w-3.5" /> Powered by Glow
          </p>
        </div>
      </div>
    
    </BookingThemedPage>);
  }

  return (
    <BookingThemedPage preference={tech?.bookingTheme}>
    <div className="grid min-h-screen place-items-center bg-cream px-4 py-8">
      <div className="flex h-[88dvh] max-h-[720px] w-full max-w-md flex-col">
        <div className="card flex min-h-0 flex-1 flex-col overflow-hidden p-0">
          <div className="px-6 py-5 text-white" style={{ backgroundColor: brand }}>
            <p className="text-xs text-white/80">Chat with</p>
            <h1 className="font-display text-xl font-semibold">{tech?.businessName ?? "your beauty studio"}</h1>
          </div>
          <div className="flex min-h-0 flex-1 flex-col p-4">
            <MessageThread
              initialMessages={messages}
              me="client"
              token={token}
              supabaseUrl={process.env.SUPABASE_URL!}
              supabaseAnonKey={process.env.SUPABASE_ANON_KEY!}
              onSend={send}
              brand={brand}
              pollSync
              emptyHint="Send a message and we'll get back to you here."
            />
          </div>
        </div>
        <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-xs text-ink-faint">
          <CalendarHeart className="h-3.5 w-3.5" /> Powered by Glow
        </p>
      </div>
    </div>
  
    </BookingThemedPage>);
}
