import * as React from "react";
import { cn } from "@/lib/utils";

type Tone =
  | "neutral"
  | "brand"
  | "green"
  | "amber"
  | "red"
  | "blue"
  | "purple";

const tones: Record<Tone, string> = {
  neutral: "bg-white/[0.07] text-ink-soft",
  brand: "bg-brand-500/100/15 text-brand-300",
  green: "bg-emerald-500/100/15 text-emerald-300",
  amber: "bg-amber-500/100/15 text-amber-300",
  red: "bg-red-500/100/15 text-red-300",
  blue: "bg-sky-500/15 text-sky-300",
  purple: "bg-violet-500/15 text-violet-300",
};

export function Badge({
  tone = "neutral",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
