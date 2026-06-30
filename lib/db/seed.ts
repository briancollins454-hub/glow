import { hashPassword } from "@/lib/auth/password";
import { randomId, randomToken } from "@/lib/utils";
import type {
  Booking,
  Client,
  DB,
  PatchTest,
  Reminder,
  Service,
  ServiceCategory,
} from "./types";

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

function iso(offsetMs: number): string {
  return new Date(Date.now() + offsetMs).toISOString();
}

// Build a date at a specific local-ish hour, N days from now (kept simple/UTC for the demo seed).
function dayAt(daysFromNow: number, hour: number, minute = 0): Date {
  const d = new Date(Date.now() + daysFromNow * DAY);
  d.setUTCHours(hour, minute, 0, 0);
  return d;
}

export function buildSeed(): DB {
  const techId = "tech_demo";

  const cats: ServiceCategory[] = [
    {
      id: "cat_lashes",
      techId,
      name: "Lashes",
      patchTestValidityDays: 180,
      patchTestMinLeadHours: 24,
      createdAt: iso(-120 * DAY),
    },
    {
      id: "cat_nails",
      techId,
      name: "Nails",
      patchTestValidityDays: 365,
      patchTestMinLeadHours: 0,
      createdAt: iso(-120 * DAY),
    },
    {
      id: "cat_brows",
      techId,
      name: "Brows",
      patchTestValidityDays: 180,
      patchTestMinLeadHours: 48,
      createdAt: iso(-120 * DAY),
    },
  ];

  const services: Service[] = [
    svc("svc_lash_full", "cat_lashes", "Classic Full Set", "A full set of classic individual lashes for natural length and definition.", 120, 5500, "percent", 30, true, false, null, 0, 0),
    svc("svc_lash_infill", "cat_lashes", "Classic Infill (2-3 weeks)", "Top-up your existing classic set. Must be within 3 weeks of your last appointment with 40%+ lashes remaining.", 75, 3500, "percent", 30, true, true, "svc_lash_full", 21, 1),
    svc("svc_lash_hybrid", "cat_lashes", "Hybrid Full Set", "A mix of classic and volume lashes for added texture and fullness.", 135, 6500, "percent", 30, true, false, null, 0, 2),
    svc("svc_nail_full", "cat_nails", "Acrylic Full Set", "Full set of acrylic extensions, shaped and finished with colour of choice.", 90, 4000, "percent", 25, false, false, null, 0, 3),
    svc("svc_nail_infill", "cat_nails", "Acrylic Infill (2-3 weeks)", "Maintenance infill on your existing acrylic set.", 60, 2800, "percent", 25, false, true, "svc_nail_full", 21, 4),
    svc("svc_brow_lam", "cat_brows", "Brow Lamination", "Brow lamination with tint and shape for fuller, brushed-up brows.", 60, 4000, "percent", 30, true, false, null, 0, 5),
    svc("svc_brow_maint", "cat_brows", "Brow Lamination Maintenance", "Maintenance lamination for returning clients (within 8 weeks).", 50, 3500, "percent", 30, true, true, "svc_brow_lam", 56, 6),
  ];

  // Tue(2)-Sat(6) 09:00-17:00
  const workingHours = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
    id: `wh_${weekday}`,
    techId,
    weekday,
    startMinutes: 9 * 60,
    endMinutes: 17 * 60,
    enabled: weekday >= 2 && weekday <= 6,
  }));

  const clients: Client[] = [
    {
      id: "cli_sophie",
      techId,
      name: "Sophie Turner",
      email: "sophie@example.com",
      phone: "+447700900111",
      notes: "Prefers a natural look. Allergic to nothing known.",
      isBlacklisted: false,
      warningNote: "",
      noShowCount: 0,
      createdAt: iso(-90 * DAY),
    },
    {
      id: "cli_aisha",
      techId,
      name: "Aisha Khan",
      email: "aisha@example.com",
      phone: "+447700900222",
      notes: "",
      isBlacklisted: false,
      warningNote: "",
      noShowCount: 0,
      createdAt: iso(-2 * DAY),
    },
    {
      id: "cli_megan",
      techId,
      name: "Megan Lloyd",
      email: "megan@example.com",
      phone: "+447700900333",
      notes: "",
      isBlacklisted: true,
      warningNote: "Two no-shows in a row (Mar & Apr). Require full prepayment before booking.",
      noShowCount: 2,
      createdAt: iso(-200 * DAY),
    },
  ];

  // Sophie had a classic full set 10 days ago (so she is eligible for an infill now)
  const sophiePast: Booking = booking(
    "bk_sophie_past",
    "cli_sophie",
    "svc_lash_full",
    dayAt(-10, 10),
    120,
    5500,
    "completed",
    "paid",
    "paid",
  );

  // Sophie has an upcoming infill booked in 3 days
  const sophieUpcoming: Booking = booking(
    "bk_sophie_next",
    "cli_sophie",
    "svc_lash_infill",
    dayAt(3, 11),
    75,
    3500,
    "confirmed",
    "paid",
    "unpaid",
  );

  const bookings: Booking[] = [sophiePast, sophieUpcoming];

  const patchTests: PatchTest[] = [
    {
      id: "pt_sophie_lash",
      techId,
      clientId: "cli_sophie",
      categoryId: "cat_lashes",
      performedAtIso: iso(-40 * DAY),
      expiresAtIso: iso(140 * DAY),
      result: "pass",
      bookingId: null,
      notes: "No reaction.",
      createdAt: iso(-40 * DAY),
    },
  ];

  const reminders: Reminder[] = [
    reminder("rem_sophie_24", "bk_sophie_next", "sms", "reminder_24h", new Date(sophieUpcoming.startIso).getTime() - 24 * HOUR),
    reminder("rem_sophie_bal", "bk_sophie_next", "email", "balance_request", new Date(sophieUpcoming.startIso).getTime() - 48 * HOUR),
  ];

  const payments = [
    {
      id: "pay_sophie_past",
      techId,
      bookingId: "bk_sophie_past",
      kind: "deposit" as const,
      amountPennies: 1650,
      status: "succeeded" as const,
      provider: "stub",
      providerRef: "stub_seed_1",
      createdAt: sophiePast.startIso,
    },
    {
      id: "pay_sophie_past_bal",
      techId,
      bookingId: "bk_sophie_past",
      kind: "balance" as const,
      amountPennies: 3850,
      status: "succeeded" as const,
      provider: "stub",
      providerRef: "stub_seed_2",
      createdAt: sophiePast.startIso,
    },
    {
      id: "pay_sophie_next",
      techId,
      bookingId: "bk_sophie_next",
      kind: "deposit" as const,
      amountPennies: 1050,
      status: "succeeded" as const,
      provider: "stub",
      providerRef: "stub_seed_3",
      createdAt: iso(-1 * DAY),
    },
  ];

  return {
    techs: [
      {
        id: techId,
        email: "demo@glow.app",
        passwordHash: hashPassword("password123"),
        name: "Bella Rose",
        handle: "bellarose",
        businessName: "Bella Rose Beauty",
        bio: "Lash, brow & nail tech based in Manchester. Cosy home studio, free parking. Booking deposits secure your slot.",
        brandColor: "#db2777",
        instagram: "bellarosebeauty",
        tiktok: "bellarosebeauty",
        location: "Manchester, UK",
        defaultDepositPct: 30,
        cancellationWindowHours: 48,
        noShowFeePct: 100,
        createdAt: iso(-120 * DAY),
      },
    ],
    categories: cats,
    services,
    workingHours,
    timeOff: [],
    clients,
    bookings,
    payments,
    patchTests,
    reminders,
    sessions: [],
  };

  // ---- local builders ----
  function svc(
    id: string,
    categoryId: string,
    name: string,
    description: string,
    durationMin: number,
    pricePennies: number,
    depositType: Service["depositType"],
    depositValue: number,
    requiresPatchTest: boolean,
    isInfill: boolean,
    fullSetServiceId: string | null,
    infillMaxGapDays: number,
    sortOrder = 0,
  ): Service {
    return {
      id,
      techId,
      categoryId,
      name,
      description,
      durationMin,
      pricePennies,
      depositType,
      depositValue,
      requiresPatchTest,
      isInfill,
      fullSetServiceId,
      infillMaxGapDays,
      active: true,
      sortOrder,
      createdAt: iso(-120 * DAY),
    };
  }

  function booking(
    id: string,
    clientId: string,
    serviceId: string,
    start: Date,
    durationMin: number,
    pricePennies: number,
    status: Booking["status"],
    depositStatus: Booking["depositStatus"],
    balanceStatus: Booking["balanceStatus"],
  ): Booking {
    const svcRow = services.find((s) => s.id === serviceId)!;
    const deposit = depositForSeed(svcRow);
    const end = new Date(start.getTime() + durationMin * 60 * 1000);
    return {
      id,
      techId,
      clientId,
      serviceId,
      startIso: start.toISOString(),
      endIso: end.toISOString(),
      status,
      pricePennies,
      depositPennies: deposit,
      depositStatus,
      balancePennies: pricePennies - deposit,
      balanceStatus,
      balanceToken: randomToken(),
      isPatchTest: false,
      notes: "",
      createdAt: iso(-12 * DAY),
    };
  }

  function depositForSeed(s: Service): number {
    if (s.depositType === "none") return 0;
    if (s.depositType === "fixed") return s.depositValue;
    return Math.round((s.pricePennies * s.depositValue) / 100);
  }

  function reminder(
    id: string,
    bookingId: string,
    channel: Reminder["channel"],
    kind: Reminder["kind"],
    sendAtMs: number,
  ): Reminder {
    return {
      id,
      techId,
      bookingId,
      channel,
      kind,
      sendAtIso: new Date(sendAtMs).toISOString(),
      status: sendAtMs < Date.now() ? "sent" : "scheduled",
      preview: "",
      sentAtIso: sendAtMs < Date.now() ? new Date(sendAtMs).toISOString() : null,
      createdAt: iso(-1 * DAY),
    };
  }
}

// Silence unused import in some toolchains
void randomId;
