/**
 * Build a useful Error from a PostgREST / Postgres failure.
 * Empty provider messages become "(no message)" so Vercel logs are never blank.
 */
export function dbError(
  fn: string,
  error: { message?: string; code?: string; details?: string } | null | undefined,
): Error {
  const message = error?.message?.trim() ? error.message : "(no message)";
  const code = error?.code ? ` code=${error.code}` : "";
  const details = error?.details?.trim() ? ` details=${error.details}` : "";
  const err = new Error(`${fn}: ${message}${code}${details}`) as Error & { code?: string };
  if (error?.code) err.code = error.code;
  return err;
}

/** Postgres unique_violation — surfaced by PostgREST as code "23505". */
export function isUniqueViolation(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string; message?: string };
  if (e.code === "23505") return true;
  return typeof e.message === "string" && /duplicate key|unique constraint/i.test(e.message);
}

export function throwDbError(
  error: { message?: string; code?: string; details?: string },
  fn = "query",
): never {
  throw dbError(fn, error);
}
