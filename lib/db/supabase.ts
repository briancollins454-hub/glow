import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { DB } from "./types";

// Server-only Supabase access using the service role key. The whole application
// state is stored as a single JSON snapshot row in `glow_app_state`. This keeps
// the synchronous in-memory repository (lib/db/repo.ts) intact while giving the
// deployed app durable persistence on Vercel's ephemeral filesystem.

const ROW_ID = "singleton";

let client: SupabaseClient | null = null;

export function supabaseConfigured(): boolean {
  return !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function getClient(): SupabaseClient | null {
  if (!supabaseConfigured()) return null;
  if (!client) {
    client = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
  }
  return client;
}

export async function pullState(): Promise<DB | null> {
  const sb = getClient();
  if (!sb) return null;
  const { data, error } = await sb
    .from("glow_app_state")
    .select("data")
    .eq("id", ROW_ID)
    .maybeSingle();
  if (error) {
    console.error("[supabase] pullState failed:", error.message);
    return null;
  }
  return (data?.data as DB) ?? null;
}

export async function pushState(db: DB): Promise<void> {
  const sb = getClient();
  if (!sb) return;
  const { error } = await sb
    .from("glow_app_state")
    .upsert({ id: ROW_ID, data: db, updated_at: new Date().toISOString() });
  if (error) {
    console.error("[supabase] pushState failed:", error.message);
  }
}
