/** Postgres unique_violation — surfaced by PostgREST as code "23505". */
export function isUniqueViolation(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string; message?: string };
  if (e.code === "23505") return true;
  return typeof e.message === "string" && /duplicate key|unique constraint/i.test(e.message);
}

export function throwDbError(error: { message: string; code?: string }): never {
  const err = new Error(error.message) as Error & { code?: string };
  if (error.code) err.code = error.code;
  throw err;
}
