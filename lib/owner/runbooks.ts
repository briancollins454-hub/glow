/**
 * Embedded incident runbooks (Phase 4).
 */

export type Runbook = {
  id: string;
  title: string;
  alertRules: string[];
  summary: string;
  steps: string[];
  links: { href: string; label: string }[];
};

export const RUNBOOKS: Runbook[] = [
  {
    id: "deliverability-drop",
    title: "Deliverability drop",
    alertRules: ["platform_bounce_rate", "suppression_spike", "tech_delivery_flag"],
    summary: "Bounce or complaint rate is elevated. Stop the bleed before reputation damage.",
    steps: [
      "Open Deliverability — check 24h bounce/complaint vs 7d baseline.",
      "Confirm kill switch is not needed; if spike is severe, pause all outbound from Controls.",
      "Filter suppressions and hard bounces; do not unsuppress without evidence.",
      "Check Webhooks → Resend for processing failures.",
      "Identify accounts with delivery flags and pause their outbound if needed.",
    ],
    links: [
      { href: "/dashboard/admin/deliverability", label: "Deliverability" },
      { href: "/dashboard/admin/controls", label: "Kill switches" },
      { href: "/dashboard/admin/webhooks", label: "Webhooks" },
    ],
  },
  {
    id: "payment-dispute",
    title: "Payment dispute / where's my money",
    alertRules: ["past_due"],
    summary: "Client or tech asking where a Connect payment went, or a dispute landed.",
    steps: [
      "Omni-search the payment intent, charge, or booking id.",
      "Open Money and the account detail — confirm Connect account and payout status.",
      "Check Stripe Dashboard for the Connect account; Glow does not hold client funds.",
      "If Glow subscription past-due, that is separate from Connect client payments.",
    ],
    links: [
      { href: "/dashboard/admin/search", label: "Omni-search" },
      { href: "/dashboard/admin/money", label: "Money" },
    ],
  },
  {
    id: "scraper-traffic",
    title: "Scraper / anomalous traffic",
    alertRules: [],
    summary: "Sudden traffic from one IP or UA, or booking page abuse.",
    steps: [
      "Open Traffic — look for single-IP or UA spikes.",
      "Identify affected handles via page views.",
      "If abuse continues, pause the account booking page via support (settings) or block the account.",
      "Log a note on the account for continuity.",
    ],
    links: [
      { href: "/dashboard/admin/traffic", label: "Traffic" },
      { href: "/dashboard/admin/events", label: "Events" },
    ],
  },
  {
    id: "failed-cron",
    title: "Failed cron",
    alertRules: ["cron_failure_streak"],
    summary: "Reminders or owner-daily job failing repeatedly.",
    steps: [
      "Open Operations — read the latest cron_runs error.",
      "If cronPaused kill switch is on, turn it off only after confirming safety.",
      "Run reminders manually with confirmation; watch the log.",
      "Check Errors for related fingerprints; resolve after fix.",
    ],
    links: [
      { href: "/dashboard/admin/ops", label: "Operations" },
      { href: "/dashboard/admin/errors", label: "Errors" },
      { href: "/dashboard/admin/controls", label: "Controls" },
    ],
  },
];

export function runbookForAlertRule(rule: string): Runbook | null {
  return RUNBOOKS.find((r) => r.alertRules.includes(rule)) ?? null;
}
