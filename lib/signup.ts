import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createTech,
  getTechByAuthUserId,
  getTechByHandle,
  replaceWorkingHours,
} from "@/lib/db/queries";
import { randomId, randomToken } from "@/lib/ids";
import { isLive } from "@/lib/subscriptions";
import { slugify } from "@/lib/utils";
import type { Tech } from "@/lib/db/types";

/**
 * Create the Glow account row + starter setup for a brand-new Auth user.
 * Safe to call twice for the same auth user (double-submit / orphan recovery):
 * returns the existing tech if one is already linked.
 */
export async function provisionNewTechAccount(
  admin: SupabaseClient,
  opts: {
    authUserId: string;
    email: string;
    name: string;
    businessName: string;
    handleSeed: string;
    refRaw: string;
    isTester: boolean;
    signupUtmSource?: string | null;
    signupUtmMedium?: string | null;
    signupUtmCampaign?: string | null;
    signupHeardAbout?: string | null;
    signupPartnerSlug?: string | null;
  },
): Promise<{ tech: Tech; created: boolean }> {
  const existing = await getTechByAuthUserId(admin, opts.authUserId);
  if (existing) return { tech: existing, created: false };

  const handle = slugify(opts.handleSeed || opts.businessName || opts.name) || "studio";
  let candidate = handle;
  let n = 1;
  while (await getTechByHandle(admin, candidate)) candidate = `${handle}${n++}`;

  const referrer =
    opts.refRaw && opts.refRaw !== candidate ? await getTechByHandle(admin, opts.refRaw) : null;

  const techId = randomId("tech");
  let tech: Tech;
  try {
    tech = await createTech(admin, {
      id: techId,
      authUserId: opts.authUserId,
      email: opts.email,
      name: opts.name,
      handle: candidate,
      businessName: opts.businessName,
      bio: "",
      tagline: "",
      coverPhotoPath: null,
      profilePhotoPath: null,
      brandColor: "#db2777",
      instagram: "",
      tiktok: "",
      location: "",
      defaultDepositPct: 30,
      defaultDepositType: "percent",
      defaultDepositValue: 30,
      cancellationWindowHours: 48,
      noShowFeePct: 100,
      noShowFeeType: "percent",
      noShowFeeValue: 100,
      referredBy: referrer?.handle ?? null,
      calendarToken: randomToken(),
      signupOffer: opts.isTester ? "tester" : "",
      signupUtmSource: opts.signupUtmSource ?? null,
      signupUtmMedium: opts.signupUtmMedium ?? null,
      signupUtmCampaign: opts.signupUtmCampaign ?? null,
      signupHeardAbout: opts.signupHeardAbout ?? null,
      signupPartnerSlug: opts.signupPartnerSlug ?? null,
    });
  } catch (err) {
    // Race: another request provisioned the same auth user first.
    const raced = await getTechByAuthUserId(admin, opts.authUserId);
    if (raced) return { tech: raced, created: false };
    throw err;
  }

  let ownerStaffId: string | null = null;
  try {
    const { getOrCreateOwnerStaff } = await import("@/lib/booking/staff");
    ownerStaffId = (await getOrCreateOwnerStaff(admin, tech)).id;
  } catch {
    // staff_members table not deployed yet — hours stay unscoped.
  }

  await replaceWorkingHours(
    admin,
    tech.id,
    [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
      id: randomId("wh"),
      techId: tech.id,
      staffId: ownerStaffId,
      weekday,
      startMinutes: 9 * 60,
      endMinutes: 17 * 60,
      lastStartMinutes: null,
      enabled: weekday >= 2 && weekday <= 6,
    })),
    ownerStaffId ?? undefined,
  );

  const { createCategory } = await import("@/lib/db/queries");
  for (const catName of ["Lashes", "Brows", "Nails"]) {
    await createCategory(admin, {
      techId: tech.id,
      name: catName,
      patchTestValidityDays: 180,
      patchTestMinLeadHours: 24,
    });
  }

  try {
    const { sendWelcomeEmail, scheduleOnboardingEmails, notifyOwnerOfSignup } =
      await import("@/lib/onboarding");
    await sendWelcomeEmail(tech);
    await scheduleOnboardingEmails(admin, tech.id);
    await notifyOwnerOfSignup(tech);
  } catch {
    // Never block signup on email problems.
  }

  return { tech, created: true };
}

/** Where a newly signed-up (or recovered) account should land. */
export function postSignupPath(tech: Pick<Tech, "subscriptionStatus">): string {
  return isLive(tech) ? "/dashboard" : "/dashboard/billing?welcome=1";
}
