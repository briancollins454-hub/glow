import { NextResponse } from "next/server";
import { getDashboardContext } from "@/lib/auth/session";
import { unreadCountForTech } from "@/lib/db/queries";

export async function GET() {
  const ctx = await getDashboardContext();
  if (!ctx) return NextResponse.json({ unread: 0 }, { status: 401 });
  const unread = await unreadCountForTech(ctx.sb, ctx.tech.id);
  return NextResponse.json(
    { unread },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
