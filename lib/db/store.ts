import fs from "node:fs";
import path from "node:path";
import type { DB } from "./types";
import { buildSeed } from "./seed";

// Local JSON-backed store. This is the swappable runtime backend for the MVP.
// In production (Phase D) the same repo.ts API is backed by Supabase instead.
//
// NOTE: serverless filesystems are ephemeral; this store is intended for local
// development and demos. Data persists to .data/db.json between restarts locally.

const DATA_DIR = path.join(process.cwd(), ".data");
const DATA_FILE = path.join(DATA_DIR, "db.json");

type Cache = { db: DB | null };
const g = globalThis as unknown as { __glowDb?: Cache };
if (!g.__glowDb) g.__glowDb = { db: null };
const cache = g.__glowDb;

function load(): DB {
  if (cache.db) return cache.db;
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, "utf8");
      cache.db = JSON.parse(raw) as DB;
      return cache.db;
    }
  } catch {
    // fall through to seed
  }
  cache.db = buildSeed();
  persist();
  return cache.db;
}

function persist(): void {
  if (!cache.db) return;
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(cache.db, null, 2), "utf8");
  } catch {
    // Read-only FS (e.g. serverless): keep in-memory only.
  }
}

/** Get the live DB object (mutate in place, then call save()). */
export function getDb(): DB {
  return load();
}

/** Persist current in-memory DB to disk. */
export function save(): void {
  persist();
}

/** Reset to a fresh seed (used by the demo "reset" action). */
export function resetDb(): DB {
  cache.db = buildSeed();
  persist();
  return cache.db;
}
