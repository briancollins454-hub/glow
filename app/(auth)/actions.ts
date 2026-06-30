"use server";

import { redirect } from "next/navigation";
import {
  createTech,
  getTechByEmail,
  getTechByHandle,
  replaceWorkingHours,
} from "@/lib/db/repo";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { startSession, endSession } from "@/lib/auth/session";
import { hydrate, flush } from "@/lib/db/store";
import { slugify, randomId } from "@/lib/utils";

export async function loginAction(formData: FormData) {
  await hydrate();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const tech = getTechByEmail(email);
  if (!tech || !verifyPassword(password, tech.passwordHash)) {
    redirect("/login?error=invalid");
  }
  await startSession(tech.id);
  await flush();
  redirect("/dashboard");
}

export async function signupAction(formData: FormData) {
  await hydrate();
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const businessName = String(formData.get("businessName") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  let handle = slugify(String(formData.get("handle") ?? "") || businessName || name);

  if (!email || !password || !businessName) {
    redirect("/signup?error=missing");
  }
  if (getTechByEmail(email)) {
    redirect("/signup?error=email");
  }

  // Ensure unique handle
  if (!handle) handle = "studio";
  let candidate = handle;
  let n = 1;
  while (getTechByHandle(candidate)) {
    candidate = `${handle}${n++}`;
  }

  const tech = createTech({
    email,
    passwordHash: hashPassword(password),
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

  // Sensible default working hours: Tue-Sat 09:00-17:00
  replaceWorkingHours(
    tech.id,
    [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
      id: randomId("wh"),
      techId: tech.id,
      weekday,
      startMinutes: 9 * 60,
      endMinutes: 17 * 60,
      enabled: weekday >= 2 && weekday <= 6,
    })),
  );

  await startSession(tech.id);
  await flush();
  redirect("/dashboard");
}

export async function logoutAction() {
  await hydrate();
  await endSession();
  await flush();
  redirect("/");
}
