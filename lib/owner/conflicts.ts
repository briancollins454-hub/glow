import { ownerSb } from "@/lib/owner/require-owner";
import { filterOutInternal, shouldIncludeInternal } from "@/lib/owner/internal-accounts";
import type { Tech } from "@/lib/db/types";

export type ConflictRow = {
  rule: string;
  title: string;
  detail: string;
  hrefs: { label: string; href: string }[];
};

function normName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export async function detectConflicts(): Promise<ConflictRow[]> {
  const sb = ownerSb();
  const includeInternal = await shouldIncludeInternal(sb);
  const { data } = await sb
    .from("techs")
    .select("id, businessName, handle, email, name, isInternal")
    .order("createdAt", { ascending: false })
    .limit(2000);
  const techs = filterOutInternal((data ?? []) as Tech[], includeInternal);
  const rows: ConflictRow[] = [];

  // Shared emails
  const byEmail = new Map<string, Tech[]>();
  for (const t of techs) {
    const e = t.email.trim().toLowerCase();
    if (!e) continue;
    const list = byEmail.get(e) ?? [];
    list.push(t);
    byEmail.set(e, list);
  }
  for (const [email, list] of byEmail) {
    if (list.length < 2) continue;
    rows.push({
      rule: "shared_email",
      title: `Accounts sharing email ${email}`,
      detail: `${list.length} accounts`,
      hrefs: list.map((t) => ({
        label: t.businessName || t.handle,
        href: `/dashboard/admin/accounts/${t.id}`,
      })),
    });
  }

  // Near-identical business names
  const byName = new Map<string, Tech[]>();
  for (const t of techs) {
    const n = normName(t.businessName || "");
    if (n.length < 3) continue;
    const list = byName.get(n) ?? [];
    list.push(t);
    byName.set(n, list);
  }
  for (const [name, list] of byName) {
    if (list.length < 2) continue;
    rows.push({
      rule: "near_identical_name",
      title: `Near-identical business name “${name}”`,
      detail: `${list.length} accounts`,
      hrefs: list.map((t) => ({
        label: `/${t.handle}`,
        href: `/dashboard/admin/accounts/${t.id}`,
      })),
    });
  }

  // Duplicate clients within accounts (sample first 40 non-internal techs)
  for (const tech of techs.slice(0, 40)) {
    const { data: clients } = await sb
      .from("clients")
      .select("id, name, email, phone")
      .eq("techId", tech.id)
      .limit(2000);
    const byClientEmail = new Map<string, string[]>();
    const byPhone = new Map<string, string[]>();
    for (const c of clients ?? []) {
      if (c.email) {
        const k = String(c.email).toLowerCase();
        byClientEmail.set(k, [...(byClientEmail.get(k) ?? []), c.id]);
      }
      if (c.phone) {
        const k = String(c.phone).replace(/\D/g, "");
        if (k.length >= 8) byPhone.set(k, [...(byPhone.get(k) ?? []), c.id]);
      }
    }
    for (const [email, ids] of byClientEmail) {
      if (ids.length < 2) continue;
      rows.push({
        rule: "duplicate_client_email",
        title: `Duplicate client email in /${tech.handle}`,
        detail: `${email} × ${ids.length}`,
        hrefs: [{ label: tech.businessName || tech.handle, href: `/dashboard/admin/accounts/${tech.id}` }],
      });
    }
    for (const [phone, ids] of byPhone) {
      if (ids.length < 2) continue;
      rows.push({
        rule: "duplicate_client_phone",
        title: `Duplicate client phone in /${tech.handle}`,
        detail: `${phone} × ${ids.length}`,
        hrefs: [{ label: tech.businessName || tech.handle, href: `/dashboard/admin/accounts/${tech.id}` }],
      });
    }

    // Clients with no contact
    const noContact = (clients ?? []).filter((c) => !c.email && !c.phone);
    if (noContact.length) {
      rows.push({
        rule: "client_no_contact",
        title: `Clients with no contact in /${tech.handle}`,
        detail: `${noContact.length} clients`,
        hrefs: [{ label: tech.handle, href: `/dashboard/admin/accounts/${tech.id}` }],
      });
    }

    // Bookings with no client
    const { count: orphanBookings } = await sb
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("techId", tech.id)
      .is("clientId", null);
    if ((orphanBookings ?? 0) > 0) {
      rows.push({
        rule: "booking_no_client",
        title: `Bookings with no client in /${tech.handle}`,
        detail: `${orphanBookings} bookings`,
        hrefs: [{ label: tech.handle, href: `/dashboard/admin/accounts/${tech.id}` }],
      });
    }

    // Overlapping confirmed/active bookings for the same staff member
    const { data: activeBookings } = await sb
      .from("bookings")
      .select("id, staffId, startIso, endIso, status")
      .eq("techId", tech.id)
      .in("status", ["confirmed", "pending", "pending_approval"])
      .not("staffId", "is", null)
      .order("startIso", { ascending: true })
      .limit(500);
    const byStaff = new Map<string, { id: string; startIso: string; endIso: string }[]>();
    for (const b of activeBookings ?? []) {
      if (!b.staffId) continue;
      const list = byStaff.get(b.staffId) ?? [];
      list.push({ id: b.id, startIso: b.startIso, endIso: b.endIso });
      byStaff.set(b.staffId, list);
    }
    let overlapCount = 0;
    for (const [, list] of byStaff) {
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          const a = list[i]!;
          const b = list[j]!;
          if (a.endIso <= b.startIso) break;
          if (a.startIso < b.endIso && b.startIso < a.endIso) {
            overlapCount++;
          }
        }
      }
    }
    if (overlapCount > 0) {
      rows.push({
        rule: "overlapping_staff_bookings",
        title: `Overlapping staff bookings in /${tech.handle}`,
        detail: `${overlapCount} overlap pair(s)`,
        hrefs: [{ label: tech.handle, href: `/dashboard/admin/accounts/${tech.id}` }],
      });
    }
  }

  return rows;
}
