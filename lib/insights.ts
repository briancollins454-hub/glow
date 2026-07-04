import type { Booking, Client, Payment, Service } from "@/lib/db/types";
import { gbp } from "@/lib/format";

export interface BusinessInsight {
  title: string;
  body: string;
  href: string;
  tone: "brand" | "amber" | "green" | "red";
}

export function buildBusinessInsights({
  bookings,
  clients,
  payments,
  services,
}: {
  bookings: Booking[];
  clients: Client[];
  payments: Payment[];
  services: Service[];
}): BusinessInsight[] {
  const now = Date.now();
  const nextSevenDays = now + 7 * 24 * 60 * 60 * 1000;
  const future = bookings.filter((b) => new Date(b.startIso).getTime() >= now && b.status !== "cancelled" && b.status !== "no_show");
  const nextWeek = future.filter((b) => new Date(b.startIso).getTime() <= nextSevenDays);
  const outstanding = future
    .filter((b) => b.balanceStatus === "unpaid")
    .reduce((sum, b) => sum + b.balancePennies, 0);
  const noShowClients = clients.filter((c) => c.noShowCount > 0 && !c.isBlacklisted);
  const completedByService = new Map<string, number>();
  for (const b of bookings) {
    if (b.status === "completed") completedByService.set(b.serviceId, (completedByService.get(b.serviceId) ?? 0) + 1);
  }
  const topService = [...completedByService.entries()].sort((a, b) => b[1] - a[1])[0];
  const topServiceName = topService ? services.find((s) => s.id === topService[0])?.name : "";
  const recentIncome = payments
    .filter((p) => p.status === "succeeded" && new Date(p.createdAt).getTime() > now - 30 * 24 * 60 * 60 * 1000)
    .reduce((sum, p) => sum + (p.kind === "refund" ? -p.amountPennies : p.amountPennies), 0);

  const insights: BusinessInsight[] = [];
  if (nextWeek.length === 0) {
    insights.push({
      title: "Your next 7 days are quiet",
      body: "Share your booking link or send a rebooking message to recent clients before the gap gets expensive.",
      href: "/dashboard/messages",
      tone: "amber",
    });
  }
  if (outstanding > 0) {
    insights.push({
      title: `${gbp(outstanding)} still outstanding`,
      body: "Send balance links before appointments so payment is settled before clients arrive.",
      href: "/dashboard/bookings",
      tone: "green",
    });
  }
  if (noShowClients.length > 0) {
    insights.push({
      title: `${noShowClients.length} client${noShowClients.length === 1 ? "" : "s"} need no-show review`,
      body: "Consider blocking repeat offenders or requiring full payment before they book again.",
      href: "/dashboard/clients",
      tone: "red",
    });
  }
  if (topServiceName && topService && topService[1] >= 3) {
    insights.push({
      title: `${topServiceName} is your repeat winner`,
      body: "Feature it on socials and make sure its aftercare and add-ons are polished.",
      href: "/dashboard/services",
      tone: "brand",
    });
  }
  if (recentIncome > 0 && future.length < 3) {
    insights.push({
      title: "Revenue is coming in, but future cover is thin",
      body: "Use a rebooking prompt at checkout to keep next month from dropping off.",
      href: "/dashboard/reminders",
      tone: "amber",
    });
  }

  return insights.slice(0, 3);
}
