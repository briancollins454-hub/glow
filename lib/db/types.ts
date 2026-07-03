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
  createdAt: string;
}

export interface WorkingHour {
  id: string;
  techId: string;
  weekday: number; // 0 = Sunday ... 6 = Saturday
  startMinutes: number; // minutes from midnight (local)
  endMinutes: number;
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
  // Private, unguessable token for the no-login client message thread page.
  messageToken: string;
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

