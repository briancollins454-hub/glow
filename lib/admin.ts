import type { Tech } from "@/lib/db/types";

// Owner/admin access. Comma-separated list so more owners can be added later
// via env without a deploy-time code change.
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "brian@thesupportsdesk.com")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export function isAdminTech(tech: Pick<Tech, "email">): boolean {
  return ADMIN_EMAILS.includes(tech.email.trim().toLowerCase());
}

/** Owner/admin notification recipients (e.g. for new-signup alerts). */
export function adminEmails(): string[] {
  return [...ADMIN_EMAILS];
}
