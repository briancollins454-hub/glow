/** Reasons a dashboard tech may explicitly confirm past. */
export type OverbookableSlotReason = "conflict" | "blocked" | "outside_hours";

export function isOverbookableReason(reason: string): reason is OverbookableSlotReason {
  return reason === "conflict" || reason === "blocked" || reason === "outside_hours";
}

/** Named confirmation copy for picker + banners. */
export function overbookConfirmMessage(
  reason: OverbookableSlotReason,
  opts?: { clientName?: string; time?: string },
): string {
  if (reason === "blocked") return "This time is blocked. Book anyway?";
  if (reason === "outside_hours") {
    return "This is outside your working hours. Book anyway?";
  }
  const name = opts?.clientName?.trim() || "another client";
  const time = opts?.time?.trim();
  return time
    ? `This slot is taken by ${name} at ${time}. Book anyway?`
    : `This slot is taken by ${name}. Book anyway?`;
}
