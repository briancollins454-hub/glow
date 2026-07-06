import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Auth pages + protected APIs only. Dashboard nav skips middleware entirely.
    "/login",
    "/signup",
    "/forgot",
    "/reset/:path*",
    "/api/account/:path*",
    "/api/reports/:path*",
    "/api/google/:path*",
    "/api/dashboard/:path*",
  ],
};
