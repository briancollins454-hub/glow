"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDashboardContext } from "@/lib/auth/session";
import { supabaseService } from "@/lib/supabase/service";
import {
  createStaff,
  getStaff,
  listStaff,
  replaceWorkingHours,
  setStaffServices,
  updateStaff,
} from "@/lib/db/queries";
import { randomId } from "@/lib/ids";
import type { WorkingHour } from "@/lib/db/types";

const TEAM = "/dashboard/team";

/** Team management is owner-only; staff logins never reach these actions. */
async function ownerCtx() {
  const c = await getDashboardContext();
  if (!c) redirect("/login");
  if (c!.role !== "owner") redirect("/dashboard");
  return c!;
}

function hhmmToMin(v: string): number {
  const [h = "0", m = "0"] = v.split(":");
  return Number(h) * 60 + Number(m);
}

function hoursFromForm(formData: FormData, techId: string, staffId: string): WorkingHour[] {
  const rows: WorkingHour[] = [];
  for (let weekday = 0; weekday <= 6; weekday++) {
    rows.push({
      id: randomId("wh"),
      techId,
      staffId,
      weekday,
      startMinutes: hhmmToMin(String(formData.get(`start_${weekday}`) ?? "09:00")),
      endMinutes: hhmmToMin(String(formData.get(`end_${weekday}`) ?? "17:00")),
      lastStartMinutes: null,
      enabled: formData.get(`enabled_${weekday}`) === "on",
    });
  }
  return rows;
}

function serviceIdsFromForm(formData: FormData): { all: boolean; ids: string[] } {
  const all = formData.get("allServices") === "on";
  const ids = [...formData.keys()]
    .filter((k) => k.startsWith("svc_"))
    .filter((k) => formData.get(k) === "on")
    .map((k) => k.slice(4));
  return { all, ids };
}

export async function createStaffAction(formData: FormData) {
  const { tech } = await ownerCtx();
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!name) redirect(`${TEAM}?err=missing`);
  if (email && password.length < 8) redirect(`${TEAM}?err=password`);

  const svc = supabaseService();

  // A login is optional: leave email/password empty for a diary-only person.
  let authUserId: string | null = null;
  if (email && password) {
    const { data: created, error } = await svc.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error || !created.user) redirect(`${TEAM}?err=email`);
    authUserId = created.user!.id;
  }

  const existing = await listStaff(svc, tech.id);
  const staff = await createStaff(svc, {
    techId: tech.id,
    authUserId,
    name,
    email,
    role: "staff",
    photoPath: null,
    bio: "",
    active: true,
    sortOrder: existing.length,
  });

  // Same starter hours as a fresh account: Tue-Sat, 9-5.
  await replaceWorkingHours(
    svc,
    tech.id,
    [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
      id: randomId("wh"),
      techId: tech.id,
      staffId: staff.id,
      weekday,
      startMinutes: 9 * 60,
      endMinutes: 17 * 60,
      lastStartMinutes: null,
      enabled: weekday >= 2 && weekday <= 6,
    })),
    staff.id,
  );

  const { all, ids } = serviceIdsFromForm(formData);
  if (!all && ids.length) await setStaffServices(svc, staff.id, ids);

  revalidatePath(TEAM);
  redirect(`${TEAM}?saved=1`);
}

export async function updateStaffDetailsAction(formData: FormData) {
  const { tech } = await ownerCtx();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const svc = supabaseService();
  const staff = await getStaff(svc, id);
  if (!staff || staff.techId !== tech.id) redirect(TEAM);
  if (name) await updateStaff(svc, id, { name });

  const { all, ids } = serviceIdsFromForm(formData);
  await setStaffServices(svc, id, all ? [] : ids);

  revalidatePath(TEAM);
  redirect(`${TEAM}?saved=1`);
}

export async function saveStaffHoursAction(formData: FormData) {
  const { tech } = await ownerCtx();
  const id = String(formData.get("id") ?? "");
  const svc = supabaseService();
  const staff = await getStaff(svc, id);
  if (!staff || staff.techId !== tech.id) redirect(TEAM);
  await replaceWorkingHours(svc, tech.id, hoursFromForm(formData, tech.id, id), id);
  revalidatePath(TEAM);
  redirect(`${TEAM}?saved=1`);
}

export async function setStaffActiveAction(formData: FormData) {
  const { tech } = await ownerCtx();
  const id = String(formData.get("id") ?? "");
  const active = formData.get("active") === "1";
  const svc = supabaseService();
  const staff = await getStaff(svc, id);
  if (!staff || staff.techId !== tech.id) redirect(TEAM);
  // The owner can never be deactivated (there must always be one diary).
  if (staff.role === "owner" && !active) redirect(`${TEAM}?err=owner`);
  await updateStaff(svc, id, { active });
  revalidatePath(TEAM);
  redirect(`${TEAM}?saved=1`);
}

export async function resetStaffPasswordAction(formData: FormData) {
  const { tech } = await ownerCtx();
  const id = String(formData.get("id") ?? "");
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) redirect(`${TEAM}?err=password`);
  const svc = supabaseService();
  const staff = await getStaff(svc, id);
  if (!staff || staff.techId !== tech.id || !staff.authUserId) redirect(TEAM);
  const { error } = await svc.auth.admin.updateUserById(staff.authUserId, { password });
  if (error) redirect(`${TEAM}?err=password`);
  revalidatePath(TEAM);
  redirect(`${TEAM}?saved=1`);
}
