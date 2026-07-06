import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, User } from "lucide-react";
import { getDashboardContext } from "@/lib/auth/session";
import { getClient, markThreadRead, threadMessages } from "@/lib/db/queries";
import { isLive } from "@/lib/subscriptions";
import { UpgradePrompt } from "@/components/dashboard/upgrade-prompt";
import { Trash2 } from "lucide-react";
import { LazyMessageThread } from "@/components/messages/lazy-message-thread";
import { sendMessageAction, deleteConversationAction } from "../actions";

export default async function DashboardThreadPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const c = await getDashboardContext();
  if (!c) redirect("/login");
  const { sb, tech } = c;
  const client = await getClient(sb, clientId);
  if (!client) notFound();

  if (!isLive(tech)) {
    return (
      <div className="space-y-6">
        <Link href="/dashboard/messages" className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-soft hover:text-ink">
          <ArrowLeft className="h-4 w-4" /> Messages
        </Link>
        <UpgradePrompt feature="Client messaging" />
      </div>
    );
  }

  await markThreadRead(sb, clientId, "client");
  const messages = await threadMessages(sb, clientId);
  const send = sendMessageAction.bind(null, clientId);

  return (
    <div className="flex h-[calc(100dvh-16rem)] flex-col space-y-4 lg:h-[calc(100dvh-8rem)]">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/messages" className="grid h-9 w-9 place-items-center rounded-xl text-ink-soft hover:bg-white/[0.06] lg:hidden">
          <ArrowLeft className="h-4.5 w-4.5 h-[18px] w-[18px]" />
        </Link>
        <div className="min-w-0">
          <h1 className="truncate font-display text-xl font-semibold">{client.name}</h1>
          <Link href={`/dashboard/clients/${client.id}`} className="flex items-center gap-1 text-xs text-ink-faint hover:text-ink-soft">
            <User className="h-3 w-3" /> View client profile
          </Link>
        </div>
        <form action={deleteConversationAction} className="ml-auto">
          <input type="hidden" name="clientId" value={client.id} />
          <button
            type="submit"
            className="grid h-9 w-9 place-items-center rounded-xl text-ink-faint hover:bg-red-500/10 hover:text-red-400"
            title="Delete this conversation"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </form>
      </div>

      <div className="card flex min-h-0 flex-1 flex-col p-4">
        <LazyMessageThread
          initialMessages={messages}
          me="tech"
          token={client.messageToken}
          supabaseUrl={process.env.SUPABASE_URL!}
          supabaseAnonKey={process.env.SUPABASE_ANON_KEY!}
          onSend={send}
          brand={tech.brandColor || "#db2777"}
          emptyHint={`Send ${client.name.split(" ")[0]} a message - they'll get an email with a private link to reply.`}
        />
      </div>
    </div>
  );
}
