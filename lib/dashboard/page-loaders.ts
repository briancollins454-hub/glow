import type { SupabaseClient } from "@supabase/supabase-js";
import {
  completedVisitCounts,
  countBlacklistedClients,
  countNoShowBookings,
  countTodayBookings,
  countUpcomingBookings,
  getBookingsByIds,
  getClientNameMap,
  getClientsByIds,
  getReportSummary,
  listAddons,
  listBookings,
  listBookingsInWindow,
  listCategories,
  listClients,
  listInsightBookings,
  listMessagesForTech,
  listProductChangeRetests,
  listProducts,
  listQuestions,
  listRecentPayments,
  listInfillDeadlineNudges,
  listPreCareConfirmations,
  listReactionCheckins,
  listReminders,
  listReviewsForTech,
  listServices,
  listTimeOff,
  listUpcomingBookings,
  listPastBookingsNeedingWrapUp,
  listWaitlist,
  listWorkingHours,
  sumMonthIncome,
  sumOutstandingBalances,
} from "@/lib/db/queries";
import { batchSummaries } from "@/lib/product-batches";
import { signedPhotoUrls } from "@/lib/storage";
import { isAdminTech } from "@/lib/admin";
import { canAccessSupportImport } from "@/lib/import/support-auth";
import { getPlatformTraffic } from "@/lib/traffic-stats";
import { buildBusinessInsights } from "@/lib/insights";
import { filterLateCascadeBookings } from "@/lib/running-late-filter";
import { dateStrInTz } from "@/lib/rules";
import { fmtDate } from "@/lib/format";
import type { Tech } from "@/lib/db/types";
import { supabaseService, serviceConfigured } from "@/lib/supabase/service";
import { isLive } from "@/lib/subscriptions";

type Ctx = { sb: SupabaseClient; tech: Tech; role?: "owner" | "staff" };

export const DASHBOARD_DATA_KEYS = [
  "home",
  "bookings",
  "services",
  "clients",
  "availability",
  "team",
  "forms",
  "reminders",
  "reviews",
  "reports",
  "messages",
  "billing",
  "import",
  "feedback",
  "admin",
  "admin-support-import",
] as const;

export type DashboardDataKey = (typeof DASHBOARD_DATA_KEYS)[number];

export async function loadDashboardPageData(
  key: DashboardDataKey,
  { sb, tech, role = "owner" }: Ctx,
): Promise<unknown> {
  switch (key) {
    case "home": {
      const now = new Date();
      const nowIso = now.toISOString();
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      const todayKey = dateStrInTz(now);
      const todayStr = fmtDate(nowIso);
      const dayStart = `${todayKey}T00:00:00.000Z`;
      const dayEnd = `${todayKey}T23:59:59.999Z`;
      const insightFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const insightTo = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString();
      const [
        upcoming,
        services,
        monthIncome,
        outstanding,
        todayCount,
        upcomingCount,
        blacklisted,
        noShows,
        insightBookings,
        recentPayments,
        clients,
        todayBookings,
        settleUp,
      ] = await Promise.all([
        listUpcomingBookings(sb, tech.id, nowIso, 20),
        listServices(sb, tech.id),
        sumMonthIncome(sb, tech.id, monthStart.toISOString()),
        sumOutstandingBalances(sb, tech.id, nowIso),
        countTodayBookings(sb, tech.id, dayStart, dayEnd),
        countUpcomingBookings(sb, tech.id, nowIso),
        countBlacklistedClients(sb, tech.id),
        countNoShowBookings(sb, tech.id),
        listInsightBookings(sb, tech.id, insightFrom, insightTo),
        listRecentPayments(sb, tech.id, insightFrom),
        listClients(sb, tech.id),
        listBookingsInWindow(sb, tech.id, dayStart, dayEnd),
        listPastBookingsNeedingWrapUp(sb, tech.id, nowIso, 25),
      ]);
      const lateCascadeCount = filterLateCascadeBookings(
        todayBookings,
        todayKey,
        now.getTime(),
      ).length;
      const clientById = Object.fromEntries(clients.map((c) => [c.id, c]));
      const serviceById = Object.fromEntries(services.map((s) => [s.id, s]));
      const insights = buildBusinessInsights({
        bookings: insightBookings,
        clients,
        payments: recentPayments,
        services,
      });
      return {
        tech,
        upcoming,
        services,
        monthIncome,
        outstanding,
        todayCount,
        upcomingCount,
        blacklisted,
        noShows,
        insights,
        clientById,
        serviceById,
        lateCascadeCount,
        settleUp,
      };
    }
    case "bookings": {
      const now = Date.now();
      const windowStart = new Date(now - 90 * 24 * 60 * 60 * 1000).toISOString();
      const windowEnd = new Date(now + 365 * 24 * 60 * 60 * 1000).toISOString();
      const { listStaff } = await import("@/lib/db/queries");
      const [bookings, services, clients, waitlist, staff] = await Promise.all([
        listBookingsInWindow(sb, tech.id, windowStart, windowEnd),
        listServices(sb, tech.id),
        listClients(sb, tech.id),
        listWaitlist(sb, tech.id).catch(() => []),
        listStaff(supabaseService(), tech.id, { activeOnly: true }).catch(() => []),
      ]);
      return { bookings, services, clients, waitlist, staff, now };
    }
    case "services": {
      const [categories, services, addons, retests, clients, bookings, products, batchSummary] =
        await Promise.all([
        listCategories(sb, tech.id),
        listServices(sb, tech.id),
        listAddons(sb, tech.id),
        listProductChangeRetests(sb, tech.id),
        listClients(sb, tech.id),
        listBookings(sb, tech.id),
        listProducts(sb, tech.id),
        batchSummaries(sb, tech.id),
      ]);
      const signed = await signedPhotoUrls(
        services.filter((s) => s.photoPath).map((s) => s.photoPath!),
      );
      const photoByService: Record<string, string> = {};
      for (const s of services) {
        if (s.photoPath) {
          const url = signed.get(s.photoPath);
          if (url) photoByService[s.id] = url;
        }
      }
      return { categories, services, addons, photoByService, retests, clients, bookings, products, batchSummaries: batchSummary, tech };
    }
    case "clients": {
      const [clients, visitsEntries] = await Promise.all([
        listClients(sb, tech.id),
        completedVisitCounts(sb, tech.id),
      ]);
      return { clients, visitsByClient: Object.fromEntries(visitsEntries) };
    }
    case "availability": {
      // The "Opening hours" page edits the OWNER's diary; team members' hours
      // live on the Team page.
      const { getOrCreateOwnerStaff } = await import("@/lib/booking/staff");
      const owner = await getOrCreateOwnerStaff(supabaseService(), tech).catch(() => null);
      const [hours, offs] = await Promise.all([
        listWorkingHours(sb, tech.id, owner?.id),
        listTimeOff(sb, tech.id),
      ]);
      return {
        hours,
        offs,
        flexibleHoursEnabled: tech.flexibleHoursEnabled === true,
        flexibleStartMinutes: tech.flexibleStartMinutes ?? 9 * 60,
        flexibleEndMinutes: tech.flexibleEndMinutes ?? 20 * 60,
        flexibleLastStartMinutes: tech.flexibleLastStartMinutes ?? null,
        approvalMode: tech.approvalMode ?? "off",
      };
    }
    case "team": {
      if (role !== "owner") return { forbidden: true };
      try {
        const svc = supabaseService();
        const { getOrCreateOwnerStaff } = await import("@/lib/booking/staff");
        await getOrCreateOwnerStaff(svc, tech);
        const { listStaff, staffServiceMap } = await import("@/lib/db/queries");
        const [staff, services, allHours] = await Promise.all([
          listStaff(svc, tech.id),
          listServices(sb, tech.id, { activeOnly: true }),
          listWorkingHours(sb, tech.id),
        ]);
        const restrictions = await staffServiceMap(svc, staff.map((s) => s.id));
        const owner = staff.find((s) => s.role === "owner");
        const hoursByStaff: Record<string, typeof allHours> = {};
        for (const h of allHours) {
          const sid = h.staffId ?? owner?.id;
          if (!sid) continue;
          (hoursByStaff[sid] ??= []).push(h);
        }
        return {
          staff,
          services,
          restrictions,
          hoursByStaff,
          flexibleHoursEnabled: tech.flexibleHoursEnabled === true,
        };
      } catch {
        // staff_members migration not applied yet on this environment.
        return { unavailable: true };
      }
    }
    case "forms": {
      const questions = await listQuestions(sb, tech.id);
      return { questions };
    }
    case "reminders": {
      const [reminders, services, checkins, infillNudges, preCare] = await Promise.all([
        listReminders(sb, tech.id),
        listServices(sb, tech.id),
        listReactionCheckins(sb, tech.id).catch(() => []),
        listInfillDeadlineNudges(sb, tech.id).catch(() => []),
        listPreCareConfirmations(sb, tech.id).catch(() => []),
      ]);
      const bookingIds = [
        ...new Set([
          ...reminders.map((r) => r.bookingId).filter((id): id is string => id != null),
          ...infillNudges.map((n) => n.baseBookingId),
          ...preCare.map((p) => p.bookingId),
        ]),
      ];
      const bookings = await getBookingsByIds(sb, bookingIds);
      const clientIds = [
        ...new Set([
          ...bookings.map((b) => b.clientId),
          ...reminders.map((r) => r.clientId).filter((id): id is string => id != null),
          ...checkins.map((c) => c.clientId),
          ...infillNudges.map((n) => n.clientId),
          ...preCare.map((p) => p.clientId),
        ]),
      ];
      const clients = await getClientsByIds(sb, clientIds);
      return { reminders, services, bookings, clients, checkins, infillNudges, preCare, tech };
    }
    case "reviews": {
      const reviews = await listReviewsForTech(sb, tech.id);
      const clientById = Object.fromEntries(
        (await getClientNameMap(sb, reviews.map((r) => r.clientId))).entries(),
      );
      return { reviews, clientById };
    }
    case "reports": {
      return getReportSummary(sb, tech.id);
    }
    case "messages": {
      if (!isLive(tech)) return { live: false };
      const [clients, messages, services, addons] = await Promise.all([
        listClients(sb, tech.id),
        listMessagesForTech(sb, tech.id),
        listServices(sb, tech.id, { activeOnly: true }),
        listAddons(sb, tech.id, { activeOnly: true }),
      ]);
      return { clients, messages, services, addons, tech, live: true };
    }
    case "billing": {
      let referredCount = 0;
      if (serviceConfigured()) {
        const { count } = await supabaseService()
          .from("techs")
          .select("*", { count: "exact", head: true })
          .eq("referredBy", tech.handle);
        referredCount = count ?? 0;
      }
      // Stripe config must be checked HERE (server), not in the browser:
      // STRIPE_SECRET_KEY is a server-only secret, so a client-side check is
      // always false and would wrongly disable the subscribe buttons.
      const { stripeConfigured } = await import("@/lib/stripe");
      return { referredCount, stripeConfigured: stripeConfigured() };
    }
    case "import":
    case "feedback":
      return {};
    case "admin": {
      if (role !== "owner" || !isAdminTech(tech)) return { forbidden: true };
      const adminSb = supabaseService();
      const [{ data: techsData }, { data: closuresData }, traffic] = await Promise.all([
        adminSb.from("techs").select("*").order("createdAt", { ascending: false }),
        adminSb
          .from("account_closure_requests")
          .select("*")
          .eq("status", "requested")
          .order("requestedAt", { ascending: false }),
        getPlatformTraffic(),
      ]);
      return { techs: techsData ?? [], closures: closuresData ?? [], traffic };
    }
    case "admin-support-import": {
      if (!canAccessSupportImport(tech, role)) return { forbidden: true };
      const adminSb = supabaseService();
      const { data: techsData } = await adminSb
        .from("techs")
        .select("*")
        .order("createdAt", { ascending: false });
      return { techs: techsData ?? [] };
    }
    default:
      throw new Error(`Unknown dashboard page: ${key}`);
  }
}
