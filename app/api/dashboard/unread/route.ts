import { NextResponse } from "next/server";
import { getDashboardContext } from "@/lib/auth/session";
import { unreadCountForTech } from "@/lib/db/queries";
import { supabaseService } from "@/lib/supabase/service";

export async function GET() {
  const ctx = await getDashboardContext();
  if (!ctx) return NextResponse.json({ unread: 0 }, { status: 401 });
  const unread = await unreadCountForTech(supabaseService(), ctx.tech.id);
  return NextResponse.json(
    { unread },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
