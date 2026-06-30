import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, ShieldAlert, AlertTriangle, ChevronRight } from "lucide-react";
import { getCurrentTech } from "@/lib/auth/session";
import { bookingsForClient, listClients } from "@/lib/db/repo";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { addClientAction } from "../actions";

export default async function ClientsPage() {
  const tech = await getCurrentTech();
  if (!tech) redirect("/login");
  const clients = listClients(tech.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Clients</h1>
        <p className="text-sm text-ink-soft">
          Notes, warnings and your blacklist live here.
        </p>
      </div>

      <details className="card">
        <summary className="flex cursor-pointer list-none items-center gap-2 p-4 font-medium text-brand-700">
          <Plus className="h-4 w-4" /> Add a client
        </summary>
        <div className="border-t border-black/5 p-5">
          <form action={addClientAction} className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Name</Label>
              <Input name="name" required />
            </div>
            <div>
              <Label>Email</Label>
              <Input name="email" type="email" />
            </div>
            <div>
              <Label>Phone</Label>
              <Input name="phone" />
            </div>
            <div>
              <Label>Notes</Label>
              <Input name="notes" />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" variant="secondary">
                Add client
              </Button>
            </div>
          </form>
        </div>
      </details>

      <Card>
        <CardHeader>
          <CardTitle>All clients ({clients.length})</CardTitle>
          <CardDescription>Tap a client to view their history and patch tests.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {clients.length === 0 && (
            <p className="py-4 text-center text-sm text-ink-faint">No clients yet.</p>
          )}
          {clients.map((c) => {
            const visits = bookingsForClient(tech.id, c.id).filter(
              (b) => b.status === "completed",
            ).length;
            return (
              <Link
                key={c.id}
                href={`/dashboard/clients/${c.id}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-black/5 bg-cream px-4 py-3 transition hover:shadow-card"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{c.name}</span>
                    {c.isBlacklisted && (
                      <Badge tone="red">
                        <ShieldAlert className="h-3 w-3" /> Blacklisted
                      </Badge>
                    )}
                    {!c.isBlacklisted && c.warningNote && (
                      <Badge tone="amber">
                        <AlertTriangle className="h-3 w-3" /> Warning
                      </Badge>
                    )}
                    {c.noShowCount > 0 && (
                      <Badge tone="neutral">{c.noShowCount} no-show{c.noShowCount > 1 ? "s" : ""}</Badge>
                    )}
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
