/**
 * Maintenance helpers for malformed imported client names, e.g. a phone
 * number in the first-name field ("447368876064 Cook") or a fully blank
 * name. Pure functions so the admin action and tests share the logic.
 */

export type NameIssue = "digits" | "blank";

export type NameFixProposal = {
  issue: NameIssue;
  /** Cleaned name ("" when nothing sensible remains, or issue is blank). */
  name: string;
  /** Phone after the fix (digits moved in only when the phone was empty). */
  phone: string;
  /** True when a digit run was moved out of the name into the phone field. */
  movedDigitsToPhone: boolean;
};

const DIGIT_RUN = /\d{6,}/;

/** True when the whole value looks like a phone number, not a name. */
export function isPhoneLikeName(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  if (!/^[+()\d\s./-]+$/.test(v)) return false;
  return v.replace(/\D/g, "").length >= 7;
}

/** Detect the malformed-name cases this cleanup handles. */
export function nameIssueFor(client: { name: string }): NameIssue | null {
  const name = (client.name ?? "").trim();
  if (!name) return "blank";
  if (DIGIT_RUN.test(name)) return "digits";
  return null;
}

/**
 * Propose a fix without writing anything:
 * - digits case: strip 6+ digit runs from the name; move the first run into
 *   the phone field ONLY when the phone is currently empty.
 * - blank case: flag for manual naming (no invented name).
 */
export function proposeNameFix(client: {
  name: string;
  phone: string;
}): NameFixProposal | null {
  const issue = nameIssueFor(client);
  if (!issue) return null;

  if (issue === "blank") {
    return { issue, name: "", phone: (client.phone ?? "").trim(), movedDigitsToPhone: false };
  }

  const currentPhone = (client.phone ?? "").trim();
  const runs = (client.name.match(/\d{6,}/g) ?? []) as string[];
  const cleanedName = client.name
    .replace(/\d{6,}/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

  const shouldMove = currentPhone === "" && runs.length > 0;
  const phone = shouldMove ? runs[0]! : currentPhone;

  return {
    issue,
    name: cleanedName,
    phone,
    movedDigitsToPhone: shouldMove,
  };
}

export type MalformedClientRow<T> = {
  client: T;
  proposal: NameFixProposal;
};

/** All clients this cleanup would touch, with the proposed change for review. */
export function findMalformedClients<T extends { name: string; phone: string }>(
  clients: T[],
): MalformedClientRow<T>[] {
  const out: MalformedClientRow<T>[] = [];
  for (const client of clients) {
    const proposal = proposeNameFix(client);
    if (proposal) out.push({ client, proposal });
  }
  return out;
}
