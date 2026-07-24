"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseService } from "@/lib/supabase/service";
import { getTechByAuthUserId } from "@/lib/db/queries";
import { postSignupPath, provisionNewTechAccount } from "@/lib/signup";
import { slugify } from "@/lib/utils";
import { rateLimit } from "@/lib/rate-limit";

export async function loginAction(formData: FormData) {
  // Brute-force protection: same "invalid" response so attackers learn nothing.
  if (!(await rateLimit("login", { limit: 10, windowMinutes: 5 })).ok) {
    redirect("/login?error=invalid");
  }
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const sb = await createSupabaseServerClient();
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) {
    redirect("/login?error=invalid");
  }
  redirect("/dashboard");
}

export async function signupAction(formData: FormData) {
  if (!(await rateLimit("signup", { limit: 5, windowMinutes: 15 })).ok) {
    redirect("/signup?error=missing");
  }
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const businessName = String(formData.get("businessName") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const handleSeed = String(formData.get("handle") ?? "") || businessName || name;
  const refRaw = slugify(String(formData.get("ref") ?? ""));
  const clip = (v: FormDataEntryValue | null) => String(v ?? "").trim().slice(0, 120) || null;
  const signupUtmSource = clip(formData.get("utmSource"));
  const signupUtmMedium = clip(formData.get("utmMedium"));
  const signupUtmCampaign = clip(formData.get("utmCampaign"));
  const signupHeardAbout = clip(formData.get("heardAbout"));
  const signupPartnerSlug = slugify(String(formData.get("partnerSlug") ?? "")) || null;

  if (!email || !password || !businessName) {
    redirect("/signup?error=missing");
  }
  if (password.length < 8) {
    redirect("/signup?error=password");
  }

  const admin = supabaseService();
  const sb = await createSupabaseServerClient();
  const isTester = (await cookies()).get("glow_offer")?.value === "tester";

  // 1) Create Auth user. On "already registered" (double-submit / orphan),
  //    sign in with the password they just typed and continue.
  const { data: created } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  let authUserId: string;
  if (created?.user) {
    authUserId = created.user.id;
  } else {
    const { data: signed, error: signErr } = await sb.auth.signInWithPassword({
      email,
      password,
    });
    if (signErr || !signed.user) {
      // Real duplicate with a different password, or Auth in a bad state.
      redirect("/signup?error=email");
    }
    authUserId = signed.user.id;

    const existing = await getTechByAuthUserId(admin, authUserId);
    if (existing) {
      // Double-submit after a successful signup — don't show an error.
      redirect(postSignupPath(existing));
    }
    // Auth user exists but Glow profile never finished — provision below.
  }

  const { tech } = await provisionNewTechAccount(admin, {
    authUserId,
    email,
    name,
    businessName,
    handleSeed,
    refRaw,
    isTester,
    signupUtmSource,
    signupUtmMedium,
    signupUtmCampaign,
    signupHeardAbout,
    signupPartnerSlug,
  });

  // Ensure a session cookie. Ignore "already signed in" from the recovery path.
  const { error: sessionErr } = await sb.auth.signInWithPassword({ email, password });
  if (sessionErr) {
    // Account is ready; don't strand them on a signup error.
    redirect("/login?signedup=1");
  }

  redirect(postSignupPath(tech));
}

export async function logoutAction() {
  const sb = await createSupabaseServerClient();
  await sb.auth.signOut();
  redirect("/");
}

export async function forgotPasswordAction(formData: FormData) {
  if (!(await rateLimit("forgot-password", { limit: 5, windowMinutes: 15 })).ok) {
    redirect("/forgot?sent=1");
  }
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (email) {
    const { requestPasswordReset } = await import("@/lib/password-reset");
    await requestPasswordReset(email);
  }
  // Always show the same confirmation so the form never reveals which
  // emails have accounts.
  redirect("/forgot?sent=1");
}
