import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getDashboardContext } from "@/lib/auth/session";
import { isAdminTech } from "@/lib/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemePreferencePicker } from "@/components/theme/theme-preference-picker";

/**
 * Hidden owner-only grid for eyeballing light and dark tokens.
 * Not linked in nav — open /dev/theme-audit while signed in as platform admin.
 */
export default async function ThemeAuditPage() {
  const c = await getDashboardContext();
  if (!c) redirect("/login");
  if (!isAdminTech(c.tech)) notFound();

  return (
    <div className="container-page space-y-8 py-10">
      <div>
        <p className="text-sm text-ink-faint">
          <Link href="/dashboard" className="text-brand-text hover:underline">
            Dashboard
          </Link>{" "}
          / theme audit
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold text-ink">Theme audit</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-soft">
          Switch System / Dark / Light below, then check badges, buttons, forms and surfaces in both
          themes. Owner admin only.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Live switch</CardTitle>
          <CardDescription>Applies immediately on this device (does not save to Settings).</CardDescription>
        </CardHeader>
        <CardContent>
          <ThemePreferencePicker
            name="_auditTheme"
            label="Preview theme"
            description="Uses the dashboard theme keys for a quick look."
            defaultValue="system"
            applyLive
          />
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold">Surfaces</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-edge bg-cream p-4 text-sm">bg-cream (page)</div>
          <div className="rounded-2xl border border-edge bg-surface p-4 text-sm">bg-surface</div>
          <div className="rounded-2xl border border-edge bg-surface-raised p-4 text-sm shadow-card">
            surface-raised + shadow-card
          </div>
          <div className="rounded-2xl border border-edge bg-fill p-4 text-sm">bg-fill</div>
          <div className="rounded-2xl border border-edge bg-fill-hover p-4 text-sm">bg-fill-hover</div>
          <div className="rounded-2xl border border-edge bg-brand-soft p-4 text-sm text-brand-text">
            brand-soft / brand-text
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold">Typography</h2>
        <p className="text-ink">ink — primary body</p>
        <p className="text-ink-soft">ink-soft — supporting</p>
        <p className="text-ink-faint">ink-faint — hints</p>
        <p className="text-brand-text">brand-text</p>
        <Button className="mt-2">Primary with on-brand text</Button>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold">Badges</h2>
        <div className="flex flex-wrap gap-2">
          <Badge tone="neutral">Neutral</Badge>
          <Badge tone="brand">Brand</Badge>
          <Badge tone="green">Green / success</Badge>
          <Badge tone="amber">Amber / warning</Badge>
          <Badge tone="red">Red / danger</Badge>
          <Badge tone="blue">Blue / info</Badge>
          <Badge tone="purple">Purple / pending</Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-xl bg-success-soft px-3 py-1.5 text-sm text-success-text">Success soft</span>
          <span className="rounded-xl bg-warning-soft px-3 py-1.5 text-sm text-warning-text">Warning soft</span>
          <span className="rounded-xl bg-danger-soft px-3 py-1.5 text-sm text-danger-text">Danger soft</span>
          <span className="rounded-xl bg-info-soft px-3 py-1.5 text-sm text-info-text">Info soft</span>
          <span className="rounded-xl bg-pending-soft px-3 py-1.5 text-sm text-pending-text">Pending soft</span>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold">Buttons</h2>
        <div className="flex flex-wrap gap-2">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button disabled>Disabled</Button>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold">Form controls</h2>
        <div className="card max-w-md space-y-3 p-5">
          <div>
            <Label>Label</Label>
            <Input placeholder="Placeholder uses ink-faint" />
          </div>
          <div>
            <Label>Select</Label>
            <Select defaultValue="a">
              <option value="a">Option A</option>
              <option value="b">Option B</option>
            </Select>
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea placeholder="Multiline" />
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold">Calendar unavailable vs manual block</h2>
        <p className="text-sm text-ink-soft">
          Grey hatching is outside working hours (not deletable). Pink-edged Blocked rows are
          one-off blocks from Block time out (tappable to delete).
        </p>
        <div className="relative h-44 overflow-hidden rounded-xl border border-edge bg-cream">
          <div className="calendar-unavailable absolute inset-x-1 top-2 h-16 overflow-hidden rounded-lg border border-edge px-1.5 py-1">
            <p className="calendar-unavailable-label text-[10px] font-medium">Unavailable</p>
            <p className="mt-0.5 text-[10px] text-ink-faint">Outside hours</p>
          </div>
          <div className="calendar-manual-block absolute inset-x-1 top-20 h-16 overflow-hidden rounded-lg border px-1.5 py-1">
            <p className="calendar-manual-block-label text-[10px] font-semibold">Blocked</p>
            <p className="mt-0.5 text-[10px] text-ink-faint">Lunch</p>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold">Shadows</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-edge bg-surface p-6 shadow-card">shadow-card</div>
          <div className="rounded-2xl border border-edge bg-surface p-6 shadow-glow">shadow-glow</div>
        </div>
      </section>
    </div>
  );
}
