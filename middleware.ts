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

/** Production apex host (non-www). Null on localhost / Vercel previews. */
function apexHostname(): string | null {
  const raw = process.env.NEXT_PUBLIC_APP_URL ?? "https://glow-uk.com";
  try {
    const host = new URL(raw).hostname.toLowerCase().replace(/^www\./, "");
    if (!host || host === "localhost" || host.endsWith(".vercel.app")) return null;
    if (host === "glow-uk.com" || host.endsWith(".glow-uk.com")) return "glow-uk.com";
    return host;
  } catch {
    return "glow-uk.com";
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
  const proto = (
    request.headers.get("x-forwarded-proto") ??
    request.nextUrl.protocol.replace(":", "")
  )
    .split(",")[0]
    ?.trim()
    .toLowerCase();

  // Collapse www → apex and http → https so Search Console sees one host.
  if (apex && host) {
    const isWww = host === `www.${apex}`;
    const isApex = host === apex;
    if (isWww || (isApex && proto === "http")) {
      const url = request.nextUrl.clone();
      url.hostname = apex;
      url.protocol = "https:";
      url.port = "";
      return NextResponse.redirect(url, 301);
    }
  }

  if (needsSessionRefresh(request.nextUrl.pathname)) {
    return updateSession(request);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Run on all app routes so www→apex / http→https works everywhere.
     * Skip Next internals and common static assets.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)",
  ],
};
