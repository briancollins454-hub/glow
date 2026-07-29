/**
 * GDPR / SAR helpers (Phase 3.10).
 */

import { supabaseService } from "@/lib/supabase/service";
import type { Tech } from "@/lib/db/types";

export type ClientSearchHit = {
  clientId: string;
  name: string;
  email: string;
  phone: string;
  techId: string;
  techLabel: string;
};

/** Platform-wide client search for subject access requests. */
export async function searchClientsAcrossPlatform(q: string, limit = 40): Promise<ClientSearchHit[]> {
  const needle = q.trim();
  if (needle.length < 3) return [];
  const sb = supabaseService();
  const digits = needle.replace(/\D/g, "");
  let filter = `name.ilike.%${needle}%,email.ilike.%${needle}%,id.eq.${needle}`;
  if (digits.length >= 6) filter += `,phone.ilike.%${digits}%`;
  const { data, error } = await sb.from("clients").select("id, name, email, phone, techId").or(filter).limit(limit);
  if (error) throw new Error(error.message);
  const hits: ClientSearchHit[] = [];
  for (const c of data ?? []) {
    const { data: tech } = await sb
      .from("techs")
      .select("id, businessName, handle")
      .eq("id", c.techId)
      .maybeSingle();
    hits.push({
      clientId: c.id,
      name: c.name,
      email: c.email || "",
      phone: c.phone || "",
      techId: c.techId,
      techLabel: tech ? `${tech.businessName || tech.handle} (/${tech.handle})` : c.techId,
    });
  }
  return hits;
}

/** Per-account GDPR export payload (JSON archive contents). */
export async function buildAccountGdprExport(techId: string): Promise<{
  exportedAt: string;
  tech: Tech | null;
  staff: unknown[];
  clients: unknown[];
  bookings: unknown[];
  payments: unknown[];
  consents: unknown[];
  messages: unknown[];
}> {
  const sb = supabaseService();
  const { data: tech } = await sb.from("techs").select("*").eq("id", techId).maybeSingle();
  const [staff, clients, bookings, payments, consents, messages] = await Promise.all([
    sb.from("staff_members").select("*").eq("techId", techId).limit(500),
    sb.from("clients").select("*").eq("techId", techId).limit(5000),
    sb.from("bookings").select("*").eq("techId", techId).limit(5000),
    sb.from("payments").select("*").eq("techId", techId).limit(5000),
    sb.from("consent_records").select("*").eq("techId", techId).limit(5000),
    sb.from("messages").select("*").eq("techId", techId).limit(5000),
  ]);
  return {
    exportedAt: new Date().toISOString(),
    tech: (tech as Tech) ?? null,
    staff: staff.data ?? [],
    clients: clients.data ?? [],
    bookings: bookings.data ?? [],
    payments: payments.data ?? [],
    consents: consents.data ?? [],
    messages: messages.data ?? [],
  };
}
