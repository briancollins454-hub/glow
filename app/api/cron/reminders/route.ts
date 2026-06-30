import { NextResponse } from "next/server";
import { processDueReminders } from "@/lib/scheduler";

// Triggered by Vercel Cron (see vercel.json). Vercel sends the CRON_SECRET as a
// bearer token; in local dev the check is skipped if no secret is configured.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const result = await processDueReminders();
  return NextResponse.json({ ok: true, ...result, at: new Date().toISOString() });
}
