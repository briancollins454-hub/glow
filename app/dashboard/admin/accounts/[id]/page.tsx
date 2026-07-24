import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOwner } from "@/lib/owner/require-owner";
import { getOwnerAccountDetail } from "@/lib/owner/accounts";
import { OwnerNav } from "@/components/owner/owner-nav";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fmtDate, fmtDateTime, gbp } from "@/lib/format";
import {
  ownerSetTesterAction,
  ownerSetCompAction,
  ownerPasswordResetAction,
} from "../../owner-actions";

export const dynamic = "force-dynamic";

export default async function OwnerAccountDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string }>;
}) {
  await requireOwner();
  const { id } = await params;
  const sp = await searchParams;
  const detail = await getOwnerAccountDetail(id);
  if (!detail) notFound();
  const { tech } = detail;
  const isLive = ["trialing", "active", "comped"].includes(tech.subscriptionStatus);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard/admin/accounts" className="text-sm text-brand-text hover:underline">
          ← Accounts
        </Link>
        <h1 className="mt-2 font-display text-2xl font-semibold">{tech.businessName || tech.handle}</h1>
        <p className="text-sm text-ink-soft">
          {tech.email} · /{tech.handle} · joined {fmtDate(tech.createdAt)}
        </p>
      </div>
      <OwnerNav />

      {sp.ok ? (
        <p className="rounded-xl bg-success-soft px-4 py-3 text-sm text-success-text">Action saved ({sp.ok}).</p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Badge tone="neutral">{tech.subscriptionStatus}</Badge>
        {tech.plan ? <Badge tone="neutral">{tech.plan}</Badge> : null}
        {tech.signupOffer === "tester" ? <Badge tone="brand">Tester</Badge> : null}
        {tech.signupPartnerSlug ? <Badge tone="brand">Partner: {tech.signupPartnerSlug}</Badge> : null}
        {tech.connectChargesEnabled ? (
          <Badge tone="green">Connect ready</Badge>
        ) : (
          <Badge tone="amber">Connect pending</Badge>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Signup attribution</CardTitle>
          <CardDescription>UTM, partner and “how did you hear” captured at signup.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1 text-sm text-ink-soft">
          <p>UTM source: {tech.signupUtmSource || "—"}</p>
          <p>UTM medium: {tech.signupUtmMedium || "—"}</p>
          <p>UTM campaign: {tech.signupUtmCampaign || "—"}</p>
          <p>Heard about: {tech.signupHeardAbout || "—"}</p>
          <p>Partner slug: {tech.signupPartnerSlug || "—"}</p>
          <p>Referred by: {tech.referredBy || "—"}</p>
          <p>Referral credit granted: {tech.referralCreditGrantedAt ? fmtDate(tech.referralCreditGrantedAt) : "—"}</p>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Staff" value={String(detail.staff.length)} />
        <Stat label="Clients" value={String(detail.clientCount)} />
        <Stat label="Services" value={String(detail.services.length)} />
        <Stat label="Booking page views" value={String(detail.pageViews)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Owner actions</CardTitle>
          <CardDescription>Confirmation required. Every action is audited. View-only data; no impersonation.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ActionForm
            action={ownerSetTesterAction}
            id={tech.id}
            hidden={{ tester: tech.signupOffer === "tester" ? "0" : "1" }}
            label={tech.signupOffer === "tester" ? "Remove tester (£1) offer" : "Grant tester (£1) offer"}
          />
          {!isLive || tech.subscriptionStatus === "comped" ? (
            <ActionForm
              action={ownerSetCompAction}
              id={tech.id}
              hidden={{ comp: tech.subscriptionStatus === "comped" ? "0" : "1" }}
              label={tech.subscriptionStatus === "comped" ? "Remove complimentary access" : "Grant complimentary access"}
            />
          ) : (
            <p className="text-sm text-ink-faint">
              Complimentary toggle is hidden while a paid/trial subscription is live (cancel in Stripe first if needed).
            </p>
          )}
          <ActionForm
            action={ownerPasswordResetAction}
            id={tech.id}
            label="Email password reset link"
          />
          <Link
            href={`/dashboard/admin/support-import?tech=${encodeURIComponent(tech.id)}`}
            className="inline-flex rounded-xl border border-edge px-3 py-2 text-sm font-medium hover:border-brand-400/40"
          >
            Support import for this account
          </Link>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Staff</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {detail.staff.length === 0 ? (
              <p className="text-ink-faint">No staff rows.</p>
            ) : (
              detail.staff.map((s: { id: string; name: string; email: string; role: string; active: boolean }) => (
                <div key={s.id} className="rounded-lg border border-edge px-3 py-2">
                  {s.name} · {s.email} · {s.role}
                  {!s.active ? <span className="text-ink-faint"> (inactive)</span> : null}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Services (sample)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {detail.services.length === 0 ? (
              <p className="text-ink-faint">No services.</p>
            ) : (
              detail.services.map((s: { id: string; name: string; active: boolean; pricePennies: number }) => (
                <div key={s.id} className="flex justify-between rounded-lg border border-edge px-3 py-2">
                  <span>
                    {s.name}
                    {!s.active ? <span className="text-ink-faint"> (off)</span> : null}
                  </span>
                  <span>{gbp(s.pricePennies)}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent bookings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {detail.bookings.length === 0 ? (
              <p className="text-ink-faint">None.</p>
            ) : (
              detail.bookings.map(
                (b: { id: string; startIso: string; status: string; pricePennies: number }) => (
                  <div key={b.id} className="flex justify-between rounded-lg border border-edge px-3 py-2">
                    <span>
                      {fmtDateTime(b.startIso)} · {b.status}
                    </span>
                    <span>{gbp(b.pricePennies)}</span>
                  </div>
                ),
              )
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payments (client Connect)</CardTitle>
            <CardDescription>Not Glow subscription revenue.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {detail.payments.length === 0 ? (
              <p className="text-ink-faint">None.</p>
            ) : (
              detail.payments.map(
                (p: { id: string; kind: string; status: string; amountPennies: number; createdAt: string }) => (
                  <div key={p.id} className="flex justify-between rounded-lg border border-edge px-3 py-2">
                    <span>
                      {p.kind} · {p.status} · {fmtDate(p.createdAt)}
                    </span>
                    <span>{gbp(p.amountPennies)}</span>
                  </div>
                ),
              )
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Subscription</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-ink-soft space-y-1">
          <p>Status: {tech.subscriptionStatus}</p>
          <p>Plan: {tech.plan ?? "—"}</p>
          <p>Period end: {tech.currentPeriodEnd ? fmtDate(tech.currentPeriodEnd) : "—"}</p>
          <p>Stripe customer: {tech.stripeCustomerId ?? "—"}</p>
          <p>Stripe subscription: {tech.stripeSubscriptionId ?? "—"}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Audit trail (account)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {detail.audits.length === 0 ? (
            <p className="text-ink-faint">No events.</p>
          ) : (
            detail.audits.map(
              (a: { id: string; action: string; createdAt: string; actor: string }) => (
                <div key={a.id} className="rounded-lg border border-edge px-3 py-2">
                  <span className="font-medium">{a.action}</span>
                  <span className="text-ink-faint">
                    {" "}
                    · {a.actor} · {fmtDateTime(a.createdAt)}
                  </span>
                </div>
              ),
            )
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-edge bg-surface p-4">
      <p className="text-xs text-ink-faint">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function ActionForm({
  action,
  id,
  label,
  hidden,
}: {
  action: (formData: FormData) => Promise<void>;
  id: string;
  label: string;
  hidden?: Record<string, string>;
}) {
  return (
    <form action={action} className="flex flex-wrap items-end gap-2 rounded-xl border border-edge bg-cream p-3">
      <input type="hidden" name="id" value={id} />
      {hidden
        ? Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)
        : null}
      <div>
        <label className="block text-xs text-ink-faint">Type yes to confirm</label>
        <input
          name="confirm"
          className="mt-1 w-28 rounded-lg border border-edge bg-surface px-2 py-1.5 text-sm"
          autoComplete="off"
        />
      </div>
      <button type="submit" className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white">
        {label}
      </button>
    </form>
  );
}
