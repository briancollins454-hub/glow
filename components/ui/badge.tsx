import { cn } from "@/lib/utils";
import * as React from "react";

type Tone =
  | "neutral"
  | "brand"
  | "green"
  | "amber"
  | "red"
  | "blue"
  | "purple";

const tones: Record<Tone, string> = {
  neutral: "bg-fill-hover text-ink-soft",
  brand: "bg-brand-soft text-brand-text",
  green: "bg-success-soft text-success-text",
  amber: "bg-warning-soft text-warning-text",
  red: "bg-danger-soft text-danger-text",
  blue: "bg-info-soft text-info-text",
  purple: "bg-pending-soft text-pending-text",
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
