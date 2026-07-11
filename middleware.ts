import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const SESSION_PATHS = [
  "/login",
  "/signup",
  "/forgot",
  "/reset",
  "/api/account",
  "/api/reports",
  "/api/google",
];

function apexHostname(): string | null {
  const raw = process.env.NEXT_PUBLIC_APP_URL;
  if (!raw) return null;
  try {
    const host = new URL(raw).hostname.toLowerCase();
    // Never rewrite local/preview hosts.
    if (!host || host === "localhost" || host.endsWith(".vercel.app")) return null;
    return host.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function needsSessionRefresh(pathname: string): boolean {
  return SESSION_PATHS.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export async function middleware(request: NextRequest) {
  const apex = apexHostname();
  const host = request.headers.get("host")?.split(":")[0]?.toLowerCase();

  // Collapse www → apex so search engines see one canonical site.
  if (apex && host === `www.${apex}`) {
    const url = request.nextUrl.clone();
    url.hostname = apex;
    url.protocol = "https:";
    url.port = "";
    return NextResponse.redirect(url, 301);
  }

  if (needsSessionRefresh(request.nextUrl.pathname)) {
    return updateSession(request);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Run on all app routes so www→apex works everywhere.
     * Skip Next internals and common static assets.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)",
  ],
};
