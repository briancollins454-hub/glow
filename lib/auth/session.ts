import { cookies } from "next/headers";
import { randomToken } from "@/lib/utils";
import {
  createSession,
  deleteSession,
  getSession,
  getTechById,
} from "@/lib/db/repo";
import type { Tech } from "@/lib/db/types";

const COOKIE = "glow_session";

export async function startSession(techId: string): Promise<void> {
  const token = randomToken();
  createSession(techId, token);
  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function endSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (token) deleteSession(token);
  store.delete(COOKIE);
}

export async function getCurrentTech(): Promise<Tech | null> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;
  const session = getSession(token);
  if (!session) return null;
  return getTechById(session.techId) ?? null;
}
