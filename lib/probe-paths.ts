/** Bot/scanner paths that should 404 before hitting dynamic booking routes. */
export function isProbePath(pathname: string): boolean {
  const segment = pathname.split("/").filter(Boolean)[0];
  if (!segment) return false;
  // Real Glow handles are slugified — never contain dots or uppercase.
  if (segment.includes(".")) return true;
  if (/^wp-/i.test(segment)) return true;
  if (/^(xmlrpc|phpmyadmin|administrator)$/i.test(segment)) return true;
  return false;
}
