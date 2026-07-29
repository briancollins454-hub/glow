import type { Tech } from "@/lib/db/types";

/** Hard-coded platform owner for destructive moderation (block / delete). */
export const PLATFORM_OWNER_EMAIL = "brian@thesupportsdesk.com";

// Owner/admin access. Comma-separated list so more owners can be added later
// via env without a deploy-time code change.
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? PLATFORM_OWNER_EMAIL)
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export function isAdminTech(tech: Pick<Tech, "email">): boolean {
  return ADMIN_EMAILS.includes(tech.email.trim().toLowerCase());
}

/** True only for brian@thesupportsdesk.com — block/delete accounts. */
export function isPlatformOwnerEmail(email: string): boolean {
  return email.trim().toLowerCase() === PLATFORM_OWNER_EMAIL;
}

export function isPlatformOwner(tech: Pick<Tech, "email">): boolean {
  return isPlatformOwnerEmail(tech.email);
}
