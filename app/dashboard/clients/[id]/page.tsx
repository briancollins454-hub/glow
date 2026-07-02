import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ShieldAlert, ShieldCheck, Plus, ImagePlus, Trash2 } from "lucide-react";
import { getDashboardContext } from "@/lib/auth/session";
import {
  bookingsForClient,
  formResponsesForClient,
  getClient,
  listCategories,
  listClientPhotos,
  listServices,
  patchTestsForClient,
} from "@/lib/db/queries";
import { signedPhotoUrl } from "@/lib/storage";
import { uploadPhotoAction, deletePhotoAction } from "../../actions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { gbp, fmtDate } from "@/lib/format";
import { statusBadge } from "@/components/dashboard/status";
import { updateClientAction, addPatchTestAction } from "../../actions";

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const c = await getDashboardContext();
  if (!c) redirect("/login");
  const { sb, tech } = c;
  const { id } = await params;
  const client = await getClient(sb, id);
  if (!client || client.techId !== tech.id) notFound();

  const [history, tests, categories, services, photos, responses] = await Promise.all([
    bookingsForClient(sb, tech.id, client.id),
    patchTestsForClient(sb, tech.id, client.id),
    listCategories(sb, tech.id),
    listServices(sb, tech.id),
    listClientPhotos(sb, client.id),
    formResponsesForClient(sb, client.id),
  ]);
  const latestResponse = responses[0];
  const photoItems = await Promise.all(
    photos.map(async (p) => ({ p, url: await signedPhotoUrl(p.path) })),
  );
  const serviceById = new Map(services.map((s) => [s.id, s.name]));
  const catById = new Map(categories.map((c) => [c.id, c.name]));
  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <Link href="/dashboard/clients" className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-soft hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> All clients
      </Link>

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-2xl font-semibold">{client.name}</h1>
        {client.isBlacklisted && <Badge tone="red"><ShieldAlert className="h-3 w-3" /> Blacklisted</Badge>}
        {client.noShowCount > 0 && <Badge tone="amber">{client.noShowCount} no-show{client.noShowCount > 1 ? "s" : ""}</Badge>}
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
              <div><Label>Name</Label><Input name="name" defaultValue={client.name} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Email</Label><Input name="email" type="email" defaultValue={client.email} /></div>
                <div><Label>Phone</Label><Input name="phone" defaultValue={client.phone} /></div>
              </div>
              <div><Label>Notes</Label><Textarea name="notes" defaultValue={client.notes} placeholder="Preferences, allergies, etc." /></div>
              <div><Label>Warning note (shown to you when booking)</Label><Textarea name="warningNote" defaultValue={client.warningNote} placeholder="e.g. Late twice — confirm by text." /></div>
              <label className="flex items-center gap-2.5 rounded-xl border border-black/5 bg-cream px-4 py-3 text-sm">
                <input type="checkbox" name="isBlacklisted" defaultChecked={client.isBlacklisted} className="h-4 w-4 rounded border-black/20 text-red-600 focus:ring-red-300" />
                Blacklist this client (blocks online booking)
              </label>
              <div className="flex justify-end"><Button type="submit">Save client</Button></div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-amber-500" /> Patch tests</CardTitle>
            <CardDescription>Required for lash, brow and tint services.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {tests.length === 0 ? (
              <p className="text-sm text-ink-faint">No patch tests on file.</p>
            ) : (
              <ul className="space-y-2">
                {tests.map((t) => {
                  const expired = new Date(t.expiresAtIso).getTime() < Date.now();
                  return (
                    <li key={t.id} className="flex items-center justify-between rounded-xl border border-black/5 bg-cream px-4 py-2.5 text-sm">
                      <div>
                        <p className="font-medium">{catById.get(t.categoryId) ?? "Category"}</p>
                        <p className="text-xs text-ink-faint">Done {fmtDate(t.performedAtIso)} · expires {fmtDate(t.expiresAtIso)}</p>
                      </div>
                      {t.result === "fail" ? <Badge tone="red">Failed</Badge> : expired ? <Badge tone="neutral">Expired</Badge> : <Badge tone="green">Valid</Badge>}
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
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </Select>
                </div>
                <div><Label>Date performed</Label><Input name="performedAt" type="date" defaultValue={todayStr} required /></div>
                <div>
                  <Label>Result</Label>
                  <Select name="result" defaultValue="pass">
                    <option value="pass">Pass</option>
                    <option value="pending">Pending</option>
                    <option value="fail">Fail</option>
                  </Select>
                </div>
                <div className="sm:col-span-2"><Button type="submit" variant="secondary" size="sm"><Plus className="h-4 w-4" /> Record patch test</Button></div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>

      {latestResponse && latestResponse.answers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Consultation answers</CardTitle>
            <CardDescription>From {fmtDate(latestResponse.createdAt)}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {latestResponse.answers.map((a, i) => (
              <div key={i} className="rounded-xl border border-black/5 bg-cream px-4 py-2.5 text-sm">
                <p className="text-ink-faint">{a.prompt}</p>
                <p className="font-medium">{a.answer}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ImagePlus className="h-5 w-5 text-brand-600" /> Before &amp; after photos</CardTitle>
          <CardDescription>Only upload with the client&apos;s consent.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {photoItems.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {photoItems.map(({ p, url }) => (
                <div key={p.id} className="group relative overflow-hidden rounded-xl border border-black/5 bg-cream">
                  {url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={url} alt={p.kind} className="aspect-square w-full object-cover" />
                  ) : (
                    <div className="grid aspect-square w-full place-items-center text-xs text-ink-faint">Unavailable</div>
                  )}
                  <span className="absolute left-1.5 top-1.5 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-medium capitalize text-white">{p.kind}</span>
                  <form action={deletePhotoAction} className="absolute right-1.5 top-1.5">
                    <input type="hidden" name="id" value={p.id} />
                    <input type="hidden" name="clientId" value={client.id} />
                    <button type="submit" className="grid h-7 w-7 place-items-center rounded-md bg-black/60 text-white opacity-0 transition group-hover:opacity-100" title="Delete"><Trash2 className="h-3.5 w-3.5" /></button>
                  </form>
                </div>
              ))}
            </div>
          )}
          <form action={uploadPhotoAction} className="grid gap-3 border-t border-black/5 pt-4 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end">
            <input type="hidden" name="clientId" value={client.id} />
            <div>
              <Label>Photo</Label>
              <input type="file" name="photo" accept="image/*" required className="input h-auto py-2 text-sm" />
            </div>
            <div>
              <Label>Type</Label>
              <Select name="kind" defaultValue="before">
                <option value="before">Before</option>
                <option value="after">After</option>
                <option value="other">Other</option>
              </Select>
            </div>
            <label className="flex items-center gap-2 pb-2.5 text-sm">
              <input type="checkbox" name="consent" className="h-4 w-4 rounded border-black/20 text-brand-600 focus:ring-brand-300" /> Consent
            </label>
            <Button type="submit" variant="secondary" size="sm"><ImagePlus className="h-4 w-4" /> Upload</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Booking history ({history.length})</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {history.length === 0 && <p className="py-3 text-center text-sm text-ink-faint">No bookings yet.</p>}
          {[...history].reverse().map((b) => (
            <div key={b.id} className="flex items-center justify-between rounded-xl border border-black/5 bg-cream px-4 py-2.5 text-sm">
              <div>
                <p className="font-medium">{serviceById.get(b.serviceId) ?? "Service"}</p>
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
