"use client";

import { useState } from "react";
import { Check, Copy, Link2 } from "lucide-react";

export function ClientMessageLink({ url, compact }: { url: string; compact?: boolean }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this link for your client:", url);
    }
  };

  if (compact) {
    return (
      <button
        type="button"
        onClick={copy}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-300 hover:text-brand-200"
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        {copied ? "Copied" : "Copy client message link"}
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-edge bg-cream px-4 py-3 text-sm">
      <p className="flex items-center gap-2 font-medium text-ink">
        <Link2 className="h-4 w-4 text-brand-400" />
        Client message link
      </p>
      <p className="mt-1 text-xs leading-relaxed text-ink-faint">
        Clients without an email need this link to read your messages. They can bookmark it to reply anytime.
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <code className="max-w-full truncate rounded-lg bg-white/[0.04] px-2 py-1 text-xs text-ink-soft">{url}</code>
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1 rounded-lg border border-edge px-2.5 py-1 text-xs font-medium text-ink-soft hover:bg-white/[0.06]"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}
