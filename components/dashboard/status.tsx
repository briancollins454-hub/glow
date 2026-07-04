import { Badge } from "@/components/ui/badge";
import type { BookingStatus } from "@/lib/db/types";

const map: Record<BookingStatus, { tone: "neutral" | "brand" | "green" | "amber" | "red" | "blue" | "purple"; label: string }> = {
  pending: { tone: "amber", label: "Awaiting deposit" },
  confirmed: { tone: "blue", label: "Confirmed" },
  completed: { tone: "green", label: "Completed" },
  cancelled: { tone: "neutral", label: "Cancelled" },
  no_show: { tone: "red", label: "No-show" },
};

export function statusBadge(status: BookingStatus) {
  const { tone, label } = map[status];
  return <Badge tone={tone}>{label}</Badge>;
}
