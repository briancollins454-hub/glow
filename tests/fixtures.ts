import type {
  Booking,
  Client,
  PatchTest,
  Payment,
  Service,
  ServiceCategory,
  Tech,
  WorkingHour,
} from "@/lib/db/types";

export function makeService(overrides: Partial<Service> = {}): Service {
  return {
    id: "svc_1",
    techId: "tech_1",
    categoryId: "cat_1",
    name: "Classic Full Set",
    description: "",
    durationMin: 60,
    pricePennies: 5000,
    depositType: "percent",
    depositValue: 30,
    requiresPatchTest: false,
    isInfill: false,
    fullSetServiceId: null,
    infillMaxGapDays: 21,
    active: true,
    sortOrder: 0,
    photoPath: null,
    aftercareText: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

export function makeCategory(overrides: Partial<ServiceCategory> = {}): ServiceCategory {
  return {
    id: "cat_1",
    techId: "tech_1",
    name: "Lashes",
    patchTestValidityDays: 180,
    patchTestMinLeadHours: 24,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

export function makeClient(overrides: Partial<Client> = {}): Client {
  return {
    id: "cli_1",
    techId: "tech_1",
    name: "Sophie Turner",
    email: "sophie@example.com",
    phone: "07700900111",
    notes: "",
    isBlacklisted: false,
    warningNote: "",
    noShowCount: 0,
    isVip: false,
    messageToken: "tok_msg",
    lastNudgeAtIso: null,
    marketingOptOut: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

export function makePatchTest(overrides: Partial<PatchTest> = {}): PatchTest {
  return {
    id: "pt_1",
    techId: "tech_1",
    clientId: "cli_1",
    categoryId: "cat_1",
    performedAtIso: "2026-01-01T10:00:00.000Z",
    expiresAtIso: "2026-12-01T10:00:00.000Z",
    result: "pass",
    bookingId: null,
    notes: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

export function makeBooking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: "bk_1",
    techId: "tech_1",
    clientId: "cli_1",
    serviceId: "svc_1",
    startIso: "2026-06-01T10:00:00.000Z",
    endIso: "2026-06-01T11:00:00.000Z",
    status: "completed",
    pricePennies: 5000,
    depositPennies: 1500,
    depositStatus: "paid",
    balancePennies: 3500,
    balanceStatus: "paid",
    balanceToken: "tok_bal",
    isPatchTest: false,
    notes: "",
    lashMap: "",
    lashCurl: "",
    lashLength: "",
    addons: [],
    discountPennies: 0,
    googleEventId: null,
    createdAt: "2026-05-01T00:00:00.000Z",
    ...overrides,
  };
}

export function makePayment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: "pay_1",
    techId: "tech_1",
    bookingId: "bk_1",
    kind: "deposit",
    amountPennies: 1500,
    status: "succeeded",
    provider: "stripe",
    providerRef: "pi_1",
    createdAt: "2026-06-01T10:00:00.000Z",
    ...overrides,
  };
}

export function makeWorkingHour(overrides: Partial<WorkingHour> = {}): WorkingHour {
  return {
    id: "wh_1",
    techId: "tech_1",
    weekday: 3,
    startMinutes: 9 * 60,
    endMinutes: 17 * 60,
    lastStartMinutes: null,
    enabled: true,
    ...overrides,
  };
}

export function makeTech(overrides: Partial<Tech> = {}): Tech {
  return {
    id: "tech_1",
    authUserId: "auth_1",
    email: "tech@example.com",
    name: "Bella Rose",
    handle: "bellarose",
    businessName: "Bella Rose Beauty",
    bio: "",
    brandColor: "#db2777",
    instagram: "",
    tiktok: "",
    location: "",
    defaultDepositPct: 30,
    cancellationWindowHours: 48,
    noShowFeePct: 100,
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    subscriptionStatus: "active",
    plan: "monthly",
    currentPeriodEnd: null,
    stripeConnectAccountId: null,
    connectChargesEnabled: false,
    connectPayoutsEnabled: false,
    connectDetailsSubmitted: false,
    resetTokenHash: null,
    resetTokenExpiresAt: null,
    referredBy: null,
    loyaltyVisitThreshold: 0,
    loyaltyDiscountPct: 0,
    calendarToken: null,
    closureRequestedAt: null,
    closureReason: "",
    googleRefreshToken: null,
    googleCalendarId: null,
    googleCalendarEmail: null,
    googleConnectedAt: null,
    rebookNudgesEnabled: true,
    signupOffer: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}
