// One-off seed for the demo studio. Run: node scripts/seed.mjs
// Reads SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from .env.local.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

function loadEnv() {
  const env = {};
  try {
    for (const line of readFileSync(".env.local", "utf8").split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m) env[m[1]] = m[2].trim();
    }
  } catch {}
  return env;
}

const env = loadEnv();
const url = env.SUPABASE_URL || process.env.SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const sb = createClient(url, key, { auth: { persistSession: false } });

const DAY = 86400000;
const HOUR = 3600000;
const iso = (offset) => new Date(Date.now() + offset).toISOString();
function dayAt(days, hour, minute = 0) {
  const d = new Date(Date.now() + days * DAY);
  d.setUTCHours(hour, minute, 0, 0);
  return d;
}

async function getOrCreateUser() {
  const email = "demo@glow.app";
  const password = "password123";
  const created = await sb.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.data?.user) return created.data.user.id;
  // Already exists: find it.
  let page = 1;
  while (page < 20) {
    const { data } = await sb.auth.admin.listUsers({ page, perPage: 200 });
    const found = data?.users?.find((u) => u.email === email);
    if (found) return found.id;
    if (!data || data.users.length < 200) break;
    page++;
  }
  throw new Error("Could not create or find demo user");
}

async function main() {
  const authUserId = await getOrCreateUser();
  console.log("demo auth user:", authUserId);

  // Reset demo tech (cascade removes children).
  await sb.from("techs").delete().eq("id", "tech_demo");

  await sb.from("techs").insert({
    id: "tech_demo",
    authUserId,
    email: "demo@glow.app",
    name: "Bella Rose",
    handle: "bellarose",
    businessName: "Bella Rose Beauty",
    bio: "Lash, brow & nail tech based in Manchester. Cosy home studio, free parking. Booking deposits secure your slot.",
    brandColor: "#db2777",
    instagram: "bellarosebeauty",
    tiktok: "bellarosebeauty",
    location: "Manchester, UK",
    defaultDepositPct: 30,
    cancellationWindowHours: 48,
    noShowFeePct: 100,
  });

  const T = "tech_demo";
  await sb.from("categories").insert([
    { id: "cat_lashes", techId: T, name: "Lashes", patchTestValidityDays: 180, patchTestMinLeadHours: 24 },
    { id: "cat_nails", techId: T, name: "Nails", patchTestValidityDays: 365, patchTestMinLeadHours: 0 },
    { id: "cat_brows", techId: T, name: "Brows", patchTestValidityDays: 180, patchTestMinLeadHours: 48 },
  ]);

  const svc = (id, categoryId, name, description, durationMin, price, depositValue, requiresPatchTest, isInfill, fullSetServiceId, infillMaxGapDays, sortOrder) => ({
    id, techId: T, categoryId, name, description, durationMin, pricePennies: price,
    depositType: "percent", depositValue, requiresPatchTest, isInfill,
    fullSetServiceId, infillMaxGapDays, active: true, sortOrder,
  });
  await sb.from("services").insert([
    svc("svc_lash_full", "cat_lashes", "Classic Full Set", "A full set of classic individual lashes for natural length and definition.", 120, 5500, 30, true, false, null, 21, 0),
    svc("svc_lash_infill", "cat_lashes", "Classic Infill (2-3 weeks)", "Top-up your existing classic set. Within 3 weeks of your last appointment.", 75, 3500, 30, true, true, "svc_lash_full", 21, 1),
    svc("svc_lash_hybrid", "cat_lashes", "Hybrid Full Set", "A mix of classic and volume lashes for added texture and fullness.", 135, 6500, 30, true, false, null, 21, 2),
    svc("svc_nail_full", "cat_nails", "Acrylic Full Set", "Full set of acrylic extensions, shaped and finished with colour of choice.", 90, 4000, 25, false, false, null, 21, 3),
    svc("svc_nail_infill", "cat_nails", "Acrylic Infill (2-3 weeks)", "Maintenance infill on your existing acrylic set.", 60, 2800, 25, false, true, "svc_nail_full", 21, 4),
    svc("svc_brow_lam", "cat_brows", "Brow Lamination", "Brow lamination with tint and shape for fuller, brushed-up brows.", 60, 4000, 30, true, false, null, 56, 5),
    svc("svc_brow_maint", "cat_brows", "Brow Lamination Maintenance", "Maintenance lamination for returning clients (within 8 weeks).", 50, 3500, 30, true, true, "svc_brow_lam", 56, 6),
  ]);

  await sb.from("working_hours").insert(
    [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
      id: `wh_${weekday}`, techId: T, weekday, startMinutes: 540, endMinutes: 1020, enabled: weekday >= 2 && weekday <= 6,
    })),
  );

  await sb.from("clients").insert([
    { id: "cli_sophie", techId: T, name: "Sophie Turner", email: "sophie@example.com", phone: "+447700900111", notes: "Prefers a natural look.", isBlacklisted: false, warningNote: "", noShowCount: 0 },
    { id: "cli_aisha", techId: T, name: "Aisha Khan", email: "aisha@example.com", phone: "+447700900222", notes: "", isBlacklisted: false, warningNote: "", noShowCount: 0 },
    { id: "cli_megan", techId: T, name: "Megan Lloyd", email: "megan@example.com", phone: "+447700900333", notes: "", isBlacklisted: true, warningNote: "Two no-shows in a row. Require full prepayment before booking.", noShowCount: 2 },
  ]);

  const pastStart = dayAt(-10, 10);
  const pastEnd = new Date(pastStart.getTime() + 120 * 60000);
  const nextStart = dayAt(3, 11);
  const nextEnd = new Date(nextStart.getTime() + 75 * 60000);

  await sb.from("bookings").insert([
    { id: "bk_sophie_past", techId: T, clientId: "cli_sophie", serviceId: "svc_lash_full", startIso: pastStart.toISOString(), endIso: pastEnd.toISOString(), status: "completed", pricePennies: 5500, depositPennies: 1650, depositStatus: "paid", balancePennies: 3850, balanceStatus: "paid", balanceToken: "seedtoken_past", isPatchTest: false, notes: "" },
    { id: "bk_sophie_next", techId: T, clientId: "cli_sophie", serviceId: "svc_lash_infill", startIso: nextStart.toISOString(), endIso: nextEnd.toISOString(), status: "confirmed", pricePennies: 3500, depositPennies: 1050, depositStatus: "paid", balancePennies: 2450, balanceStatus: "unpaid", balanceToken: "seedtoken_next", isPatchTest: false, notes: "" },
  ]);

  await sb.from("patch_tests").insert([
    { id: "pt_sophie_lash", techId: T, clientId: "cli_sophie", categoryId: "cat_lashes", performedAtIso: iso(-40 * DAY), expiresAtIso: iso(140 * DAY), result: "pass", bookingId: null, notes: "No reaction." },
  ]);

  await sb.from("payments").insert([
    { id: "pay_past_dep", techId: T, bookingId: "bk_sophie_past", kind: "deposit", amountPennies: 1650, status: "succeeded", provider: "stub", providerRef: "seed1" },
    { id: "pay_past_bal", techId: T, bookingId: "bk_sophie_past", kind: "balance", amountPennies: 3850, status: "succeeded", provider: "stub", providerRef: "seed2" },
    { id: "pay_next_dep", techId: T, bookingId: "bk_sophie_next", kind: "deposit", amountPennies: 1050, status: "succeeded", provider: "stub", providerRef: "seed3" },
  ]);

  await sb.from("reminders").insert([
    { id: "rem_next_24", techId: T, bookingId: "bk_sophie_next", channel: "sms", kind: "reminder_24h", sendAtIso: new Date(nextStart.getTime() - 24 * HOUR).toISOString(), status: "scheduled", preview: "", sentAtIso: null },
    { id: "rem_next_bal", techId: T, bookingId: "bk_sophie_next", channel: "email", kind: "balance_request", sendAtIso: new Date(nextStart.getTime() - 48 * HOUR).toISOString(), status: "scheduled", preview: "", sentAtIso: null },
  ]);

  console.log("Seed complete: /bellarose  (login demo@glow.app / password123)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
