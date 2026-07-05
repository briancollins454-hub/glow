// Domain types. These mirror the Supabase schema in supabase/migrations/0001_init.sql.
// The runtime store is swappable (local JSON now, Supabase in Phase D) behind lib/db/repo.ts.

export type BookingStatus =
  | "pending"
  | "confirmed"
  | "completed"
  | "cancelled"
  | "no_show";

export type DepositType = "percent" | "fixed" | "none";
export type DepositStatus = "none" | "paid" | "forfeited" | "refunded";
export type BalanceStatus = "none" | "unpaid" | "paid" | "refunded";
export type PaymentKind = "deposit" | "balance" | "refund";
export type PaymentStatus = "succeeded" | "failed" | "refunded";
export type PatchTestResult = "pending" | "pass" | "fail";
export type ReminderChannel = "email" | "sms";
export type ReminderStatus = "scheduled" | "sent" | "skipped";
export type ReminderKind =
  | "confirmation"
  | "reminder_24h"
  | "reminder_2h"
  | "balance_request";

export interface Tech {
  id: string;
  authUserId: string | null;
  email: string;
  name: string;
  handle: string;
  businessName: string;
  bio: string;
  brandColor: string;
  instagram: string;
  tiktok: string;
  location: string;
  // Default deposit applied to new services
  defaultDepositPct: number;
  // No-show / cancellation protection policy
  cancellationWindowHours: number;
  noShowFeePct: number;
  // Platform subscription (Stripe Billing)
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  subscriptionStatus: SubscriptionStatus;
  plan: string | null;
  currentPeriodEnd: string | null;
  // Stripe Connect (client deposits pay out to the tech)
  stripeConnectAccountId: string | null;
  connectChargesEnabled: boolean;
  connectPayoutsEnabled: boolean;
  connectDetailsSubmitted: boolean;
  // Self-serve password reset (hashed single-use token)
  resetTokenHash: string | null;
  resetTokenExpiresAt: string | null;
  // Handle of the tech whose referral link brought this signup (if any)
  referredBy: string | null;
  // Loyalty reward: after N completed visits, clients get X% off (0 = off)
  loyaltyVisitThreshold: number;
  loyaltyDiscountPct: number;
  // Private token for read-only calendar feed subscriptions.
  calendarToken: string | null;
  // Account closure / deletion request tracking.
  closureRequestedAt: string | null;
  closureReason: string;
  // Direct Google Calendar sync for one-click setup.
  googleRefreshToken: string | null;
  googleCalendarId: string | null;
  googleCalendarEmail: string | null;
  googleConnectedAt: string | null;
  // Automated "time to rebook" emails to lapsed clients.
  rebookNudgesEnabled: boolean;
  createdAt: string;
}

export type SubscriptionStatus =
  | "none"
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "comped";

export interface ServiceCategory {
  id: string;
  techId: string;
  name: string;
  // Defaults used when a service requires a patch test
  patchTestValidityDays: number;
  patchTestMinLeadHours: number;
  createdAt: string;
}

export interface Service {
  id: string;
  techId: string;
  categoryId: string;
  name: string;
  description: string;
  durationMin: number;
  pricePennies: number;
  depositType: DepositType;
  // For percent: 0-100. For fixed: pennies. For none: ignored.
  depositValue: number;
  requiresPatchTest: boolean;
  isInfill: boolean;
  fullSetServiceId: string | null;
  infillMaxGapDays: number;
  active: boolean;
  sortOrder: number;
  // Storage path of the service photo shown on the booking page
  photoPath: string | null;
  // Aftercare instructions emailed to the client when the appointment completes
  aftercareText: string;
  createdAt: string;
}

/** Optional extra a client can add to a service (e.g. "Wispy", "Colour"). */
export interface ServiceAddon {
  id: string;
  techId: string;
  serviceId: string;
  name: string;
  pricePennies: number;
  active: boolean;
  createdAt: string;
}

/** Snapshot of an addon chosen on a booking (denormalised for history). */
export interface BookingAddon {
  name: string;
  pricePennies: number;
}

export interface WorkingHour {
  id: string;
  techId: string;
  weekday: number; // 0 = Sunday ... 6 = Saturday
  startMinutes: number; // minutes from midnight (local)
  endMinutes: number;
  // Latest time an appointment may START (may run past endMinutes). null = auto.
  lastStartMinutes: number | null;
  enabled: boolean;
}

export interface TimeOff {
  id: string;
  techId: string;
  startIso: string;
  endIso: string;
  reason: string;
}

export interface Client {
  id: string;
  techId: string;
  name: string;
  email: string;
  phone: string;
  notes: string;
  isBlacklisted: boolean;
  warningNote: string;
  noShowCount: number;
  // VIP clients always receive the loyalty discount, regardless of visit count.
  isVip: boolean;
  // Private, unguessable token for the no-login client message thread page.
  messageToken: string;
  // When the last automated rebooking nudge went out (null = never).
  lastNudgeAtIso: string | null;
  createdAt: string;
}

export type MessageSender = "tech" | "client";

export interface Message {
  id: string;
  techId: string;
  clientId: string;
  sender: MessageSender;
  body: string;
  readAt: string | null;
  createdAt: string;
}

export interface Booking {
  id: string;
  techId: string;
  clientId: string;
  serviceId: string;
  startIso: string;
  endIso: string;
  status: BookingStatus;
  pricePennies: number;
  depositPennies: number;
  depositStatus: DepositStatus;
  balancePennies: number;
  balanceStatus: BalanceStatus;
  balanceToken: string;
  isPatchTest: boolean;
  notes: string;
  // Lash record for this appointment (free text, tech-facing)
  lashMap: string;
  lashCurl: string;
  lashLength: string;
  // Extras chosen at booking time
  addons: BookingAddon[];
  // Loyalty (or other) discount applied to the price
  discountPennies: number;
  // Google Calendar event created by direct sync, if connected.
  googleEventId: string | null;
  createdAt: string;
}

export interface Payment {
  id: string;
  techId: string;
  bookingId: string;
  kind: PaymentKind;
  amountPennies: number;
  status: PaymentStatus;
  provider: string;
  providerRef: string;
  createdAt: string;
}

export interface PatchTest {
  id: string;
  techId: string;
  clientId: string;
  categoryId: string;
  performedAtIso: string;
  expiresAtIso: string;
  result: PatchTestResult;
  bookingId: string | null;
  notes: string;
  createdAt: string;
}

export interface Reminder {
  id: string;
  techId: string;
  bookingId: string;
  channel: ReminderChannel;
  kind: ReminderKind;
  sendAtIso: string;
  status: ReminderStatus;
  preview: string;
  sentAtIso: string | null;
  createdAt: string;
}

export type QuestionType = "text" | "longtext" | "yesno";

export interface ConsultationQuestion {
  id: string;
  techId: string;
  prompt: string;
  type: QuestionType;
  required: boolean;
  sortOrder: number;
  active: boolean;
  createdAt: string;
}

export interface FormAnswer {
  prompt: string;
  answer: string;
}

export interface FormResponse {
  id: string;
  techId: string;
  clientId: string;
  bookingId: string | null;
  answers: FormAnswer[];
  createdAt: string;
}

export type PhotoKind = "before" | "after" | "other";

export interface ClientPhoto {
  id: string;
  techId: string;
  clientId: string;
  bookingId: string | null;
  path: string;
  kind: PhotoKind;
  consent: boolean;
  createdAt: string;
}

export type ReviewStatus = "pending" | "approved" | "hidden";

export interface Review {
  id: string;
  techId: string;
  clientId: string;
  bookingId: string;
  rating: number;
  comment: string;
  status: ReviewStatus;
  createdAt: string;
}

export interface AuditEvent {
  id: string;
  techId: string;
  actor: "tech" | "client" | "system";
  action: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface AccountClosureRequest {
  id: string;
  techId: string;
  reason: string;
  status: "requested" | "processing" | "completed" | "cancelled";
  requestedAt: string;
  completedAt: string | null;
}

