import { describe, expect, it, vi } from "vitest";
import { makeBooking, makeClient } from "./fixtures";
import {
  REBOOK_MAX_GAP_DAYS,
  REBOOK_NUDGE_COOLDOWN_DAYS,
  REBOOK_UPCOMING_HORIZON_DAYS,
  rebookNudgeBookingWindow,
  selectRebookNudgeCandidates,
} from "@/lib/rebooking";
import type { RebookNudgeBooking, RebookNudgeClient } from "@/lib/db/queries";

const DAY = 24 * 60 * 60 * 1000;

function daysAgo(nowMs: number, days: number): string {
  return new Date(nowMs - days * DAY).toISOString();
}
function daysAhead(nowMs: number, days: number): string {
  return new Date(nowMs + days * DAY).toISOString();
}

/** Old unfiltered path: full client/booking rows + the same JS rules. */
function legacyCandidates(
  clients: RebookNudgeClient[],
  bookings: RebookNudgeBooking[],
  nowMs: number,
) {
  return selectRebookNudgeCandidates(clients, bookings, nowMs).map((c) => c.client.id);
}

/** New path: SQL-shaped filters + date-bounded bookings, then same JS rules. */
function boundedCandidates(
  clients: RebookNudgeClient[],
  bookings: RebookNudgeBooking[],
  nowMs: number,
) {
  const cooldownBefore = nowMs - REBOOK_NUDGE_COOLDOWN_DAYS * DAY;
  const { fromIso, toIso } = rebookNudgeBookingWindow(nowMs);
  const fromMs = new Date(fromIso).getTime();
  const toMs = new Date(toIso).getTime();

  const filteredClients = clients.filter((c) => {
    if (c.isBlacklisted || c.marketingOptOut) return false;
    if (!c.email) return false;
    const lastNudge = c.lastNudgeAtIso ? new Date(c.lastNudgeAtIso).getTime() : 0;
    if (lastNudge && lastNudge >= cooldownBefore) return false;
    return true;
  });
  const filteredBookings = bookings.filter((b) => {
    const t = new Date(b.startIso).getTime();
    return t >= fromMs && t <= toMs;
  });
  return selectRebookNudgeCandidates(filteredClients, filteredBookings, nowMs).map(
    (c) => c.client.id,
  );
}

describe("rebook nudge bounded queries", () => {
  it("listRebookNudgeBookings is date-bounded with a slim select", async () => {
    vi.resetModules();
    const calls: { gte?: string; lte?: string; select?: string; range?: [number, number] }[] = [];
    const range = vi.fn((from: number, to: number) => {
      calls[calls.length - 1].range = [from, to];
      return Promise.resolve({ data: [], error: null });
    });
    const order = vi.fn(() => ({ range }));
    const lte = vi.fn((col: string, value: string) => {
      expect(col).toBe("startIso");
      calls[calls.length - 1].lte = value;
      return { order };
    });
    const gte = vi.fn((col: string, value: string) => {
      expect(col).toBe("startIso");
      calls[calls.length - 1].gte = value;
      return { lte };
    });
    const eq = vi.fn(() => ({ gte }));
    const select = vi.fn((cols: string) => {
      calls.push({ select: cols });
      return { eq };
    });
    const from = vi.fn(() => ({ select }));
    const sb = { from } as never;

    const { listRebookNudgeBookings } = await import("@/lib/db/queries");
    const now = Date.parse("2026-07-22T12:00:00.000Z");
    const { fromIso, toIso } = rebookNudgeBookingWindow(now);
    await listRebookNudgeBookings(sb, "tech_1", fromIso, toIso);

    expect(from).toHaveBeenCalledWith("bookings");
    expect(calls[0]?.select).toBe("id, clientId, serviceId, startIso, status");
    expect(calls[0]?.gte).toBe(fromIso);
    expect(calls[0]?.lte).toBe(toIso);
    expect(new Date(fromIso).getTime()).toBe(now - REBOOK_MAX_GAP_DAYS * DAY);
    expect(new Date(toIso).getTime()).toBe(now + REBOOK_UPCOMING_HORIZON_DAYS * DAY);
  });

  it("candidate selection matches the old full-table logic on a mixed fixture", () => {
    const now = Date.parse("2026-07-22T12:00:00.000Z");

    const clients: RebookNudgeClient[] = [
      makeClient({
        id: "cli_lapsed",
        email: "lapsed@glow-uk.com",
        messageToken: "tok_lapsed",
        lastNudgeAtIso: null,
      }),
      makeClient({
        id: "cli_recent",
        email: "recent@glow-uk.com",
        messageToken: "tok_recent",
        lastNudgeAtIso: null,
      }),
      makeClient({
        id: "cli_upcoming",
        email: "upcoming@glow-uk.com",
        messageToken: "tok_upcoming",
        lastNudgeAtIso: null,
      }),
      makeClient({
        id: "cli_optout",
        email: "optout@glow-uk.com",
        messageToken: "tok_optout",
        marketingOptOut: true,
        lastNudgeAtIso: null,
      }),
      makeClient({
        id: "cli_cooled",
        email: "cooled@glow-uk.com",
        messageToken: "tok_cooled",
        lastNudgeAtIso: daysAgo(now, 10),
      }),
      makeClient({
        id: "cli_blacklisted",
        email: "blocked@glow-uk.com",
        messageToken: "tok_blocked",
        isBlacklisted: true,
        lastNudgeAtIso: null,
      }),
      makeClient({
        id: "cli_ancient",
        email: "ancient@glow-uk.com",
        messageToken: "tok_ancient",
        lastNudgeAtIso: null,
      }),
    ];

    const bookings: RebookNudgeBooking[] = [
      // Lapsed: completed 45 days ago → should nudge
      {
        id: "bk_lapsed",
        clientId: "cli_lapsed",
        serviceId: "svc_1",
        status: "completed",
        startIso: daysAgo(now, 45),
      },
      // Recent visit: completed 10 days ago → too soon
      {
        id: "bk_recent",
        clientId: "cli_recent",
        serviceId: "svc_1",
        status: "completed",
        startIso: daysAgo(now, 10),
      },
      // Upcoming booking suppresses nudge despite a lapsed last visit
      {
        id: "bk_upcoming_past",
        clientId: "cli_upcoming",
        serviceId: "svc_1",
        status: "completed",
        startIso: daysAgo(now, 45),
      },
      {
        id: "bk_upcoming_future",
        clientId: "cli_upcoming",
        serviceId: "svc_1",
        status: "confirmed",
        startIso: daysAhead(now, 14),
      },
      // Opted-out client with a lapsed visit
      {
        id: "bk_optout",
        clientId: "cli_optout",
        serviceId: "svc_1",
        status: "completed",
        startIso: daysAgo(now, 45),
      },
      // Cooldown client with a lapsed visit
      {
        id: "bk_cooled",
        clientId: "cli_cooled",
        serviceId: "svc_1",
        status: "completed",
        startIso: daysAgo(now, 45),
      },
      // Blacklisted
      {
        id: "bk_blocked",
        clientId: "cli_blacklisted",
        serviceId: "svc_1",
        status: "completed",
        startIso: daysAgo(now, 45),
      },
      // Outside the 120-day window (and too old to nudge)
      {
        id: "bk_ancient",
        clientId: "cli_ancient",
        serviceId: "svc_1",
        status: "completed",
        startIso: daysAgo(now, 200),
      },
      // Noise outside the window that old logic would load
      makeBooking({
        id: "bk_noise",
        clientId: "cli_lapsed",
        status: "cancelled",
        startIso: daysAgo(now, 400),
      }),
    ];

    const legacy = legacyCandidates(clients, bookings, now);
    const bounded = boundedCandidates(clients, bookings, now);

    expect(legacy).toEqual(["cli_lapsed"]);
    expect(bounded).toEqual(legacy);
  });
});
