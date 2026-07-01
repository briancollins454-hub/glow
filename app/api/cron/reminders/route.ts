import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabase/service";
import { processDueReminders } from "@/lib/scheduler";

// Triggered by Vercel Cron (see vercel.json). Uses the service-role client so it
// can process reminders across all techs.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const sb = supabaseService();
  const result = await processDueReminders(sb);
  return NextResponse.json({ ok: true, ...result, at: new Date().toISOString() });
}
