"use server";

import { redirect } from "next/navigation";
import { getDashboardContext } from "@/lib/auth/session";
import { ensureConnectAccount, createOnboardingLink } from "@/lib/connect";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function connectStartAction() {
  const c = await getDashboardContext();
  if (!c) redirect("/login");
  const accountId = await ensureConnectAccount(c.sb, c.tech);
  const url = await createOnboardingLink(accountId, APP_URL);
  redirect(url);
}
