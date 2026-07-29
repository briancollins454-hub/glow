/**
 * Owner omni-search: resolve Stripe/Glow IDs and fuzzy entity lookup.
 * Every result includes the owning account.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type OmniEntityType =
  | "tech"
  | "staff"
  | "client"
  | "booking"
  | "payment"
  | "stripe";

export type OmniResult = {
  type: OmniEntityType;
  id: string;
  label: string;
  detail: string;
  /** Owning salon account */
  techId: string;
  techLabel: string;
  href: string;
};

function digitsOnly(s: string): string {
  return s.replace(/\D/g, "");
}

function detectPrefix(q: string): { kind: string; id: string } | null {
  const raw = q.trim();
  const lower = raw.toLowerCase();
  const patterns: [RegExp, string][] = [
    [/^bk_[a-z0-9]+$/i, "booking"],
    [/^cli_[a-z0-9]+$/i, "client"],
    [/^pay_[a-z0-9]+$/i, "payment"],
    [/^tech_[a-z0-9]+$/i, "tech"],
    [/^stf_[a-z0-9]+$/i, "staff"],
    [/^pi_[a-z0-9]+$/i, "stripe_pi"],
    [/^ch_[a-z0-9]+$/i, "stripe_ch"],
    [/^acct_[a-z0-9]+$/i, "stripe_acct"],
    [/^sub_[a-z0-9]+$/i, "stripe_sub"],
    [/^cus_[a-z0-9]+$/i, "stripe_cus"],
    [/^in_[a-z0-9]+$/i, "stripe_in"],
    [/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, "resend"],
  ];
  for (const [re, kind] of patterns) {
    if (re.test(lower) || re.test(raw)) return { kind, id: raw };
  }
  return null;
}

async function techLabel(sb: SupabaseClient, techId: string): Promise<{ label: string; href: string }> {
  const { data } = await sb
    .from("techs")
    .select("id, businessName, handle, email")
    .eq("id", techId)
    .maybeSingle();
  if (!data) return { label: techId, href: `/dashboard/admin/accounts/${techId}` };
  const label = `${data.businessName || data.handle} (/${data.handle})`;
  return { label, href: `/dashboard/admin/accounts/${data.id}` };
}

export async function omniSearch(
  sb: SupabaseClient,
  query: string,
  opts?: { includeInternal?: boolean; limit?: number },
): Promise<OmniResult[]> {
  const q = query.trim();
  if (!q || q.length < 2) return [];
  const limit = opts?.limit ?? 40;
  const includeInternal = !!opts?.includeInternal;
  const results: OmniResult[] = [];
  const detected = detectPrefix(q);

  if (detected) {
    const prefixed = await resolveByPrefix(sb, detected.kind, detected.id);
    results.push(...prefixed);
    if (results.length) return results.slice(0, limit);
  }

  // Techs
  let techQ = sb
    .from("techs")
    .select("id, businessName, handle, email, name, stripeCustomerId, stripeSubscriptionId, stripeConnectAccountId, isInternal")
    .or(
      `businessName.ilike.%${q}%,handle.ilike.%${q}%,email.ilike.%${q}%,name.ilike.%${q}%,id.eq.${q},stripeCustomerId.eq.${q},stripeSubscriptionId.eq.${q},stripeConnectAccountId.eq.${q}`,
    )
    .limit(15);
  if (!includeInternal) techQ = techQ.eq("isInternal", false);
  const { data: techs } = await techQ;
  for (const t of techs ?? []) {
    results.push({
      type: "tech",
      id: t.id,
      label: t.businessName || t.handle,
      detail: `${t.email} · /${t.handle}`,
      techId: t.id,
      techLabel: t.businessName || t.handle,
      href: `/dashboard/admin/accounts/${t.id}`,
    });
  }

  // Staff
  const { data: staff } = await sb
    .from("staff_members")
    .select("id, name, email, techId")
    .or(`name.ilike.%${q}%,email.ilike.%${q}%,id.eq.${q}`)
    .limit(15);
  for (const s of staff ?? []) {
    const owner = await techLabel(sb, s.techId);
    results.push({
      type: "staff",
      id: s.id,
      label: s.name || s.email,
      detail: s.email,
      techId: s.techId,
      techLabel: owner.label,
      href: owner.href,
    });
  }

  // Clients (name / email / phone)
  const phoneDigits = digitsOnly(q);
  let clientFilter = `name.ilike.%${q}%,email.ilike.%${q}%,id.eq.${q}`;
  if (phoneDigits.length >= 6) {
    clientFilter += `,phone.ilike.%${phoneDigits}%`;
  }
  const { data: clients } = await sb
    .from("clients")
    .select("id, name, email, phone, techId")
    .or(clientFilter)
    .limit(20);
  for (const c of clients ?? []) {
    const owner = await techLabel(sb, c.techId);
    results.push({
      type: "client",
      id: c.id,
      label: c.name || c.email || c.phone || c.id,
      detail: [c.email, c.phone].filter(Boolean).join(" · "),
      techId: c.techId,
      techLabel: owner.label,
      href: `${owner.href}`,
    });
  }

  // Bookings / payments by partial id
  if (q.length >= 6) {
    const { data: bookings } = await sb
      .from("bookings")
      .select("id, techId, clientId, startIso, status")
      .ilike("id", `%${q}%`)
      .limit(10);
    for (const b of bookings ?? []) {
      const owner = await techLabel(sb, b.techId);
      results.push({
        type: "booking",
        id: b.id,
        label: b.id,
        detail: `${b.status} · ${b.startIso}`,
        techId: b.techId,
        techLabel: owner.label,
        href: owner.href,
      });
    }
    const { data: payments } = await sb
      .from("payments")
      .select("id, techId, bookingId, amountPennies, status, providerRef, kind")
      .or(`id.ilike.%${q}%,providerRef.eq.${q}`)
      .limit(10);
    for (const p of payments ?? []) {
      const owner = await techLabel(sb, p.techId);
      results.push({
        type: "payment",
        id: p.id,
        label: p.id,
        detail: `${p.kind} · ${p.status} · £${((p.amountPennies ?? 0) / 100).toFixed(2)}`,
        techId: p.techId,
        techLabel: owner.label,
        href: owner.href,
      });
    }
  }

  // Resend outbound by email id
  if (/^[0-9a-f-]{36}$/i.test(q)) {
    const { data: sends } = await sb
      .from("outbound_sends")
      .select("id, techId, destination, kind, resendEmailId, ok")
      .or(`resendEmailId.eq.${q},id.eq.${q}`)
      .limit(5);
    for (const s of sends ?? []) {
      const owner = s.techId
        ? await techLabel(sb, s.techId)
        : { label: "(platform)", href: "/dashboard/admin/deliverability" };
      results.push({
        type: "stripe",
        id: s.id,
        label: `Outbound ${s.kind}`,
        detail: `${s.destination} · ${s.ok ? "ok" : "fail"} · ${s.resendEmailId ?? ""}`,
        techId: s.techId ?? "",
        techLabel: owner.label,
        href: owner.href,
      });
    }
  }

  return results.slice(0, limit);
}

async function resolveByPrefix(
  sb: SupabaseClient,
  kind: string,
  id: string,
): Promise<OmniResult[]> {
  const out: OmniResult[] = [];
  if (kind === "tech") {
    const { data } = await sb.from("techs").select("id, businessName, handle, email").eq("id", id).maybeSingle();
    if (data) {
      out.push({
        type: "tech",
        id: data.id,
        label: data.businessName || data.handle,
        detail: data.email,
        techId: data.id,
        techLabel: data.businessName || data.handle,
        href: `/dashboard/admin/accounts/${data.id}`,
      });
    }
    return out;
  }
  if (kind === "staff") {
    const { data } = await sb.from("staff_members").select("id, name, email, techId").eq("id", id).maybeSingle();
    if (data) {
      const owner = await techLabel(sb, data.techId);
      out.push({
        type: "staff",
        id: data.id,
        label: data.name,
        detail: data.email,
        techId: data.techId,
        techLabel: owner.label,
        href: owner.href,
      });
    }
    return out;
  }
  if (kind === "client") {
    const { data } = await sb.from("clients").select("id, name, email, phone, techId").eq("id", id).maybeSingle();
    if (data) {
      const owner = await techLabel(sb, data.techId);
      out.push({
        type: "client",
        id: data.id,
        label: data.name || data.email || data.id,
        detail: [data.email, data.phone].filter(Boolean).join(" · "),
        techId: data.techId,
        techLabel: owner.label,
        href: owner.href,
      });
    }
    return out;
  }
  if (kind === "booking") {
    const { data } = await sb
      .from("bookings")
      .select("id, techId, clientId, startIso, status, pricePennies")
      .eq("id", id)
      .maybeSingle();
    if (data) {
      const owner = await techLabel(sb, data.techId);
      out.push({
        type: "booking",
        id: data.id,
        label: data.id,
        detail: `${data.status} · client ${data.clientId} · ${data.startIso}`,
        techId: data.techId,
        techLabel: owner.label,
        href: owner.href,
      });
    }
    return out;
  }
  if (kind === "payment") {
    const { data } = await sb
      .from("payments")
      .select("id, techId, bookingId, amountPennies, status, providerRef, kind")
      .eq("id", id)
      .maybeSingle();
    if (data) {
      const owner = await techLabel(sb, data.techId);
      out.push({
        type: "payment",
        id: data.id,
        label: data.id,
        detail: `${data.kind} · ${data.status} · ref ${data.providerRef || "—"} · booking ${data.bookingId ?? "—"}`,
        techId: data.techId,
        techLabel: owner.label,
        href: owner.href,
      });
    }
    return out;
  }

  // Stripe IDs → payments / techs
  if (kind === "stripe_pi" || kind === "stripe_ch") {
    const { data } = await sb
      .from("payments")
      .select("id, techId, bookingId, amountPennies, status, kind, providerRef")
      .eq("providerRef", id)
      .maybeSingle();
    if (data) {
      const owner = await techLabel(sb, data.techId);
      out.push({
        type: "payment",
        id: data.id,
        label: `Stripe ${id}`,
        detail: `${data.kind} · booking ${data.bookingId ?? "—"} · £${((data.amountPennies ?? 0) / 100).toFixed(2)} · ${owner.label}`,
        techId: data.techId,
        techLabel: owner.label,
        href: owner.href,
      });
    }
    return out;
  }
  if (kind === "stripe_cus" || kind === "stripe_sub" || kind === "stripe_acct") {
    const col =
      kind === "stripe_cus"
        ? "stripeCustomerId"
        : kind === "stripe_sub"
          ? "stripeSubscriptionId"
          : "stripeConnectAccountId";
    const { data } = await sb.from("techs").select("id, businessName, handle, email").eq(col, id).maybeSingle();
    if (data) {
      out.push({
        type: "tech",
        id: data.id,
        label: data.businessName || data.handle,
        detail: `${col}=${id} · ${data.email}`,
        techId: data.id,
        techLabel: data.businessName || data.handle,
        href: `/dashboard/admin/accounts/${data.id}`,
      });
    }
    return out;
  }
  if (kind === "stripe_in") {
    // Invoice IDs are not stored locally — search metadata / note for owner.
    out.push({
      type: "stripe",
      id,
      label: `Stripe invoice ${id}`,
      detail: "Invoice IDs are not stored in Glow — open Stripe Dashboard or paste the related cus_/sub_ id.",
      techId: "",
      techLabel: "—",
      href: "/dashboard/admin/money",
    });
    return out;
  }
  if (kind === "resend") {
    const { data } = await sb
      .from("outbound_sends")
      .select("id, techId, destination, kind, resendEmailId, ok, createdAt")
      .eq("resendEmailId", id)
      .maybeSingle();
    if (data) {
      const owner = data.techId
        ? await techLabel(sb, data.techId)
        : { label: "(platform)", href: "/dashboard/admin/deliverability" };
      out.push({
        type: "stripe",
        id: data.id,
        label: `Resend ${id}`,
        detail: `${data.kind} → ${data.destination} · ${data.ok ? "ok" : "fail"}`,
        techId: data.techId ?? "",
        techLabel: owner.label,
        href: owner.href,
      });
    }
  }
  return out;
}

export function groupOmniResults(results: OmniResult[]): Record<OmniEntityType, OmniResult[]> {
  const groups: Record<OmniEntityType, OmniResult[]> = {
    tech: [],
    staff: [],
    client: [],
    booking: [],
    payment: [],
    stripe: [],
  };
  for (const r of results) groups[r.type].push(r);
  return groups;
}
