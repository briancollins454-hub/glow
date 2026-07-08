import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { isProbePath } from "@/lib/probe-paths";

export async function middleware(request: NextRequest) {
  if (isProbePath(request.nextUrl.pathname)) {
    return new NextResponse(null, { status: 404 });
  }
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
    "/login",
    "/signup",
    "/forgot",
    "/reset/:path*",
    "/api/account/:path*",
    "/api/reports/:path*",
    "/api/google/:path*",
  ],
};
