import { NextResponse } from "next/server";
import { runRemindersJobNow } from "@/lib/owner/ops";

// Triggered by Vercel Cron (see vercel.json). Uses the service-role client so it
// can process reminders across all techs.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "cron not configured" }, { status: 500 });
  }
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await runRemindersJobNow("cron");
  if (!result.ok) {
    return NextResponse.json(result, { status: 500 });
  }
  return NextResponse.json(result);
}
