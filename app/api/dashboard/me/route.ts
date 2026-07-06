import { NextResponse } from "next/server";
import { getDashboardContext } from "@/lib/auth/session";
import { isAdminTech } from "@/lib/admin";

export async function GET() {
  const ctx = await getDashboardContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({
    tech: ctx.tech,
    admin: isAdminTech(ctx.tech),
  });
}
