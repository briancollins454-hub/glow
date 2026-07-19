/** Build a Move to Glow / Support import redirect, preserving existing query (e.g. tech=). */
export function importResultUrl(
  returnTo: string,
  params: Record<string, string | number | undefined | null>,
): string {
  const url = new URL(returnTo, "http://glow.local");
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") url.searchParams.delete(key);
    else url.searchParams.set(key, String(value));
  }
  const q = url.searchParams.toString();
  return q ? `${url.pathname}?${q}` : url.pathname;
}
