import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOwner } from "@/lib/owner/require-owner";
import { isPlatformOwner } from "@/lib/admin";
import { getOwnerAccountDetail } from "@/lib/owner/accounts";
import { OwnerNav } from "@/components/owner/owner-nav";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { PLATFORM_TZ, salonCurrency, salonTz } from "@/lib/locale";
import { money } from "@/lib/money";
import {
  ownerSetCompAction,
  ownerPasswordResetAction,
  ownerBlockAccountAction,
  ownerUnblockAccountAction,
  ownerDeleteAccountAction,
} from "../../owner-actions";
import { startViewAsAction } from "../view-as-actions";
import { setInternalFlagAction } from "../../internal-actions";
import { setOwnerTagsAction, setAtRiskManualAction } from "../../phase2-actions";
import { setAccountOutboundPauseAction } from "../../phase3-actions";
import { addOwnerNoteAction } from "../../phase4-actions";
import { formatHealthLabel } from "@/lib/owner/health";
import { countUpcomingForTech, listUpcomingOutbound } from "@/lib/owner/outbound";
import { flagsForTech } from "@/lib/owner/flags";
import { getAccountTimeline, listOwnerNotes, listSettingsHistory } from "@/lib/owner/timeline";
import { OwnerPushDiagnostics } from "@/components/owner/owner-push-diagnostics";

export const dynamic = "force-dynamic";

export default async function OwnerAccountDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; err?: string }>;
}) {
  const { tech: admin } = await requireOwner();
  const { id } = await params;
  const sp = await searchParams;
  const detail = await getOwnerAccountDetail(id);
  if (!detail) notFound();
  const { tech } = detail;
  const isLive = ["trialing", "active", "comped"].includes(tech.subscriptionStatus);
  const canModerate = isPlatformOwner(admin);
  const isBlocked = !!tech.blockedAt;
  const isSelf = admin.id === tech.id;
  const [upcomingCount, upcomingSample, featureFlags, notes, timeline, settingsHistory] =
    await Promise.all([
      countUpcomingForTech(tech.id, 24 * 7),
      listUpcomingOutbound({ techId: tech.id, withinHours: 24 * 7, limit: 8 }),
      flagsForTech(tech.id).catch(() => ({}) as Record<string, boolean>),
      listOwnerNotes(tech.id, 30),
      getAccountTimeline(tech.id, 60),
      listSettingsHistory(tech.id, 20),
    ]);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard/admin/accounts" className="text-sm text-brand-text hover:underline">
          ← Accounts
        </Link>
        <h1 className="mt-2 font-display text-2xl font-semibold">{tech.businessName || tech.handle}</h1>
        <p className="text-sm text-ink-soft">
          {tech.email} · /{tech.handle} · joined {fmtDate(tech.createdAt, PLATFORM_TZ)}
        </p>
      </div>
      <OwnerNav />

      {sp.ok ? (
        <p className="rounded-xl bg-success-soft px-4 py-3 text-sm text-success-text">Action saved ({sp.ok}).</p>
      ) : null}
      {sp.err === "confirm" || sp.err === "confirm_handle" ? (
        <p className="rounded-xl bg-amber-500/15 px-4 py-3 text-sm text-warning-text">
          {sp.err === "confirm_handle"
            ? "Type the account handle exactly to confirm permanent delete."
            : "Type yes to confirm before running this action."}
        </p>
      ) : null}
      {sp.err === "reason" ? (
        <p className="rounded-xl bg-amber-500/15 px-4 py-3 text-sm text-warning-text">
          A reason is required to block an account.
        </p>
      ) : null}
      {sp.err === "self" ? (
        <p className="rounded-xl bg-amber-500/15 px-4 py-3 text-sm text-warning-text">
          You cannot block or delete your own platform owner account.
        </p>
      ) : null}

      {(() => {
        const h = formatHealthLabel(tech);
        return (
          <p className="rounded-xl border border-edge bg-surface px-4 py-3 text-sm">
            Health: <strong>{h.score}</strong> ({h.band}) — {h.reasons}
          </p>
        );
      })()}

      <OwnerPushDiagnostics techId={tech.id} />

      <Card className={upcomingCount > 0 ? "border-amber-500/50" : undefined}>
        <CardHeader>
          <CardTitle>
            Upcoming client-facing sends: {upcomingCount}
          </CardTitle>
          <CardDescription>
            Next 7 days. Cancel or pause before Glow contacts this account&apos;s clients.{" "}
            <Link
              href={`/dashboard/admin/outbound?tech=${encodeURIComponent(tech.id)}`}
              className="underline-offset-2 hover:underline"
            >
              Open outbound console
            </Link>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {tech.outboundPausedAt ? (
            <p className="rounded-lg bg-amber-500/15 px-3 py-2 text-warning-text">
              Outbound paused since {fmtDateTime(tech.outboundPausedAt, PLATFORM_TZ)}
              {tech.outboundPausedReason ? ` — ${tech.outboundPausedReason}` : ""}
            </p>
          ) : null}
          {upcomingSample.length === 0 ? (
            <p className="text-ink-faint">None scheduled.</p>
          ) : (
            upcomingSample.map((s) => (
              <div key={s.id} className="rounded-lg border border-edge px-3 py-2">
                <span className="font-medium">{s.kind}</span>
                <span className="text-ink-faint">
                  {" "}
                  · {s.channel} · {s.destination || "—"} · {fmtDateTime(s.scheduledFor, PLATFORM_TZ)}
                </span>
              </div>
            ))
          )}
          <form
            action={setAccountOutboundPauseAction}
            className="flex flex-wrap items-end gap-2 rounded-xl border border-edge bg-cream p-3"
          >
            <input type="hidden" name="id" value={tech.id} />
            <input type="hidden" name="paused" value={tech.outboundPausedAt ? "0" : "1"} />
            <div className="min-w-[180px] flex-1">
              <label className="block text-xs text-ink-faint">Reason</label>
              <input
                name="reason"
                required
                className="mt-1 w-full rounded-lg border border-edge bg-surface px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-ink-faint">Type yes</label>
              <input
                name="confirm"
                placeholder="type yes"
                className="mt-1 w-28 rounded-lg border border-edge bg-surface px-2 py-1.5 text-sm"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                autoComplete="off"
                />
            </div>
            <button
              type="submit"
              className={
                tech.outboundPausedAt
                  ? "rounded-lg border border-edge px-3 py-2 text-sm font-medium"
                  : "rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white"
              }
            >
              {tech.outboundPausedAt ? "Resume outbound" : "Pause all outbound"}
            </button>
          </form>
        </CardContent>
      </Card>

      {Object.keys(featureFlags).length > 0 ? (
        <p className="rounded-xl border border-edge bg-surface px-4 py-3 text-sm text-ink-soft">
          Feature flags:{" "}
          {Object.entries(featureFlags)
            .map(([k, v]) => `${k}=${v ? "on" : "off"}`)
            .join(" · ")}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Badge tone="neutral">{tech.subscriptionStatus}</Badge>
        {isBlocked ? <Badge tone="amber">Blocked</Badge> : null}
        {tech.plan ? <Badge tone="neutral">{tech.plan}</Badge> : null}
        {tech.signupOffer === "trial" ? <Badge tone="brand">Trial signup</Badge> : null}
        {tech.signupOffer === "half_price" ? <Badge tone="neutral">Half-price signup</Badge> : null}
        {tech.signupPartnerSlug ? <Badge tone="brand">Partner: {tech.signupPartnerSlug}</Badge> : null}
        {tech.connectChargesEnabled ? (
          <Badge tone="green">Connect ready</Badge>
        ) : (
          <Badge tone="amber">Connect pending</Badge>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Owner notes</CardTitle>
          <CardDescription>
            Timestamped freeform notes (Messenger context lives here). Tags: champion, at risk, feature
            request, migration pending, do not contact.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <form action={addOwnerNoteAction} className="space-y-2 rounded-xl border border-edge bg-cream p-3">
            <input type="hidden" name="id" value={tech.id} />
            <textarea
              name="body"
              required
              rows={3}
              placeholder="Note…"
              className="w-full rounded-lg border border-edge bg-surface px-2 py-1.5 text-sm"
            />
            <button type="submit" className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm text-white">
              Add note
            </button>
          </form>
          {notes.length === 0 ? (
            <p className="text-ink-faint">No notes yet.</p>
          ) : (
            notes.map((n: { id: string; body: string; authorEmail: string; createdAt: string }) => (
              <div key={n.id} className="rounded-lg border border-edge px-3 py-2">
                <p className="whitespace-pre-wrap">{n.body}</p>
                <p className="mt-1 text-xs text-ink-faint">
                  {n.authorEmail} · {fmtDateTime(n.createdAt, PLATFORM_TZ)}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Unified timeline</CardTitle>
          <CardDescription>
            Bookings, payments, emails, notes, owner actions, platform events, flags — newest first.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm max-h-[420px] overflow-y-auto">
          {timeline.length === 0 ? (
            <p className="text-ink-faint">No timeline events.</p>
          ) : (
            timeline.map((item) => (
              <div key={item.id} className="rounded-lg border border-edge px-3 py-2">
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="font-medium">{item.title}</span>
                  <span className="text-xs text-ink-faint">{fmtDateTime(item.at, PLATFORM_TZ)}</span>
                </div>
                <p className="text-xs text-ink-faint">
                  {item.source}
                  {item.detail ? ` · ${item.detail}` : ""}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Settings change history</CardTitle>
          <CardDescription>What changed, from/to, when, by whom (from settings_updated audits).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {settingsHistory.length === 0 ? (
            <p className="text-ink-faint">
              No settings diffs logged yet. Future Settings saves write before/after into audit_events.
            </p>
          ) : (
            settingsHistory.map(
              (h: {
                id: string;
                actor: string;
                createdAt: string;
                metadata: Record<string, unknown>;
              }) => (
                <div key={h.id} className="rounded-lg border border-edge px-3 py-2">
                  <p className="text-xs text-ink-faint">
                    {fmtDateTime(h.createdAt, PLATFORM_TZ)} · {h.actor}
                  </p>
                  <pre className="mt-1 max-h-28 overflow-auto text-xs text-ink-soft">
                    {JSON.stringify(h.metadata?.changes ?? h.metadata, null, 2)}
                  </pre>
                </div>
              ),
            )
          )}
        </CardContent>
      </Card>

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
          <p>Signup offer (frozen): {tech.signupOffer || "—"}</p>
          <p>Trial ends: {tech.trialEndsAt ? fmtDate(tech.trialEndsAt, PLATFORM_TZ) : "—"}</p>
          <p>Referred by: {tech.referredBy || "—"}</p>
          <p>Referral credit granted: {tech.referralCreditGrantedAt ? fmtDate(tech.referralCreditGrantedAt, PLATFORM_TZ) : "—"}</p>
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
          <CardDescription>
            Confirmation required. Every action is audited. View-as is read-only (mutations blocked).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
          <form action={startViewAsAction} className="flex flex-wrap items-end gap-2 rounded-xl border border-edge bg-cream p-3">
            <input type="hidden" name="id" value={tech.id} />
            <button type="submit" className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white">
              View as account (read only)
            </button>
          </form>
          <form action={setInternalFlagAction} className="flex flex-wrap items-end gap-2 rounded-xl border border-edge bg-cream p-3">
            <input type="hidden" name="id" value={tech.id} />
            <input type="hidden" name="internal" value={tech.isInternal ? "0" : "1"} />
            <div>
              <label className="block text-xs text-ink-faint">Type yes to confirm</label>
              <input
                name="confirm"
                placeholder="type yes"
                className="mt-1 w-28 rounded-lg border border-edge bg-surface px-2 py-1.5 text-sm"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                autoComplete="off"
                />
            </div>
            <button type="submit" className="rounded-lg border border-edge px-3 py-2 text-sm font-medium">
              {tech.isInternal ? "Unmark internal" : "Mark as internal"}
            </button>
          </form>
          <form action={setAtRiskManualAction} className="flex flex-wrap items-end gap-2 rounded-xl border border-edge bg-cream p-3">
            <input type="hidden" name="id" value={tech.id} />
            <input type="hidden" name="on" value={tech.atRiskManual ? "0" : "1"} />
            <div>
              <label className="block text-xs text-ink-faint">Type yes to confirm</label>
              <input
                name="confirm"
                placeholder="type yes"
                className="mt-1 w-28 rounded-lg border border-edge bg-surface px-2 py-1.5 text-sm"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                autoComplete="off"
                />
            </div>
            <button type="submit" className="rounded-lg border border-edge px-3 py-2 text-sm font-medium">
              {tech.atRiskManual ? "Clear manual at-risk" : "Flag at-risk manually"}
            </button>
          </form>
          <form action={setOwnerTagsAction} className="flex flex-wrap items-end gap-2 rounded-xl border border-edge bg-cream p-3">
            <input type="hidden" name="id" value={tech.id} />
            <div className="min-w-[200px] flex-1">
              <label className="block text-xs text-ink-faint">Owner tags (comma-separated; use migration for import queue)</label>
              <input
                name="tags"
                defaultValue={(tech.ownerTags ?? []).join(", ")}
                className="mt-1 w-full rounded-lg border border-edge bg-surface px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-ink-faint">Type yes</label>
              <input
                name="confirm"
                placeholder="type yes"
                className="mt-1 w-28 rounded-lg border border-edge bg-surface px-2 py-1.5 text-sm"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                autoComplete="off"
                />
            </div>
            <button type="submit" className="rounded-lg border border-edge px-3 py-2 text-sm font-medium">
              Save tags
            </button>
          </form>
          <Link
            href={`/dashboard/admin/support-import?tech=${encodeURIComponent(tech.id)}`}
            className="inline-flex rounded-xl border border-edge px-3 py-2 text-sm font-medium hover:border-brand-400/40"
          >
            Support-assisted setup / import
          </Link>
        </CardContent>
      </Card>

      {canModerate && !isSelf ? (
        <Card className="border-red-500/40">
          <CardHeader>
            <CardTitle>Block or delete</CardTitle>
            <CardDescription>
              Exclusive to {admin.email}. Blocking stops login and public bookings. Delete is permanent
              (Stripe subscription cancelled, auth users removed, salon data wiped).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isBlocked ? (
              <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
                <p className="font-medium text-warning-text">Blocked</p>
                <p className="mt-1 text-ink-soft">
                  Since {tech.blockedAt ? fmtDateTime(tech.blockedAt, PLATFORM_TZ) : "—"}
                  {tech.blockedByEmail ? ` by ${tech.blockedByEmail}` : ""}.
                </p>
                <p className="mt-1 text-ink-soft">Reason: {tech.blockedReason || "—"}</p>
                <div className="mt-3">
                  <ActionForm
                    action={ownerUnblockAccountAction}
                    id={tech.id}
                    label="Unblock account"
                  />
                </div>
              </div>
            ) : (
              <form
                action={ownerBlockAccountAction}
                className="space-y-3 rounded-xl border border-edge bg-cream p-3"
              >
                <input type="hidden" name="id" value={tech.id} />
                <div>
                  <label className="block text-xs text-ink-faint">Reason (required)</label>
                  <input
                    name="reason"
                    required
                    placeholder="e.g. T&Cs breach — spam bookings"
                    className="mt-1 w-full rounded-lg border border-edge bg-surface px-2 py-1.5 text-sm"
                    autoComplete="off"
                    />
                </div>
                <div className="flex flex-wrap items-end gap-2">
                  <div>
                    <label className="block text-xs text-ink-faint">Type yes to confirm</label>
                    <input
                      name="confirm"
                      placeholder="type yes"
                      className="mt-1 w-28 rounded-lg border border-edge bg-surface px-2 py-1.5 text-sm"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      autoComplete="off"
                      />
                  </div>
                  <button
                    type="submit"
                    className="rounded-lg bg-amber-600 px-3 py-2 text-sm font-medium text-white"
                  >
                    Block account
                  </button>
                </div>
              </form>
            )}

            <form
              action={ownerDeleteAccountAction}
              className="space-y-3 rounded-xl border border-red-500/40 bg-danger-soft p-3"
            >
              <input type="hidden" name="id" value={tech.id} />
              <p className="text-sm font-medium text-danger-text">Permanently delete this account</p>
              <p className="text-xs text-ink-soft">
                Type the handle <strong>{tech.handle}</strong> to confirm. This cannot be undone.
              </p>
              <div>
                <label className="block text-xs text-ink-faint">Reason (optional)</label>
                <input
                  name="reason"
                  placeholder="Optional note for the audit log"
                  className="mt-1 w-full rounded-lg border border-edge bg-surface px-2 py-1.5 text-sm"
                  autoComplete="off"
                  />
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <div>
                  <label className="block text-xs text-ink-faint">Type handle to confirm</label>
                  <input
                    name="confirm"
                    placeholder={tech.handle}
                    className="mt-1 w-40 rounded-lg border border-edge bg-surface px-2 py-1.5 text-sm"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    autoComplete="off"
                    />
                </div>
                <button
                  type="submit"
                  className="rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white"
                >
                  Delete forever
                </button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

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
                  <span>{money(s.pricePennies, salonCurrency(tech))}</span>
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
                      {fmtDateTime(b.startIso, salonTz(tech))} · {b.status}
                    </span>
                    <span>{money(b.pricePennies, salonCurrency(tech))}</span>
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
                      {p.kind} · {p.status} · {fmtDate(p.createdAt, PLATFORM_TZ)}
                    </span>
                    <span>{money(p.amountPennies, salonCurrency(tech))}</span>
                  </div>
                ),
              )
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Email sends (last 30 days)</CardTitle>
          <CardDescription>
            Per-account outbound volume. Full breakdown on{" "}
            <Link href="/dashboard/admin/deliverability" className="underline-offset-2 hover:underline">
              Deliverability
            </Link>
            .
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {detail.outbound30d.length === 0 ? (
            <p className="text-ink-faint">No sends in the last 30 days.</p>
          ) : (
            detail.outbound30d.map(
              (s: {
                id: string;
                kind: string;
                destination: string;
                deliveryStatus: string | null;
                ok: boolean;
                createdAt: string;
              }) => (
                <div key={s.id} className="rounded-lg border border-edge px-3 py-2">
                  <span className="font-medium">{s.kind}</span>
                  <span className="text-ink-faint">
                    {" "}
                    · {s.destination} · {s.deliveryStatus || (s.ok ? "sent" : "failed")} ·{" "}
                    {fmtDateTime(s.createdAt, PLATFORM_TZ)}
                  </span>
                </div>
              ),
            )
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Subscription</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-ink-soft space-y-1">
          <p>Status: {tech.subscriptionStatus}</p>
          <p>Plan: {tech.plan ?? "—"}</p>
          <p>Period end: {tech.currentPeriodEnd ? fmtDate(tech.currentPeriodEnd, PLATFORM_TZ) : "—"}</p>
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
                    · {a.actor} · {fmtDateTime(a.createdAt, PLATFORM_TZ)}
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
          placeholder="type yes"
          className="mt-1 w-28 rounded-lg border border-edge bg-surface px-2 py-1.5 text-sm"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          autoComplete="off"
          />
      </div>
      <button type="submit" className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white">
        {label}
      </button>
    </form>
  );
}
