import fs from "node:fs";
import path from "node:path";
import type { DB } from "./types";
import { buildSeed } from "./seed";
import { pullState, pushState, supabaseConfigured } from "./supabase";

// Swappable runtime backend:
//  - When SUPABASE_* env vars are set, state is persisted as a single JSON
//    snapshot row in Supabase (durable on serverless). Call `hydrate()` before
//    reads and `flush()` after writes.
//  - Otherwise it falls back to a local JSON file (.data/db.json) for dev/demo.
//
// The repository (repo.ts) stays synchronous and operates on the in-memory cache.

const DATA_DIR = path.join(process.cwd(), ".data");
const DATA_FILE = path.join(DATA_DIR, "db.json");

type Cache = { db: DB | null; dirty: boolean };
const g = globalThis as unknown as { __glowDb?: Cache };
if (!g.__glowDb) g.__glowDb = { db: null, dirty: false };
const cache = g.__glowDb;

// ---------------- File backend (local dev) ----------------
function loadFromFile(): DB {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, "utf8")) as DB;
    }
  } catch {
    /* fall through to seed */
  }
  const seeded = buildSeed();
  persistToFile(seeded);
  return seeded;
}

function persistToFile(db: DB): void {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), "utf8");
  } catch {
    /* read-only FS: keep in-memory only */
  }
}

// ---------------- Public API ----------------

/**
 * Load the latest state into the in-memory cache. With Supabase this fetches the
 * snapshot (seeding it on first run); locally it reads the JSON file.
 * Call this at the start of every page / server action / route handler.
 */
export async function hydrate(): Promise<void> {
  if (supabaseConfigured()) {
    const remote = await pullState();
    if (remote) {
      cache.db = remote;
    } else {
      // First run: seed and persist the snapshot.
      cache.db = buildSeed();
      await pushState(cache.db);
    }
    cache.dirty = false;
    return;
  }
  if (!cache.db) cache.db = loadFromFile();
}

/** Get the live in-memory DB (mutate in place, then call save() + flush()). */
export function getDb(): DB {
  if (!cache.db) cache.db = loadFromFile();
  return cache.db;
}

/** Mark state changed. Locally this writes the file immediately. */
export function save(): void {
  cache.dirty = true;
  if (!supabaseConfigured() && cache.db) persistToFile(cache.db);
}

/** Persist pending changes to the durable backend. Call before responding. */
export async function flush(): Promise<void> {
  if (!cache.dirty || !cache.db) return;
  if (supabaseConfigured()) {
    await pushState(cache.db);
  } else {
    persistToFile(cache.db);
  }
  cache.dirty = false;
}

/** Reset to a fresh seed (demo reset). */
export async function resetDb(): Promise<DB> {
  cache.db = buildSeed();
  cache.dirty = true;
  await flush();
  return cache.db;
}
