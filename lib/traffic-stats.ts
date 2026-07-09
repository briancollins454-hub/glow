import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { supabaseService } from "@/lib/supabase/service";

const TZ = "Europe/London";

export type TrafficPeriod = { views: number; visitors: number };
export type TrafficDaily = { day: string; views: number; visitors: number };
export type TrafficPath = { path: string; views: number; visitors: number };
export type TrafficTech = {
  techId: string;
  handle: string;
  businessName: string;
  views: number;
  visitors: number;
};

export type PlatformTraffic = {
  today: TrafficPeriod;
  last7Days: TrafficPeriod;
  last30Days: TrafficPeriod;
  allTime: TrafficPeriod;
  daily: TrafficDaily[];
  topPaths: TrafficPath[];
  topTechs: TrafficTech[];
};

function periodFromRow(row: { views: number | string; visitors: number | string } | null): TrafficPeriod {
  return {
    views: Number(row?.views ?? 0),
    visitors: Number(row?.visitors ?? 0),
  };
}

export async function getPlatformTraffic(): Promise<PlatformTraffic> {
  const empty: PlatformTraffic = {
    today: { views: 0, visitors: 0 },
    last7Days: { views: 0, visitors: 0 },
    last30Days: { views: 0, visitors: 0 },
    allTime: { views: 0, visitors: 0 },
    daily: [],
    topPaths: [],
    topTechs: [],
  };

  try {
    const sb = supabaseService();
    const now = new Date();
    const todayStart = formatInTimeZone(now, TZ, "yyyy-MM-dd");
    const since7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const since30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const todaySince = fromZonedTime(`${todayStart} 00:00:00`, TZ).toISOString();

    const [
      allTimeRes,
      todayRes,
      last7Res,
      last30Res,
      dailyRes,
      pathsRes,
      techsRes,
      techRowsRes,
    ] = await Promise.all([
      sb.rpc("traffic_period_stats"),
      sb.rpc("traffic_period_stats", { since: todaySince }),
      sb.rpc("traffic_period_stats", { since: since7 }),
      sb.rpc("traffic_period_stats", { since: since30 }),
      sb.rpc("traffic_daily", { days: 30 }),
      sb.rpc("traffic_top_paths", { limit_n: 12, since: since30 }),
      sb.rpc("traffic_top_techs", { limit_n: 12, since: since30 }),
      sb.from("techs").select("id, handle, businessName"),
    ]);

    const techById = Object.fromEntries(
      (techRowsRes.data ?? []).map((t: { id: string; handle: string; businessName: string }) => [
        t.id,
        t,
      ]),
    );

    const topTechs: TrafficTech[] = (techsRes.data ?? []).map(
      (row: { techId: string; views: number; visitors: number }) => {
        const tech = techById[row.techId];
        return {
          techId: row.techId,
          handle: tech?.handle ?? row.techId,
          businessName: tech?.businessName ?? "Unknown",
          views: Number(row.views),
          visitors: Number(row.visitors),
        };
      },
    );

    return {
      allTime: periodFromRow(allTimeRes.data?.[0] ?? null),
      today: periodFromRow(todayRes.data?.[0] ?? null),
      last7Days: periodFromRow(last7Res.data?.[0] ?? null),
      last30Days: periodFromRow(last30Res.data?.[0] ?? null),
      daily: (dailyRes.data ?? []).map((row: { day: string; views: number; visitors: number }) => ({
        day: row.day,
        views: Number(row.views),
        visitors: Number(row.visitors),
      })),
      topPaths: (pathsRes.data ?? []).map((row: { path: string; views: number; visitors: number }) => ({
        path: row.path,
        views: Number(row.views),
        visitors: Number(row.visitors),
      })),
      topTechs,
    };
  } catch {
    return empty;
  }
}
