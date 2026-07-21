import { supabaseService } from "@/lib/supabase/service";
import { planMrrPennies } from "@/lib/owner/mrr";
import type { Tech } from "@/lib/db/types";

export type AccountListRow = {
  tech: Tech;
  staffCount: number;
  clientCount: number;
  bookingCount: number;
  mrrPennies: number;
  flags: string[];
};

export type AccountListResult = {
  rows: AccountListRow[];
  total: number;
  page: number;
  pageSize: number;
};

function flagsFor(tech: Tech, bookingCount: number, serviceCount: number): string[] {
  const flags: string[] = [];
  if (!tech.connectChargesEnabled) flags.push("connect_pending");
  if (serviceCount === 0) flags.push("no_services");
  if (bookingCount === 0) flags.push("no_bookings");
  if (tech.subscriptionStatus === "past_due") flags.push("past_due");
  if (tech.closureRequestedAt) flags.push("closure_requested");
  return flags;
}

/**
 * Paginated account directory. Counts come from head queries per page of ids
 * (not loading all clients/bookings into memory).
 */
export async function listOwnerAccounts(opts: {
  q?: string;
  sort?: "createdAt" | "businessName" | "status";
  page?: number;
  pageSize?: number;
}): Promise<AccountListResult> {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(50, Math.max(10, opts.pageSize ?? 25));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const sb = supabaseService();

  let query = sb.from("techs").select("*", { count: "exact" });
  const q = opts.q?.trim();
  if (q) {
    // PostgREST or filter across common fields.
    query = query.or(
      `businessName.ilike.%${q}%,handle.ilike.%${q}%,email.ilike.%${q}%,name.ilike.%${q}%`,
    );
  }

  const sort = opts.sort ?? "createdAt";
  if (sort === "businessName") query = query.order("businessName", { ascending: true });
  else if (sort === "status") query = query.order("subscriptionStatus", { ascending: true });
  else query = query.order("createdAt", { ascending: false });

  const { data, error, count } = await query.range(from, to);
  if (error) throw new Error(error.message);
  const techs = (data ?? []) as Tech[];

  const rows: AccountListRow[] = [];
  for (const tech of techs) {
    const [staffRes, clientRes, bookingRes, serviceRes] = await Promise.all([
      sb.from("staff_members").select("id", { count: "exact", head: true }).eq("techId", tech.id),
      sb.from("clients").select("id", { count: "exact", head: true }).eq("techId", tech.id),
      sb.from("bookings").select("id", { count: "exact", head: true }).eq("techId", tech.id),
      sb.from("services").select("id", { count: "exact", head: true }).eq("techId", tech.id),
    ]);
    const staffCount = staffRes.count ?? 0;
    const clientCount = clientRes.count ?? 0;
    const bookingCount = bookingRes.count ?? 0;
    const serviceCount = serviceRes.count ?? 0;
    rows.push({
      tech,
      staffCount,
      clientCount,
      bookingCount,
      mrrPennies: tech.subscriptionStatus === "active" ? planMrrPennies(tech.plan) : 0,
      flags: flagsFor(tech, bookingCount, serviceCount),
    });
  }

  return { rows, total: count ?? rows.length, page, pageSize };
}

export async function getOwnerAccountDetail(techId: string) {
  const sb = supabaseService();
  const { data: tech, error } = await sb.from("techs").select("*").eq("id", techId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!tech) return null;

  const [
    staff,
    services,
    bookings,
    payments,
    audits,
    traffic,
    clientCount,
  ] = await Promise.all([
    sb.from("staff_members").select("*").eq("techId", techId).order("sortOrder", { ascending: true }),
    sb.from("services").select("id, name, active, pricePennies").eq("techId", techId).order("sortOrder", { ascending: true }).limit(100),
    sb
      .from("bookings")
      .select("id, startIso, status, serviceId, clientId, pricePennies")
      .eq("techId", techId)
      .order("startIso", { ascending: false })
      .limit(30),
    sb
      .from("payments")
      .select("*")
      .eq("techId", techId)
      .order("createdAt", { ascending: false })
      .limit(30),
    sb
      .from("audit_events")
      .select("*")
      .eq("techId", techId)
      .order("createdAt", { ascending: false })
      .limit(40),
    sb
      .from("page_views")
      .select("id", { count: "exact", head: true })
      .eq("techId", techId),
    sb.from("clients").select("id", { count: "exact", head: true }).eq("techId", techId),
  ]);

  return {
    tech: tech as Tech,
    staff: staff.data ?? [],
    services: services.data ?? [],
    bookings: bookings.data ?? [],
    payments: payments.data ?? [],
    audits: audits.data ?? [],
    pageViews: traffic.count ?? 0,
    clientCount: clientCount.count ?? 0,
  };
}
