import { redirect } from "next/navigation";
import { Star, Trash2, Eye, EyeOff } from "lucide-react";
import { getDashboardContext } from "@/lib/auth/session";
import { listClients, listReviewsForTech } from "@/lib/db/queries";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fmtDate } from "@/lib/format";
import { deleteReviewAction, setReviewStatusAction } from "../actions";

export default async function ReviewsPage() {
  const c = await getDashboardContext();
  if (!c) redirect("/login");
  const { sb, tech } = c;
  const [reviews, clients] = await Promise.all([
    listReviewsForTech(sb, tech.id),
    listClients(sb, tech.id),
  ]);
  const clientById = new Map(clients.map((cl) => [cl.id, cl.name]));
  const approved = reviews.filter((r) => r.status === "approved");
  const avg = approved.length
    ? (approved.reduce((s, r) => s + r.rating, 0) / approved.length).toFixed(1)
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Reviews</h1>
        <p className="text-sm text-ink-soft">
          Approve the ones you want on your booking page. Clients are asked automatically after each appointment.
        </p>
      </div>

      {avg && (
        <div className="flex items-center gap-2 rounded-xl bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
          Showing on your page: {avg} average from {approved.length} review{approved.length > 1 ? "s" : ""}.
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>All reviews ({reviews.length})</CardTitle>
          <CardDescription>New reviews arrive as &ldquo;Waiting&rdquo; and stay private until you approve them.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {reviews.length === 0 && (
            <p className="py-6 text-center text-sm text-ink-faint">
              No reviews yet. They&apos;ll appear here after you mark appointments completed.
            </p>
          )}
          {reviews.map((r) => (
            <div key={r.id} className="rounded-xl border border-edge bg-cream p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star key={n} className={`h-4 w-4 ${n <= r.rating ? "fill-amber-400 text-amber-400" : "text-ink-faint"}`} />
                  ))}
                </span>
                <p className="font-medium">{clientById.get(r.clientId) ?? "Client"}</p>
                <span className="text-xs text-ink-faint">{fmtDate(r.createdAt)}</span>
                {r.status === "approved" && <Badge tone="green">On your page</Badge>}
                {r.status === "pending" && <Badge tone="amber">Waiting</Badge>}
                {r.status === "hidden" && <Badge tone="neutral">Hidden</Badge>}
              </div>
              {r.comment && <p className="mt-2 text-sm text-ink-soft">&ldquo;{r.comment}&rdquo;</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                {r.status !== "approved" && (
                  <form action={setReviewStatusAction}>
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="status" value="approved" />
                    <button type="submit" className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/15 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/25">
                      <Eye className="h-3.5 w-3.5" /> Show on my page
                    </button>
                  </form>
                )}
                {r.status === "approved" && (
                  <form action={setReviewStatusAction}>
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="status" value="hidden" />
                    <button type="submit" className="inline-flex items-center gap-1.5 rounded-lg bg-white/[0.06] px-3 py-1.5 text-xs font-medium text-ink-soft hover:bg-white/[0.1]">
                      <EyeOff className="h-3.5 w-3.5" /> Hide
                    </button>
                  </form>
                )}
                <form action={deleteReviewAction}>
                  <input type="hidden" name="id" value={r.id} />
                  <button type="submit" className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-ink-faint hover:bg-red-500/10 hover:text-red-400">
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </button>
                </form>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
