import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ShieldAlert, ShieldCheck, Plus, ImagePlus, Trash2, MessageSquare, FileDown } from "lucide-react";
import { getDashboardContext } from "@/lib/auth/session";
import {
  bookingsForClient,
  formResponsesForClient,
  getClient,
  listCategories,
  listClientPhotos,
  listClientReactions,
  listProductBatches,
  listProducts,
  listServices,
  patchTestsForClient,
} from "@/lib/db/queries";
import { signedPhotoUrls } from "@/lib/storage";
import { RemoteImage } from "@/components/ui/remote-image";
import { ImageFileInput } from "@/components/ui/image-file-input";
import { isLive } from "@/lib/subscriptions";
import { uploadPhotoAction, deletePhotoAction } from "../../actions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { gbp, fmtDate } from "@/lib/format";
import { statusBadge } from "@/components/dashboard/status";
import { ClientMessageLink } from "@/components/messages/client-message-link";
import { ClientReactionsCard } from "@/components/dashboard/client-reactions-card";
import {
  updateClientAction,
  addPatchTestAction,
  deletePatchTestAction,
  deleteClientAction,
  deleteFormResponseAction,
} from "../../actions";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://glow-uk.com";

export default async function ClientDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ photoerr?: string }>;
}) {
  const c = await getDashboardContext();
  if (!c) redirect("/login");
  const { sb, tech } = c;
  const { id } = await params;
  const { photoerr } = await searchParams;
  const client = await getClient(sb, id);
  if (!client || client.techId !== tech.id) notFound();

  const [history, tests, categories, services, photos, responses, reactions, products, batches] =
    await Promise.all([
    bookingsForClient(sb, tech.id, client.id),
    patchTestsForClient(sb, tech.id, client.id),
    listCategories(sb, tech.id),
    listServices(sb, tech.id),
    listClientPhotos(sb, client.id),
    formResponsesForClient(sb, client.id),
    listClientReactions(sb, tech.id, client.id),
    listProducts(sb, tech.id),
    listProductBatches(sb, tech.id),
  ]);
  const latestResponse = responses[0];
  const signed = await signedPhotoUrls(photos.map((p) => p.path));
  const photoItems = photos.map((p) => ({ p, url: signed.get(p.path) ?? null }));
  const serviceById = new Map(services.map((s) => [s.id, s.name]));
  const catById = new Map(categories.map((c) => [c.id, c.name]));
  const productById = new Map(products.map((p) => [p.id, p]));
  const activeBatches = batches.filter((b) => !b.retiredAtIso);
  const batchOptions = activeBatches
    .map((batch) => {
      const product = productById.get(batch.productId);
      if (!product) return null;
      const lot = batch.lotNumber ? ` · Lot ${batch.lotNumber}` : "";
      return {
        batch,
        product,
        label: `${product.name}${product.brand ? ` (${product.brand})` : ""}${lot}`,
      };
    })
    .filter((o): o is NonNullable<typeof o> => o != null);
  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <Link href="/dashboard/clients" className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-soft hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> All clients
      </Link>

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-2xl font-semibold">{client.name}</h1>
        {client.isVip && <Badge tone="purple">VIP</Badge>}
        {client.isBlacklisted && <Badge tone="red"><ShieldAlert className="h-3 w-3" /> Blocked</Badge>}
        {client.noShowCount > 0 && <Badge tone="amber">{client.noShowCount} no-show{client.noShowCount > 1 ? "s" : ""}</Badge>}
        <a
          href={`/api/clients/${client.id}/evidence-pack`}
          className="ml-auto inline-flex items-center gap-1.5 rounded-xl border border-edge bg-cream px-3 py-2 text-sm font-medium text-ink-soft transition hover:text-ink"
        >
          <FileDown className="h-4 w-4" /> Evidence pack
        </a>
        {isLive(tech) && (
          <Link
            href={`/dashboard/messages/${client.id}`}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-3 py-2 text-sm font-medium text-on-brand transition hover:bg-brand-700"
          >
            <MessageSquare className="h-4 w-4" /> Message
          </Link>
        )}
      </div>

      {isLive(tech) && (
        <ClientMessageLink url={`${APP_URL}/m/${client.messageToken}`} />
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Client details</CardTitle>
            <CardDescription>Warning notes and blocks are private to you.</CardDescription>
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
              <div><Label>Warning note (shown to you when booking)</Label><Textarea name="warningNote" defaultValue={client.warningNote} placeholder="e.g. Late twice - confirm by text." /></div>
              <label className="flex items-center gap-2.5 rounded-xl border border-edge bg-cream px-4 py-3 text-sm">
                <input type="checkbox" name="isVip" defaultChecked={client.isVip} className="h-4 w-4 rounded border-edge text-brand-400 focus:ring-brand-300" />
                VIP - always gets your loyalty discount, from their very next booking
              </label>
              <label className="flex items-center gap-2.5 rounded-xl border border-edge bg-cream px-4 py-3 text-sm">
                <input type="checkbox" name="isBlacklisted" defaultChecked={client.isBlacklisted} className="h-4 w-4 rounded border-edge text-red-400 focus:ring-red-300" />
                Block this client from booking online
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
                    <li key={t.id} className="flex items-center justify-between gap-2 rounded-xl border border-edge bg-cream px-4 py-2.5 text-sm">
                      <div className="min-w-0">
                        <p className="font-medium">{catById.get(t.categoryId) ?? "Category"}</p>
                        <p className="text-xs text-ink-faint">Done {fmtDate(t.performedAtIso)} · expires {fmtDate(t.expiresAtIso)}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        {t.result === "fail" ? <Badge tone="red">Failed</Badge> : expired ? <Badge tone="neutral">Expired</Badge> : <Badge tone="green">Valid</Badge>}
                        <form action={deletePatchTestAction}>
                          <input type="hidden" name="id" value={t.id} />
                          <input type="hidden" name="clientId" value={client.id} />
                          <button type="submit" className="grid h-8 w-8 place-items-center rounded-lg text-ink-faint hover:bg-danger-soft hover:text-red-400" title="Delete patch test"><Trash2 className="h-3.5 w-3.5" /></button>
                        </form>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            {categories.length > 0 && (
              <form action={addPatchTestAction} className="grid gap-2 border-t border-edge pt-3 sm:grid-cols-2">
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
                {batchOptions.length > 0 && (
                  <div className="sm:col-span-2">
                    <Label>Product batch used (optional)</Label>
                    <Select name="batchId" defaultValue="">
                      <option value="">Not logged</option>
                      {batchOptions.map((o) => (
                        <option key={o.batch.id} value={o.batch.id}>{o.label}</option>
                      ))}
                    </Select>
                  </div>
                )}
                <div className="sm:col-span-2"><Button type="submit" variant="secondary" size="sm"><Plus className="h-4 w-4" /> Record patch test</Button></div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>

      <ClientReactionsCard
        clientId={client.id}
        categories={categories}
        reactions={reactions}
        batchOptions={batchOptions}
      />

      {latestResponse && latestResponse.answers.length > 0 && (
        <Card>
          <CardHeader className="flex-row items-start justify-between gap-3">
            <div>
              <CardTitle>Consultation answers</CardTitle>
              <CardDescription>From {fmtDate(latestResponse.createdAt)}</CardDescription>
            </div>
            <form action={deleteFormResponseAction}>
              <input type="hidden" name="id" value={latestResponse.id} />
              <input type="hidden" name="clientId" value={client.id} />
              <button type="submit" className="grid h-8 w-8 place-items-center rounded-lg text-ink-faint hover:bg-danger-soft hover:text-red-400" title="Delete these answers">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </form>
          </CardHeader>
          <CardContent className="space-y-3">
            {latestResponse.answers.map((a, i) => (
              <div key={i} className="rounded-xl border border-edge bg-cream px-4 py-2.5 text-sm">
                <p className="text-ink-faint">{a.prompt}</p>
                <p className="font-medium">{a.answer}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ImagePlus className="h-5 w-5 text-brand-400" /> Before &amp; after photos</CardTitle>
          <CardDescription>Only upload with the client&apos;s consent.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {photoerr && (
            <div className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger-text">
              {photoerr === "size"
                ? "That photo is too large. Please choose an image under 8MB."
                : "Photo upload failed. Use a JPG, PNG or WebP image and try again."}
            </div>
          )}
          {photoItems.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {photoItems.map(({ p, url }) => (
                <div key={p.id} className="group relative overflow-hidden rounded-xl border border-edge bg-cream">
                  {url ? (
                    <div className="relative aspect-square w-full">
                      <RemoteImage src={url} alt={p.kind} fill className="object-cover" sizes="200px" />
                    </div>
                  ) : (
                    <div className="grid aspect-square w-full place-items-center text-xs text-ink-faint">Unavailable</div>
                  )}
                  <span className="absolute left-1.5 top-1.5 rounded-md bg-overlay px-1.5 py-0.5 text-[10px] font-medium capitalize text-on-brand">{p.kind}</span>
                  <form action={deletePhotoAction} className="absolute right-1.5 top-1.5">
                    <input type="hidden" name="id" value={p.id} />
                    <input type="hidden" name="clientId" value={client.id} />
                    <button type="submit" className="grid h-7 w-7 place-items-center rounded-md bg-overlay text-on-brand opacity-0 transition group-hover:opacity-100" title="Delete"><Trash2 className="h-3.5 w-3.5" /></button>
                  </form>
                </div>
              ))}
            </div>
          )}
          <form action={uploadPhotoAction} className="grid gap-3 border-t border-edge pt-4 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end">
            <input type="hidden" name="clientId" value={client.id} />
            <div>
              <Label>Photo</Label>
              <ImageFileInput name="photo" required className="input h-auto py-2 text-sm" />
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
              <input type="checkbox" name="consent" className="h-4 w-4 rounded border-edge text-brand-400 focus:ring-brand-300" /> Consent
            </label>
            <Button type="submit" variant="secondary" size="sm"><ImagePlus className="h-4 w-4" /> Upload</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-red-400">Delete this client</CardTitle>
          <CardDescription>
            Removes {client.name} completely, including their bookings, photos, messages and patch tests.
            Useful for duplicates or test entries. This can&apos;t be undone.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={deleteClientAction}>
            <input type="hidden" name="id" value={client.id} />
            <Button type="submit" variant="danger">
              <Trash2 className="h-4 w-4" /> Delete client{history.length > 0 ? ` (and ${history.length} booking${history.length > 1 ? "s" : ""})` : ""}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Booking history ({history.length})</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {history.length === 0 && <p className="py-3 text-center text-sm text-ink-faint">No bookings yet.</p>}
          {[...history].reverse().map((b) => {
            const lash = [
              b.lashMap && `Map: ${b.lashMap}`,
              b.lashCurl && `Curl: ${b.lashCurl}`,
              b.lashLength && `Length: ${b.lashLength}`,
            ].filter(Boolean).join(" · ");
            const extras = (b.addons ?? []).map((a) => a.name).join(", ");
            return (
              <Link key={b.id} href={`/dashboard/bookings/${b.id}`} className="flex items-center justify-between gap-3 rounded-xl border border-edge bg-cream px-4 py-2.5 text-sm transition hover:shadow-card">
                <div className="min-w-0">
                  <p className="font-medium">{serviceById.get(b.serviceId) ?? "Service"}{extras && <span className="text-ink-faint"> + {extras}</span>}</p>
                  <p className="text-xs text-ink-faint">{fmtDate(b.startIso)}</p>
                  {lash && <p className="mt-0.5 text-xs text-brand-text">{lash}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-sm font-medium">{gbp(b.pricePennies)}</span>
                  {statusBadge(b.status)}
                </div>
              </Link>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
