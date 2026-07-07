import type { Tech } from "@/lib/db/types";

// Owner page allowlist — hardcoded so a mis-set env var cannot grant access.
// Only these Glow account emails can see /dashboard/admin.
const OWNER_EMAILS = new Set([
  "brian@thesupportsdesk.com",
  "briancollins454@mail.com",
]);

export function isAdminTech(tech: Pick<Tech, "email">): boolean {
  return OWNER_EMAILS.has(tech.email.trim().toLowerCase());
}

/** For tests / ops checks — do not expose via API. */
export function ownerEmailCount(): number {
  return OWNER_EMAILS.size;
}
