import { NextResponse } from "next/server";

// Private tester invite: glow-uk.com/tester
// Sets the tester-offer cookie (first month £1) and continues to signup.
// Not linked from the site or sitemap — share it privately only.
export async function GET(request: Request) {
  const res = NextResponse.redirect(new URL("/signup", request.url));
  // Keep crawlers from indexing this invite URL or following the redirect.
  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  res.cookies.set("glow_offer", "tester", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30, // 30 days to redeem
    path: "/",
  });
  return res;
}
