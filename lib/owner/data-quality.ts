/**
 * Data quality dashboard (Phase 3.9).
 */

import { supabaseService } from "@/lib/supabase/service";
import { filterOutInternal, shouldIncludeInternal } from "@/lib/owner/internal-accounts";
import type { Tech } from "@/lib/db/types";

export type DataQualityIssue = {
  rule: string;
  title: string;
  count: number;
  href: string;
  sampleTechIds: string[];
};

/** Pure helpers for tests. */
export function isInvalidEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function isPastConfirmed(status: string, endIso: string, nowMs = Date.now()): boolean {
  return status === "confirmed" && new Date(endIso).getTime() < nowMs;
}

export async function runDataQualityChecks(): Promise<DataQualityIssue[]> {
  const sb = supabaseService();
  const includeInternal = await shouldIncludeInternal(sb);
  const { data } = await sb.from("techs").select("id, handle, businessName, bookingPageLive, isInternal").limit(500);
  const techs = filterOutInternal((data ?? []) as Tech[], includeInternal);
  const issues: DataQualityIssue[] = [];
  const now = new Date().toISOString();

  // Sample first 40 accounts for heavy checks
  let invalidEmails = 0;
  let noContact = 0;
  let noServiceBooking = 0;
  let pastConfirmed = 0;
  let noPrice = 0;
  let liveNoHours = 0;
  const sample: string[] = [];

  for (const tech of techs.slice(0, 40)) {
    const [{ data: clients }, { data: bookings }, { data: services }, { count: hours }] = await Promise.all([
      sb.from("clients").select("id, email, phone").eq("techId", tech.id).limit(500),
      sb
        .from("bookings")
        .select("id, status, endIso, serviceId")
        .eq("techId", tech.id)
        .order("startIso", { ascending: false })
        .limit(300),
      sb.from("services").select("id, pricePennies, active").eq("techId", tech.id).limit(200),
      sb
        .from("working_hours")
        .select("id", { count: "exact", head: true })
        .eq("techId", tech.id)
        .eq("enabled", true),
    ]);

    for (const c of clients ?? []) {
      if (isInvalidEmail(c.email)) {
        invalidEmails++;
        sample.push(tech.id);
      }
      if (!c.email && !c.phone) {
        noContact++;
        sample.push(tech.id);
      }
    }
    for (const b of bookings ?? []) {
      if (!b.serviceId) {
        noServiceBooking++;
        sample.push(tech.id);
      }
      if (isPastConfirmed(b.status, b.endIso, Date.now())) {
        pastConfirmed++;
        sample.push(tech.id);
      }
    }
    for (const s of services ?? []) {
      if (s.active !== false && (s.pricePennies == null || s.pricePennies <= 0)) {
        noPrice++;
        sample.push(tech.id);
      }
    }
    if (tech.bookingPageLive !== false && (hours ?? 0) === 0) {
      liveNoHours++;
      sample.push(tech.id);
    }
  }

  const uniq = (ids: string[]) => [...new Set(ids)].slice(0, 8);
  const push = (rule: string, title: string, count: number) => {
    if (count <= 0) return;
    issues.push({
      rule,
      title,
      count,
      href: "/dashboard/admin/conflicts",
      sampleTechIds: uniq(sample),
    });
  };

  push("invalid_client_email", "Invalid client emails", invalidEmails);
  push("client_no_contact", "Clients with no contact method", noContact);
  push("booking_no_service", "Bookings with no service", noServiceBooking);
  push("past_confirmed", "Past bookings still confirmed", pastConfirmed);
  push("service_no_price", "Active services with no price", noPrice);
  push("live_no_hours", "Live accounts with no opening hours", liveNoHours);

  void now;
  return issues;
}
