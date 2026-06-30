import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ShieldAlert, ShieldCheck, Plus } from "lucide-react";
import { getCurrentTech } from "@/lib/auth/session";
import {
  bookingsForClient,
  getClient,
  getService,
  listCategories,
  patchTestsForClient,
} from "@/lib/db/repo";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { gbp, fmtDate } from "@/lib/format";
import { statusBadge } from "@/components/dashboard/status";
import {
  updateClientAction,
  addPatchTestAction,
} from "../../actions";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const tech = await getCurrentTech();
  if (!tech) redirect("/login");
  const { id } = await params;
  const client = getClient(id);
  if (!client || client.techId !== tech.id) notFound();

  const history = bookingsForClient(tech.id, client.id).reverse();
  const tests = patchTestsForClient(tech.id, client.id);
  const categories = listCategories(tech.id);
  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/clients"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-soft hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" /> All clients
      </Link>

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-2xl font-semibold">{client.name}</h1>
        {client.isBlacklisted && (
          <Badge tone="red">
            <ShieldAlert className="h-3 w-3" /> Blacklisted
          </Badge>
        )}
        {client.noShowCount > 0 && (
          <Badge tone="amber">{client.noShowCount} no-show{client.noShowCount > 1 ? "s" : ""}</Badge>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Client details</CardTitle>
            <CardDescription>Warning notes and blacklist are private to you.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={updateClientAction} className="space-y-3">
              <input type="hidden" name="id" value={client.id} />
              <div>
                <Label>Name</Label>
                <Input name="name" defaultValue={client.name} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Email</Label>
                  <Input name="email" type="email" defaultValue={client.email} />
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input name="phone" defaultValue={client.phone} />
                </div>
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea name="notes" defaultValue={client.notes} placeholder="Preferences, allergies, etc." />
              </div>
              <div>
                <Label>Warning note (shown to you when booking)</Label>
                <Textarea name="warningNote" defaultValue={client.warningNote} placeholder="e.g. Late twice — confirm by text." />
              </div>
              <label className="flex items-center gap-2.5 rounded-xl border border-black/5 bg-cream px-4 py-3 text-sm">
                <input
                  type="checkbox"
                  name="isBlacklisted"
                  defaultChecked={client.isBlacklisted}
                  className="h-4 w-4 rounded border-black/20 text-red-600 focus:ring-red-300"
                />
                Blacklist this client (blocks online booking)
              </label>
              <div className="flex justify-end">
                <Button type="submit">Save client</Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-amber-500" /> Patch tests
              </CardTitle>
              <CardDescription>Required for lash, brow and tint services.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {tests.length === 0 ? (
                <p className="text-sm text-ink-faint">No patch tests on file.</p>
              ) : (
                <ul className="space-y-2">
                  {tests.map((t) => {
                    const cat = categories.find((c) => c.id === t.categoryId);
                    const expired = new Date(t.expiresAtIso).getTime() < Date.now();
                    return (
                      <li
                        key={t.id}
                        className="flex items-center justify-between rounded-xl border border-black/5 bg-cream px-4 py-2.5 text-sm"
                      >
                        <div>
                          <p className="font-medium">{cat?.name ?? "Category"}</p>
                          <p className="text-xs text-ink-faint">
                            Done {fmtDate(t.performedAtIso)} · expires {fmtDate(t.expiresAtIso)}
                          </p>
                        </div>
                        {t.result === "fail" ? (
                          <Badge tone="red">Failed</Badge>
                        ) : expired ? (
                          <Badge tone="neutral">Expired</Badge>
                        ) : (
                          <Badge tone="green">Valid</Badge>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}

              {categories.length > 0 && (
                <form action={addPatchTestAction} className="grid gap-2 border-t border-black/5 pt-3 sm:grid-cols-2">
                  <input type="hidden" name="clientId" value={client.id} />
                  <div className="sm:col-span-2">
                    <Label>Category</Label>
                    <Select name="categoryId" required defaultValue="">
                      <option value="" disabled>Choose</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <Label>Date performed</Label>
                    <Input name="performedAt" type="date" defaultValue={todayStr} required />
                  </div>
                  <div>
                    <Label>Result</Label>
                    <Select name="result" defaultValue="pass">
                      <option value="pass">Pass</option>
                      <option value="pending">Pending</option>
                      <option value="fail">Fail</option>
                    </Select>
                  </div>
                  <div className="sm:col-span-2">
                    <Button type="submit" variant="secondary" size="sm">
                      <Plus className="h-4 w-4" /> Record patch test
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Booking history ({history.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {history.length === 0 && (
            <p className="py-3 text-center text-sm text-ink-faint">No bookings yet.</p>
          )}
          {history.map((b) => (
            <div
              key={b.id}
              className="flex items-center justify-between rounded-xl border border-black/5 bg-cream px-4 py-2.5 text-sm"
            >
              <div>
                <p className="font-medium">{getService(b.serviceId)?.name ?? "Service"}</p>
                <p className="text-xs text-ink-faint">{fmtDate(b.startIso)}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">{gbp(b.pricePennies)}</span>
                {statusBadge(b.status)}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
