import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, ShieldAlert, AlertTriangle, ChevronRight, Upload, CheckCircle2 } from "lucide-react";
import { getDashboardContext } from "@/lib/auth/session";
import { listClients, completedVisitCounts } from "@/lib/db/queries";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { addClientAction } from "../actions";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ import?: string; n?: string; s?: string }>;
}) {
  const c = await getDashboardContext();
  if (!c) redirect("/login");
  const { sb, tech } = c;
  const sp = await searchParams;
  const [clients, visitsByClient] = await Promise.all([
    listClients(sb, tech.id),
    completedVisitCounts(sb, tech.id),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Clients</h1>
        <p className="text-sm text-ink-soft">Notes, warnings and blocked clients live here.</p>
      </div>

      {sp.import === "done" && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          <CheckCircle2 className="h-4 w-4" /> Imported {sp.n} client{sp.n === "1" ? "" : "s"}
          {Number(sp.s) > 0 && ` (${sp.s} skipped: duplicates or missing names)`}.
        </div>
      )}
      {sp.import === "badformat" && (
        <div className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-300">
          Couldn&apos;t find name columns in that file. Export your client list as CSV and try again.
        </div>
      )}
      {sp.import === "empty" && (
        <div className="rounded-xl bg-amber-500/10 px-4 py-3 text-sm text-amber-300">That file looks empty.</div>
      )}

      <Link href="/dashboard/import" className="card flex items-center justify-between gap-3 p-4 transition hover:shadow-card">
        <span className="flex items-center gap-2 font-medium text-brand-300">
          <Upload className="h-4 w-4" /> Moving from Square, Booksy, Timely or Fresha?
        </span>
        <span className="text-sm text-ink-faint">Import services, clients &amp; appointments →</span>
      </Link>

      <details className="card">
        <summary className="flex cursor-pointer list-none items-center gap-2 p-4 font-medium text-brand-300">
          <Plus className="h-4 w-4" /> Add a client
        </summary>
        <div className="border-t border-edge p-5">
          <form action={addClientAction} className="grid gap-3 sm:grid-cols-2">
            <div><Label>Name</Label><Input name="name" required /></div>
            <div><Label>Email</Label><Input name="email" type="email" /></div>
            <div><Label>Phone</Label><Input name="phone" /></div>
            <div><Label>Notes</Label><Input name="notes" /></div>
            <div className="sm:col-span-2"><Button type="submit" variant="secondary">Add client</Button></div>
          </form>
        </div>
      </details>

      <Card>
        <CardHeader>
          <CardTitle>All clients ({clients.length})</CardTitle>
          <CardDescription>Tap a client to view their history and patch tests.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {clients.length === 0 && <p className="py-4 text-center text-sm text-ink-faint">No clients yet.</p>}
          {clients.map((c) => {
            const visits = visitsByClient.get(c.id) ?? 0;
            return (
              <Link key={c.id} href={`/dashboard/clients/${c.id}`} className="flex items-center justify-between gap-3 rounded-xl border border-edge bg-cream px-4 py-3 transition hover:shadow-card">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{c.name}</span>
                    {c.isVip && <Badge tone="purple">VIP</Badge>}
                    {c.isBlacklisted && <Badge tone="red"><ShieldAlert className="h-3 w-3" /> Blocked</Badge>}
                    {!c.isBlacklisted && c.warningNote && <Badge tone="amber"><AlertTriangle className="h-3 w-3" /> Warning</Badge>}
                    {c.noShowCount > 0 && <Badge tone="neutral">{c.noShowCount} no-show{c.noShowCount > 1 ? "s" : ""}</Badge>}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-ink-faint">
                    {[c.email, c.phone].filter(Boolean).join(" · ") || "No contact details"}
                    {visits > 0 && ` · ${visits} visit${visits > 1 ? "s" : ""}`}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-ink-faint" />
              </Link>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
