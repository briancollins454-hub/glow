import { NextResponse } from "next/server";
import { getDashboardContext } from "@/lib/auth/session";
import {
  DASHBOARD_DATA_KEYS,
  loadDashboardPageData,
  type DashboardDataKey,
} from "@/lib/dashboard/page-loaders";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  const { key } = await params;
  if (!DASHBOARD_DATA_KEYS.includes(key as DashboardDataKey)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const ctx = await getDashboardContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const data = await loadDashboardPageData(key as DashboardDataKey, ctx);
  return NextResponse.json(data, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
