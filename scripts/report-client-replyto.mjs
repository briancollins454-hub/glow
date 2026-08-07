// Backfill audit: how many client-facing emails went out WITHOUT a replyTo in
// the last 30 days? Run: node scripts/report-client-replyto.mjs
// Reads SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from .env.local or the env.
//
// Note: outbound_sends only records replyTo from migration 0067 onward, so
// every row sent before that migration counts as "no replyTo" — which is
// accurate: nothing set one before this change shipped.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

// Keep in sync with CLIENT_EMAIL_KINDS in lib/email.ts.
const CLIENT_EMAIL_KINDS = [
  "confirmation",
  "reminder_24h",
  "reminder_2h",
  "balance_request",
  "patch_test_retest",
  "patch_retest",
  "client_message",
  "aftercare",
  "review_request",
  "booking_approved",
  "booking_declined",
  "reaction_checkin",
  "infill_nudge",
  "late_cascade",
  "precare",
  "waitlist",
  "rebook_nudge",
];

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

const sinceIso = new Date(Date.now() - 30 * 86400000).toISOString();
const PAGE = 1000;

const perKind = new Map();
let total = 0;
let sentOk = 0;
let missingReplyTo = 0;

for (let fromRow = 0; ; fromRow += PAGE) {
  const { data, error } = await sb
    .from("outbound_sends")
    .select('id, kind, ok, "replyTo"')
    .eq("channel", "email")
    .in("kind", CLIENT_EMAIL_KINDS)
    .gte("createdAt", sinceIso)
    .order("createdAt", { ascending: true })
    .range(fromRow, fromRow + PAGE - 1);
  if (error) {
    // replyTo column missing = migration 0067 not applied: every send predates
    // replyTo support, so count them all as missing.
    if (/replyTo/.test(error.message)) {
      const { count, error: countErr } = await sb
        .from("outbound_sends")
        .select("id", { count: "exact", head: true })
        .eq("channel", "email")
        .in("kind", CLIENT_EMAIL_KINDS)
        .gte("createdAt", sinceIso);
      if (countErr) {
        console.error("Query failed:", countErr.message);
        process.exit(1);
      }
      console.log(`Migration 0067 not applied yet — replyTo was never recorded.`);
      console.log(
        `Client-facing emails sent in the last 30 days (all without replyTo): ${count ?? 0}`,
      );
      process.exit(0);
    }
    console.error("Query failed:", error.message);
    process.exit(1);
  }
  for (const row of data ?? []) {
    total++;
    if (row.ok) sentOk++;
    const noReply = !row.replyTo;
    if (noReply) missingReplyTo++;
    const k = perKind.get(row.kind) ?? { total: 0, missing: 0 };
    k.total++;
    if (noReply) k.missing++;
    perKind.set(row.kind, k);
  }
  if (!data || data.length < PAGE) break;
}

console.log(`Client-facing emails since ${sinceIso}`);
console.log(`  total logged: ${total} (${sentOk} accepted by Resend)`);
console.log(`  without replyTo: ${missingReplyTo}`);
console.log("");
console.log("By kind (total / without replyTo):");
for (const [kind, k] of [...perKind.entries()].sort((a, b) => b[1].total - a[1].total)) {
  console.log(`  ${kind.padEnd(20)} ${String(k.total).padStart(6)} / ${k.missing}`);
}
