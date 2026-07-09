"use client";

import { useEffect, useRef, useState } from "react";
import { createClient, type RealtimeChannel } from "@supabase/supabase-js";
import { Send } from "lucide-react";
import type { Message, MessageSender } from "@/lib/db/types";
import type { SendResult } from "@/app/dashboard/messages/actions";
import { clearDashboardCache } from "@/lib/dashboard/client-cache";

export function MessageThread({
  initialMessages,
  me,
  token,
  supabaseUrl,
  supabaseAnonKey,
  onSend,
  brand,
  emptyHint,
  pollSync = false,
}: {
  initialMessages: Message[];
  me: MessageSender;
  token: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  onSend: (body: string) => Promise<SendResult>;
  brand: string;
  emptyHint?: string;
  /** Poll for new messages (client threads — backup when realtime misses). */
  pollSync?: boolean;
}) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => setMounted(true), []);

  const upsert = (m: Message) =>
    setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));

  useEffect(() => {
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const channel = supabase
      .channel(`thread-${token}`, { config: { broadcast: { self: false } } })
      .on("broadcast", { event: "msg" }, (payload) => {
        const m = payload.payload as Message;
        if (m && m.id) upsert(m);
      })
      .subscribe();
    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [supabaseUrl, supabaseAnonKey, token]);

  useEffect(() => {
    if (!pollSync) return;

    const mergeThread = (fresh: Message[]) => {
      setMessages((prev) => {
        const byId = new Map(prev.map((m) => [m.id, m]));
        for (const m of fresh) byId.set(m.id, m);
        return Array.from(byId.values()).sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        );
      });
    };

    const sync = async () => {
      try {
        const res = await fetch(`/api/messages/sync?${new URLSearchParams({ token })}`);
        if (!res.ok) return;
        const data = (await res.json()) as { messages?: Message[] };
        mergeThread(data.messages ?? []);
      } catch {
        // Best-effort polling.
      }
    };

    void sync();
    const interval = window.setInterval(sync, 5_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void sync();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [pollSync, token]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text || sending) return;
    setSending(true);
    setError(null);
    setNotice(null);
    const res = await onSend(text);
    setSending(false);
    if (!res.ok || !res.message) {
      setError(res.error ?? "Couldn't send. Try again.");
      return;
    }
    setBody("");
    upsert(res.message);
    channelRef.current?.send({ type: "broadcast", event: "msg", payload: res.message });
    if (me === "tech") {
      clearDashboardCache("messages");
      if (res.emailNote) setNotice(res.emailNote);
    }
  }

  return (
    <div className="flex h-full flex-col">
      {notice && (
        <p className="mb-3 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-100/90">
          {notice}
        </p>
      )}
      <div className="flex-1 space-y-3 overflow-y-auto p-1">
        {messages.length === 0 && (
          <p className="py-10 text-center text-sm text-ink-faint">
            {emptyHint ?? "No messages yet. Say hello!"}
          </p>
        )}
        {messages.map((m) => {
          const mine = m.sender === me;
          return (
            <div key={m.id} className={mine ? "flex justify-end" : "flex justify-start"}>
              <div
                className={
                  "max-w-[78%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed " +
                  (mine ? "text-white" : "bg-white/[0.07] text-ink")
                }
                style={mine ? { backgroundColor: brand } : undefined}
              >
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                <p suppressHydrationWarning className={"mt-1 text-[11px] " + (mine ? "text-white/70" : "text-ink-faint")}>
                  {mounted
                    ? new Date(m.createdAt).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "\u00a0"}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {error && <p className="px-1 pt-2 text-sm text-red-400">{error}</p>}

      <form onSubmit={submit} className="mt-3 flex items-end gap-2 border-t border-edge pt-3">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit(e);
            }
          }}
          rows={1}
          placeholder="Type a message…"
          className="max-h-32 min-h-[44px] flex-1 resize-none rounded-xl border border-edge bg-white/[0.04] px-3 py-2.5 text-base outline-none focus:border-brand-400 sm:text-sm"
        />
        <button
          type="submit"
          disabled={sending || !body.trim()}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-white disabled:opacity-50"
          style={{ backgroundColor: brand }}
          title="Send"
        >
          <Send className="h-[18px] w-[18px]" />
        </button>
      </form>
    </div>
  );
}
