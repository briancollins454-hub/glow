/** Cryptographically secure ids/tokens via Web Crypto (works in Node and the browser). */

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  const b64 =
    typeof btoa === "function"
      ? btoa(binary)
      : Buffer.from(bytes).toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function randomBytes(size: number): Uint8Array {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  return bytes;
}

/** Cryptographically secure URL-safe token (e.g. balance / approval / check-in links). */
export function randomToken(): string {
  return toBase64Url(randomBytes(32));
}

/** Cryptographically secure id with optional prefix (e.g. bk_, svc_). */
export function randomId(prefix = ""): string {
  const s = toBase64Url(randomBytes(9));
  return prefix ? `${prefix}_${s}` : s;
}
