import Link from "next/link";
import { requireOwner } from "@/lib/owner/require-owner";
import { supabaseService } from "@/lib/supabase/service";
import { OwnerNav } from "@/components/owner/owner-nav";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { ownerCompleteClosureAction, ownerFeedbackStatusAction } from "../owner-actions";

export const dynamic = "force-dynamic";

export default async function OwnerSupportPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; err?: string }>;
}) {
  await requireOwner();
  const sp = await searchParams;
  const sb = supabaseService();

  const [{ data: closures }, feedbackRes, inboundRes, techsRes] = await Promise.all([
    sb
      .from("account_closure_requests")
      .select("*")
      .eq("status", "requested")
      .order("requestedAt", { ascending: false }),
    sb
      .from("feedback_submissions")
      .select("*")
      .order("createdAt", { ascending: false })
      .limit(50),
    sb
      .from("inbound_forwards")
      .select("*")
      .order("createdAt", { ascending: false })
      .limit(30),
    sb.from("techs").select("id, businessName, handle, email"),
  ]);

  const techById = Object.fromEntries(
    (techsRes.data ?? []).map((t) => [t.id, t]),
  );
  const feedback = feedbackRes.error ? [] : feedbackRes.data ?? [];
  const inbound = inboundRes.error ? [] : inboundRes.data ?? [];
  const inboundOk24 = inbound.filter(
    (r) => r.ok && new Date(r.createdAt).getTime() > Date.now() - 86400000,
  ).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Support and content</h1>
        <p className="text-sm text-ink-soft">Closures, feedback ideas, and inbound support forwarding.</p>
      </div>
      <OwnerNav />

      {sp.ok ? (
        <p className="rounded-xl bg-success-soft px-4 py-3 text-sm text-success-text">Saved ({sp.ok}).</p>
      ) : null}
      {sp.err === "confirm" ? (
        <p className="rounded-xl bg-amber-500/15 px-4 py-3 text-sm text-warning-text">
          Type <strong>yes</strong> to confirm.
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Inbound support forwarding</CardTitle>
          <CardDescription>
            Resend inbound → SUPPORT_FORWARD_TO. Recent successful forwards in the last 24h: {inboundOk24}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm max-h-64 overflow-y-auto">
          {inbound.length === 0 ? (
            <p className="text-ink-faint">
              No forwards logged yet. Apply migration 0044; new inbound mail will appear here.
            </p>
          ) : (
            inbound.map((row) => (
              <div key={row.id} className="flex justify-between gap-2 rounded-lg border border-edge px-3 py-2">
                <div>
                  <p className="font-medium">{row.subject ?? "(no subject)"}</p>
                  <p className="text-xs text-ink-faint">
                    {row.fromAddress} · {fmtDateTime(row.createdAt)}
                  </p>
                </div>
                <Badge tone={row.ok ? "green" : "red"}>{row.ok ? "ok" : "fail"}</Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Account closure requests</CardTitle>
          <CardDescription>Export data before deleting anything. Mark completed when processed.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {(closures ?? []).length === 0 ? (
            <p className="text-sm text-ink-faint">None pending.</p>
          ) : (
            (closures ?? []).map((r) => {
              const t = techById[r.techId];
              return (
                <div key={r.id} className="rounded-xl border border-edge p-3 text-sm">
                  <p className="font-medium">
                    {t?.businessName ?? r.techId}{" "}
                    <span className="text-ink-faint">· {t?.email}</span>
                  </p>
                  <p className="text-xs text-ink-faint">
                    Requested {fmtDate(r.requestedAt)}
                    {r.reason ? ` · "${r.reason}"` : ""}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {t ? (
                      <Link
                        href={`/dashboard/admin/accounts/${t.id}`}
                        className="rounded-lg border border-edge px-3 py-1.5 text-xs font-medium"
                      >
                        Open account
                      </Link>
                    ) : null}
                    <form action={ownerCompleteClosureAction} className="flex items-end gap-2">
                      <input type="hidden" name="id" value={r.id} />
                      <input
                        name="confirm"
                        placeholder="type yes"
                        className="w-24 rounded-lg border border-edge px-2 py-1 text-xs"
                      />
                      <button type="submit" className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white">
                        Mark completed
                      </button>
                    </form>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Share an idea / feedback</CardTitle>
          <CardDescription>Stored when migration 0044 is applied; still emailed to the ops inbox.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {feedback.length === 0 ? (
            <p className="text-sm text-ink-faint">No submissions stored yet.</p>
          ) : (
            feedback.map((f) => {
              const t = techById[f.techId];
              return (
                <div key={f.id} className="rounded-xl border border-edge p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="neutral">{f.topic}</Badge>
                    <Badge
                      tone={f.status === "done" ? "green" : f.status === "reviewing" ? "amber" : "brand"}
                    >
                      {f.status}
                    </Badge>
                    <span className="text-xs text-ink-faint">{fmtDateTime(f.createdAt)}</span>
                  </div>
                  <p className="mt-1 font-medium">
                    {t?.businessName ?? f.techId} · {t?.email}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-ink-soft">{f.message}</p>
                  <form action={ownerFeedbackStatusAction} className="mt-2 flex flex-wrap gap-2">
                    <input type="hidden" name="id" value={f.id} />
                    <button name="status" value="new" className="rounded-lg border border-edge px-2 py-1 text-xs">
                      New
                    </button>
                    <button name="status" value="reviewing" className="rounded-lg border border-edge px-2 py-1 text-xs">
                      Reviewing
                    </button>
                    <button name="status" value="done" className="rounded-lg border border-edge px-2 py-1 text-xs">
                      Done
                    </button>
                  </form>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
