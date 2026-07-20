"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type { MessageThread } from "@/components/messages/message-thread";

const MessageThreadLazy = dynamic(
  () => import("@/components/messages/message-thread").then((m) => m.MessageThread),
  {
    ssr: false,
    loading: () => <div className="flex-1 animate-pulse rounded-xl bg-fill" />,
  },
);

export function LazyMessageThread(props: ComponentProps<typeof MessageThread>) {
  return <MessageThreadLazy {...props} />;
}
