/** Short labels for client email deliverability badges. */
export function clientEmailDeliveryBadge(
  client: {
    emailSuppressed?: boolean | null;
    emailSuppressionReason?: string | null;
    emailSoftBounceCount?: number | null;
  },
): { tone: "red" | "amber"; label: string } | null {
  if (client.emailSuppressed) {
    if (client.emailSuppressionReason === "complaint") {
      return { tone: "red", label: "Email marked as spam" };
    }
    if (client.emailSuppressionReason === "soft_bounce") {
      return { tone: "red", label: "Email suppressed (bounces)" };
    }
    return { tone: "red", label: "Email bouncing — fix address" };
  }
  const soft = client.emailSoftBounceCount ?? 0;
  if (soft > 0) {
    return { tone: "amber", label: "This client's email is bouncing" };
  }
  return null;
}
