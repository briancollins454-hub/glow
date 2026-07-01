import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Service-role client (server-only). Bypasses RLS. Used for the public booking
// page (reads another tech's services/availability), public booking writes,
// the pay-balance flow, the reminder cron, and admin tasks like signup.
export function serviceConfigured(): boolean {
  return !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

let cached: SupabaseClient | null = null;

export function supabaseService(): SupabaseClient {
  if (!serviceConfigured()) {
    throw new Error("Supabase service role not configured");
  }
  if (!cached) {
    cached = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
  }
  return cached;
}
