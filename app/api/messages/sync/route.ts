import { NextResponse } from "next/server";
import { getClientByMessageToken, threadMessages } from "@/lib/db/queries";
import { rateLimit } from "@/lib/rate-limit";
import { supabaseService } from "@/lib/supabase/service";

/** Poll for new messages on a client thread (backup when realtime broadcast misses). */
export async function GET(req: Request) {
  const allowed = await rateLimit("message-sync", { limit: 60, windowMinutes: 10 });
  if (!allowed) return NextResponse.json({ error: "rate limited" }, { status: 429 });

  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token")?.trim();
  const after = searchParams.get("after")?.trim();
  if (!token) return NextResponse.json({ error: "missing token" }, { status: 400 });

  const sb = supabaseService();
  const client = await getClientByMessageToken(sb, token);
  if (!client) return NextResponse.json({ error: "not found" }, { status: 404 });

  let messages = await threadMessages(sb, client.id);
  if (after) {
    const afterMs = new Date(after).getTime();
    if (!Number.isNaN(afterMs)) {
      messages = messages.filter((m) => new Date(m.createdAt).getTime() > afterMs);
    }
  }

  return NextResponse.json({ messages });
}
