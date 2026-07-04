import { NextResponse } from "next/server";

// Unlisted tester link: glow-uk.com/tester
// Sets the tester-offer cookie (first month £1) and continues to signup.
// Not linked from anywhere in the app; share it privately.
export async function GET(request: Request) {
  const res = NextResponse.redirect(new URL("/signup", request.url));
  res.cookies.set("glow_offer", "tester", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30, // 30 days to redeem
    path: "/",
  });
  return res;
}
