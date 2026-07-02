import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, User } from "lucide-react";
import { getDashboardContext } from "@/lib/auth/session";
import { getClient, markThreadRead, threadMessages } from "@/lib/db/queries";
import { MessageThread } from "@/components/messages/message-thread";
import { sendMessageAction } from "../actions";

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

  await markThreadRead(sb, clientId, "client");
  const messages = await threadMessages(sb, clientId);
  const send = sendMessageAction.bind(null, clientId);

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/messages" className="grid h-9 w-9 place-items-center rounded-xl text-ink-soft hover:bg-black/[0.04] lg:hidden">
          <ArrowLeft className="h-4.5 w-4.5 h-[18px] w-[18px]" />
        </Link>
        <div className="min-w-0">
          <h1 className="truncate font-display text-xl font-semibold">{client.name}</h1>
          <Link href={`/dashboard/clients/${client.id}`} className="flex items-center gap-1 text-xs text-ink-faint hover:text-ink-soft">
            <User className="h-3 w-3" /> View client profile
          </Link>
        </div>
      </div>

      <div className="card flex min-h-0 flex-1 flex-col p-4">
        <MessageThread
          initialMessages={messages}
          me="tech"
          token={client.messageToken}
          supabaseUrl={process.env.SUPABASE_URL!}
          supabaseAnonKey={process.env.SUPABASE_ANON_KEY!}
          onSend={send}
          brand={tech.brandColor || "#db2777"}
          emptyHint={`Send ${client.name.split(" ")[0]} a message — they'll get an email with a private link to reply.`}
        />
      </div>
    </div>
  );
}
