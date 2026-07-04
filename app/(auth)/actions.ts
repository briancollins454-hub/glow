"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseService } from "@/lib/supabase/service";
import {
  createTech,
  getTechByHandle,
  replaceWorkingHours,
} from "@/lib/db/queries";
import { slugify, randomId } from "@/lib/utils";

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const sb = await createSupabaseServerClient();
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) {
    redirect("/login?error=invalid");
  }
  redirect("/dashboard");
}

export async function signupAction(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const businessName = String(formData.get("businessName") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  let handle = slugify(String(formData.get("handle") ?? "") || businessName || name);

  if (!email || !password || !businessName) {
    redirect("/signup?error=missing");
  }

  const admin = supabaseService();

  // Create the auth user (auto-confirmed so they can log in immediately).
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createErr || !created.user) {
    redirect("/signup?error=email");
  }
  const authUserId = created.user!.id;

  // Ensure a unique handle.
  if (!handle) handle = "studio";
  let candidate = handle;
  let n = 1;
  while (await getTechByHandle(admin, candidate)) candidate = `${handle}${n++}`;

  // Referral attribution: only record codes that match a real tech's handle.
  const refRaw = slugify(String(formData.get("ref") ?? ""));
  const referrer = refRaw && refRaw !== candidate ? await getTechByHandle(admin, refRaw) : null;

  const techId = randomId("tech");
  const tech = await createTech(admin, {
    id: techId,
    authUserId,
    email,
    name,
    handle: candidate,
    businessName,
    bio: "",
    brandColor: "#db2777",
    instagram: "",
    tiktok: "",
    location: "",
    defaultDepositPct: 30,
    cancellationWindowHours: 48,
    noShowFeePct: 100,
    referredBy: referrer?.handle ?? null,
  });

  await replaceWorkingHours(
    admin,
    techId,
    [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
      id: randomId("wh"),
      techId,
      weekday,
      startMinutes: 9 * 60,
      endMinutes: 17 * 60,
      lastStartMinutes: null,
      enabled: weekday >= 2 && weekday <= 6,
    })),
  );

  // Starter categories so adding a first service is a single step.
  const { createCategory } = await import("@/lib/db/queries");
  for (const catName of ["Lashes", "Brows", "Nails"]) {
    await createCategory(admin, {
      techId,
      name: catName,
      patchTestValidityDays: 180,
      patchTestMinLeadHours: 24,
    });
  }

  // Welcome email now + a setup nudge in 2 days (both best-effort).
  try {
    const { sendWelcomeEmail, scheduleOnboardingEmails } = await import("@/lib/onboarding");
    await sendWelcomeEmail(tech);
    await scheduleOnboardingEmails(admin, techId);
  } catch {
    // Never block signup on email problems.
  }

  // Sign them in (sets the session cookie).
  const sb = await createSupabaseServerClient();
  await sb.auth.signInWithPassword({ email, password });
  redirect("/dashboard");
}

export async function logoutAction() {
  const sb = await createSupabaseServerClient();
  await sb.auth.signOut();
  redirect("/");
}

export async function forgotPasswordAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  if (email) {
    const { requestPasswordReset } = await import("@/lib/password-reset");
    await requestPasswordReset(email);
  }
  // Always show the same confirmation so the form never reveals which
  // emails have accounts.
  redirect("/forgot?sent=1");
}
