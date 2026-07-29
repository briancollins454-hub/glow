import { NextResponse } from "next/server";
import { runOwnerDailyJob } from "@/lib/owner/daily-job";

export const maxDuration = 60;

/** Daily health scores, account snapshots, SMS usage rollup. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "cron not configured" }, { status: 500 });
  }
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await runOwnerDailyJob("cron");
  if (!result.ok) {
    return NextResponse.json(result, { status: 500 });
  }
  return NextResponse.json(result);
}
