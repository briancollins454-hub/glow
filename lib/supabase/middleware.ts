import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Refreshes the Supabase auth session cookie on auth/API requests.
// Dashboard routes are excluded — layout handles auth with a fast local session read.
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    return response;
  }

  const supabase = createServerClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Touch the session so cookies refresh. Dashboard auth is enforced in
  // app/dashboard/layout.tsx via useDashboardAuth (matcher excludes /dashboard).
  await supabase.auth.getUser();

  return response;
}
