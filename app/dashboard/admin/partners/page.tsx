import { requireOwner } from "@/lib/owner/require-owner";
import { OwnerNav } from "@/components/owner/owner-nav";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { listPartners } from "@/lib/partners";
import { ownerCreatePartnerAction } from "../owner-actions";
import { fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";

const APP_HOST = (process.env.NEXT_PUBLIC_APP_URL ?? "https://glow-uk.com").replace(/^https?:\/\//, "");

export default async function OwnerPartnersPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; err?: string }>;
}) {
  await requireOwner();
  const sp = await searchParams;
  const partners = await listPartners().catch(() => []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Partners</h1>
        <p className="text-sm text-ink-soft">
          Training academies and affiliates. Each gets a co-branded /partner/[slug] page and 3 months free on signup.
        </p>
      </div>
      <OwnerNav />

      {sp.ok ? (
        <p className="rounded-xl bg-success-soft px-4 py-3 text-sm text-success-text">Partner saved.</p>
      ) : null}
      {sp.err ? (
        <p className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger-text">
          {sp.err === "slug" ? "Slug is required and must be unique." : "Could not save partner."}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Add partner</CardTitle>
          <CardDescription>Slug becomes glow-uk.com/partner/slug. Offer: 100% off for 3 months.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={ownerCreatePartnerAction} className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-1">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" required placeholder="Academy name" />
            </div>
            <div className="sm:col-span-1">
              <Label htmlFor="slug">Slug</Label>
              <Input id="slug" name="slug" required placeholder="academy-name" />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="logoUrl">Logo URL (optional)</Label>
              <Input id="logoUrl" name="logoUrl" type="url" placeholder="https://..." />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit">Add partner</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Existing partners</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {partners.length === 0 ? (
            <p className="text-sm text-ink-faint">No partners yet.</p>
          ) : (
            partners.map((p) => (
              <div key={p.id} className="rounded-xl border border-edge px-4 py-3 text-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-medium text-ink">{p.name}</p>
                  <p className="text-ink-faint">Added {fmtDate(p.createdAt)}</p>
                </div>
                <p className="mt-1 text-ink-soft">
                  /partner/{p.slug}
                  {!p.active ? " · inactive" : ""}
                </p>
                <code className="mt-2 block break-all rounded-lg bg-fill px-2 py-1 text-xs">
                  {APP_HOST}/partner/{p.slug}
                </code>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
