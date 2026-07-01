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

  const techId = randomId("tech");
  await createTech(admin, {
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
      enabled: weekday >= 2 && weekday <= 6,
    })),
  );

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
