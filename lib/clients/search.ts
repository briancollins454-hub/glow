/**
 * Shared client search used by the Clients page and the manual booking
 * client picker. Matches name, email or phone, case-insensitively; phone
 * queries also match ignoring spaces, dashes and a leading +44/0 difference.
 */

export type SearchableClient = {
  name: string;
  email: string;
  phone: string;
};

function digitsOf(value: string): string {
  return value.replace(/\D/g, "");
}

/** Normalise UK numbers so 07... and +447... match each other. */
function normalisePhoneDigits(digits: string): string {
  if (digits.startsWith("44")) return `0${digits.slice(2)}`;
  return digits;
}

export function clientMatchesQuery(client: SearchableClient, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const name = client.name?.toLowerCase() ?? "";
  const email = client.email?.toLowerCase() ?? "";
  const phone = client.phone?.toLowerCase() ?? "";
  if (name.includes(q) || email.includes(q) || phone.includes(q)) return true;

  // Digit-only comparison so "07725 409495" finds "'+447725409495" etc.
  const qDigits = digitsOf(q);
  if (qDigits.length >= 3) {
    const phoneDigits = normalisePhoneDigits(digitsOf(client.phone ?? ""));
    if (phoneDigits.includes(normalisePhoneDigits(qDigits))) return true;
  }
  return false;
}

export function filterClients<T extends SearchableClient>(clients: T[], query: string): T[] {
  const q = query.trim();
  if (!q) return clients;
  return clients.filter((c) => clientMatchesQuery(c, q));
}
