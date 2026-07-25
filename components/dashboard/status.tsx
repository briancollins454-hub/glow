import { Badge } from "@/components/ui/badge";
import type { BookingStatus } from "@/lib/db/types";

type StatusTone = "neutral" | "brand" | "green" | "amber" | "red" | "blue" | "purple";

const map: Record<BookingStatus, { tone: StatusTone; label: string }> = {
  pending_approval: { tone: "purple", label: "Awaiting approval" },
  pending: { tone: "amber", label: "Awaiting deposit" },
  confirmed: { tone: "blue", label: "Confirmed" },
  completed: { tone: "green", label: "Completed" },
  cancelled: { tone: "neutral", label: "Cancelled" },
  no_show: { tone: "red", label: "No-show" },
};

const toneDotClass: Record<StatusTone, string> = {
  neutral: "bg-ink-faint",
  brand: "bg-brand-500",
  green: "bg-success-text",
  amber: "bg-warning-text",
  red: "bg-danger-text",
  blue: "bg-info-text",
  purple: "bg-purple-500",
};

export function statusLabel(status: BookingStatus): string {
  return map[status].label;
}

/** Compact status marker for short calendar blocks (accessible label). */
export function StatusDot({
  status,
  className = "",
}: {
  status: BookingStatus;
  className?: string;
}) {
  const { tone, label } = map[status];
  return (
    <span className={`inline-flex items-center ${className}`} title={label} aria-label={label}>
      <span className={`h-2 w-2 shrink-0 rounded-full ${toneDotClass[tone]}`} />
    </span>
  );
}

export function statusBadge(status: BookingStatus) {
  const { tone, label } = map[status];
  return <Badge tone={tone}>{label}</Badge>;
}
