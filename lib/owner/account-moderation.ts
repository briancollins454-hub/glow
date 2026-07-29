import type { SupabaseClient } from "@supabase/supabase-js";
import type { Tech } from "@/lib/db/types";
import { isPlatformOwnerEmail } from "@/lib/admin";
import { updateTech, listStaff, deleteStaffMember } from "@/lib/db/queries";
import { invalidateDashboardTech } from "@/lib/auth/session";

/** True when the platform owner has blocked this account. */
export function isAccountBlocked(
  tech: Pick<Tech, "blockedAt"> | null | undefined,
): boolean {
  return !!tech?.blockedAt;
}

/**
 * Block an account: no public bookings, no dashboard (owner or staff).
 * Cannot block the platform owner account itself.
 */
export async function blockTechAccount(
  sb: SupabaseClient,
  opts: {
    target: Tech;
    reason: string;
    actorEmail: string;
  },
): Promise<Tech> {
  if (isPlatformOwnerEmail(opts.target.email)) {
    throw new Error("Cannot block the platform owner account");
  }
  const reason = opts.reason.trim().slice(0, 500);
  if (!reason) throw new Error("A reason is required");
  const blockedAt = new Date().toISOString();
  await updateTech(sb, opts.target.id, {
    blockedAt,
    blockedReason: reason,
    blockedByEmail: opts.actorEmail.trim().toLowerCase(),
    bookingPageLive: false,
  });
  invalidateDashboardTech(opts.target.authUserId);
  const staff = await listStaff(sb, opts.target.id).catch(() => []);
  for (const s of staff) {
    invalidateDashboardTech(s.authUserId);
  }
  return {
    ...opts.target,
    blockedAt,
    blockedReason: reason,
    blockedByEmail: opts.actorEmail.trim().toLowerCase(),
    bookingPageLive: false,
  };
}

export async function unblockTechAccount(
  sb: SupabaseClient,
  opts: { target: Tech },
): Promise<void> {
  await updateTech(sb, opts.target.id, {
    blockedAt: null,
    blockedReason: "",
    blockedByEmail: null,
  });
  invalidateDashboardTech(opts.target.authUserId);
  const staff = await listStaff(sb, opts.target.id).catch(() => []);
  for (const s of staff) {
    invalidateDashboardTech(s.authUserId);
  }
}

/**
 * Best-effort cancel of Glow platform subscription (not Connect).
 */
export async function cancelGlowSubscription(tech: Tech): Promise<void> {
  if (!tech.stripeSubscriptionId && !tech.stripeCustomerId) return;
  try {
    const { stripe } = await import("@/lib/stripe");
    const s = stripe();
    if (tech.stripeSubscriptionId) {
      try {
        await s.subscriptions.cancel(tech.stripeSubscriptionId);
      } catch {
        await s.subscriptions
          .update(tech.stripeSubscriptionId, { cancel_at_period_end: true })
          .catch(() => undefined);
      }
    }
  } catch {
    // Stripe may be unset in some environments — deletion still proceeds.
  }
}

/**
 * Hard-delete a tech account and related rows. Irreversible.
 * Cancels Stripe billing, removes auth users, deletes salon data.
 */
export async function deleteTechAccount(
  sb: SupabaseClient,
  opts: { target: Tech; actorEmail: string },
): Promise<{ deletedAuthUsers: number; tables: string[] }> {
  if (isPlatformOwnerEmail(opts.target.email)) {
    throw new Error("Cannot delete the platform owner account");
  }

  await cancelGlowSubscription(opts.target);

  const staff = await listStaff(sb, opts.target.id).catch(() => []);
  for (const member of staff) {
    // Clear staffId on bookings so staff hard-delete can proceed.
    await sb.from("bookings").update({ staffId: null }).eq("staffId", member.id);
    await deleteStaffMember(sb, member).catch(() => undefined);
  }

  const techId = opts.target.id;
  const tables = [
    // Dependent / leaf tables first (ignore missing-table errors).
    "late_cascade_notifications",
    "late_cascade_events",
    "pre_care_confirmations",
    "infill_deadline_nudges",
    "reaction_checkins",
    "client_reactions",
    "product_usages",
    "product_batches",
    "products",
    "product_change_retests",
    "product_change_event_services",
    "product_change_event_categories",
    "product_change_events",
    // consent_records are NEVER bulk-deleted (Phase 3.10 / GDPR) — immutable + retained.
    "form_responses",
    "consultation_pack_targets",
    "consultation_packs",
    "consultation_questions",
    "client_photos",
    "reviews",
    "waitlist_entries",
    "dm_quote_links",
    "messages",
    "reminders",
    "payments",
    "bookings",
    "patch_tests",
    "clients",
    "service_addons",
    "services",
    "service_categories",
    "time_off",
    "rota_hours",
    "working_hours",
    "staff_service_days",
    "staff_services",
    "staff_members",
    "onboarding_emails",
    "account_closure_requests",
    "feedback_submissions",
    "page_views",
    "outbound_sends",
    "audit_events",
  ];

  const cleared: string[] = [];
  for (const table of tables) {
    const { error } = await sb.from(table).delete().eq("techId", techId);
    if (!error) cleared.push(table);
  }

  // Auth: salon owner last.
  let deletedAuthUsers = 0;
  if (opts.target.authUserId) {
    const { error } = await sb.auth.admin.deleteUser(opts.target.authUserId);
    if (!error) deletedAuthUsers++;
    invalidateDashboardTech(opts.target.authUserId);
  }

  const { error: techErr } = await sb.from("techs").delete().eq("id", techId);
  if (techErr) throw techErr;
  cleared.push("techs");

  return { deletedAuthUsers, tables: cleared };
}
