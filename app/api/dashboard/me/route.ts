import { NextResponse } from "next/server";
import { getDashboardContext } from "@/lib/auth/session";
import { isAdminTech } from "@/lib/admin";
import { signedPhotoUrls } from "@/lib/storage";

export async function GET() {
  const ctx = await getDashboardContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const paths = [ctx.tech.coverPhotoPath, ctx.tech.profilePhotoPath].filter(Boolean) as string[];
  const signed = paths.length ? await signedPhotoUrls(paths) : new Map<string, string>();
  return NextResponse.json({
    tech: ctx.tech,
    admin: ctx.role === "owner" && isAdminTech(ctx.tech),
    role: ctx.role,
    staff: ctx.staff,
    brandCoverUrl: ctx.tech.coverPhotoPath ? signed.get(ctx.tech.coverPhotoPath) ?? null : null,
    brandProfileUrl: ctx.tech.profilePhotoPath ? signed.get(ctx.tech.profilePhotoPath) ?? null : null,
  });
}
