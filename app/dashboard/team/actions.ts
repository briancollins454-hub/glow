"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDashboardContext } from "@/lib/auth/session";
import { supabaseService } from "@/lib/supabase/service";
import {
  clearRotaWeek,
  createStaff,
  getStaff,
  listRotaHours,
  listStaff,
  replaceRotaWeek,
  replaceWorkingHours,
  setStaffServices,
  updateStaff,
} from "@/lib/db/queries";
import { randomId } from "@/lib/ids";
import { addDaysToDateStr, mondayOfWeekContaining } from "@/lib/rota";
import type { RotaHour, WorkingHour } from "@/lib/db/types";

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

/** Give a diary-only (imported) staff member a login email + password. */
export async function setStaffLoginAction(formData: FormData) {
  const { tech } = await ownerCtx();
  const id = String(formData.get("id") ?? "");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email) redirect(`${TEAM}?err=missing`);
  if (password.length < 8) redirect(`${TEAM}?err=password`);

  const svc = supabaseService();
  const staff = await getStaff(svc, id);
  if (!staff || staff.techId !== tech.id) redirect(TEAM);
  if (staff.authUserId) redirect(`${TEAM}?err=haslogin`);

  const { data: created, error } = await svc.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !created.user) redirect(`${TEAM}?err=email`);

  try {
    await updateStaff(svc, id, { email, authUserId: created.user.id });
  } catch {
    // Roll back the auth user if linking fails (e.g. email already on another staff row).
    await svc.auth.admin.deleteUser(created.user.id).catch(() => undefined);
    redirect(`${TEAM}?err=email`);
  }

  revalidatePath(TEAM);
  redirect(`${TEAM}?saved=1`);
}

function rotaRowsFromForm(
  formData: FormData,
  techId: string,
  staffId: string,
  weekStart: string,
): RotaHour[] {
  const rows: RotaHour[] = [];
  for (let weekday = 0; weekday <= 6; weekday++) {
    rows.push({
      id: randomId("rota"),
      techId,
      staffId,
      weekStart,
      weekday,
      startMinutes: hhmmToMin(String(formData.get(`start_${weekday}`) ?? "09:00")),
      endMinutes: hhmmToMin(String(formData.get(`end_${weekday}`) ?? "17:00")),
      lastStartMinutes: null,
      enabled: formData.get(`enabled_${weekday}`) === "on",
    });
  }
  return rows;
}

async function assertOwnedStaff(staffId: string) {
  const { tech } = await ownerCtx();
  const svc = supabaseService();
  const staff = await getStaff(svc, staffId);
  if (!staff || staff.techId !== tech.id) return null;
  return { tech, svc, staff };
}

export async function loadStaffRotaWeekAction(
  staffId: string,
  weekStart: string,
): Promise<RotaHour[]> {
  const owned = await assertOwnedStaff(staffId);
  if (!owned) return [];
  const week = mondayOfWeekContaining(weekStart);
  return listRotaHours(owned.svc, owned.tech.id, {
    staffId,
    fromWeek: week,
    toWeek: week,
  });
}

export async function saveStaffRotaWeekAction(
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const staffId = String(formData.get("id") ?? "");
  const weekStart = mondayOfWeekContaining(String(formData.get("weekStart") ?? ""));
  const owned = await assertOwnedStaff(staffId);
  if (!owned) return { ok: false, error: "Staff member not found." };
  try {
    await replaceRotaWeek(
      owned.svc,
      owned.tech.id,
      staffId,
      weekStart,
      rotaRowsFromForm(formData, owned.tech.id, staffId, weekStart),
    );
    revalidatePath(TEAM);
    revalidatePath(`/${owned.tech.handle}`);
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not save rota.";
    if (/rota_hours|schema cache/i.test(msg)) {
      return {
        ok: false,
        error: "Rota needs a database update first. Ask Glow support to run migration 0033.",
      };
    }
    return { ok: false, error: msg };
  }
}

export async function clearStaffRotaWeekAction(
  staffId: string,
  weekStart: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const owned = await assertOwnedStaff(staffId);
  if (!owned) return { ok: false, error: "Staff member not found." };
  const week = mondayOfWeekContaining(weekStart);
  try {
    await clearRotaWeek(owned.svc, owned.tech.id, staffId, week);
    revalidatePath(TEAM);
    revalidatePath(`/${owned.tech.handle}`);
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not clear rota.";
    return { ok: false, error: msg };
  }
}

/** Copy the previous week's rota into this week (saved immediately). */
export async function copyStaffRotaFromPreviousAction(
  staffId: string,
  weekStart: string,
): Promise<{ ok: true; rows: RotaHour[] } | { ok: false; error: string }> {
  const owned = await assertOwnedStaff(staffId);
  if (!owned) return { ok: false, error: "Staff member not found." };
  const week = mondayOfWeekContaining(weekStart);
  const prev = addDaysToDateStr(week, -7);
  try {
    const prevRows = await listRotaHours(owned.svc, owned.tech.id, {
      staffId,
      fromWeek: prev,
      toWeek: prev,
    });
    if (!prevRows.length) return { ok: true, rows: [] };
    const rows: RotaHour[] = prevRows.map((r) => ({
      ...r,
      id: randomId("rota"),
      weekStart: week,
    }));
    await replaceRotaWeek(owned.svc, owned.tech.id, staffId, week, rows);
    revalidatePath(TEAM);
    revalidatePath(`/${owned.tech.handle}`);
    return { ok: true, rows };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not copy rota.";
    return { ok: false, error: msg };
  }
}
