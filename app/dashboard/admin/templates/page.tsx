import { requireOwner } from "@/lib/owner/require-owner";
import { OwnerNav } from "@/components/owner/owner-nav";
import { supabaseService } from "@/lib/supabase/service";
import { previewReminderTemplate, classifyKind } from "@/lib/owner/templates";
import type { Booking, Client, ReminderKind, Service, Tech } from "@/lib/db/types";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

const KINDS: ReminderKind[] = [
  "confirmation",
  "reminder_24h",
  "reminder_2h",
  "balance_request",
  "patch_test_retest",
];

export default async function OwnerTemplatesPage({
  searchParams,
}: {
  searchParams: Promise<{ techId?: string; kind?: string; channel?: string }>;
}) {
  await requireOwner();
  const sp = await searchParams;
  const techId = sp.techId?.trim() || "";
  const kind = (KINDS.includes(sp.kind as ReminderKind) ? sp.kind : "confirmation") as ReminderKind;
  const channel = sp.channel === "sms" ? "sms" : "email";

  let preview = null as ReturnType<typeof previewReminderTemplate> | null;
  let loadError: string | null = null;

  if (techId) {
    const sb = supabaseService();
    const { data: tech } = await sb.from("techs").select("*").eq("id", techId).maybeSingle();
    if (!tech) {
      loadError = "Account not found.";
    } else {
      const { data: booking } = await sb
        .from("bookings")
        .select("*")
        .eq("techId", techId)
        .order("startIso", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!booking) {
        loadError = "No booking on this account to render against.";
      } else {
        const [{ data: client }, { data: service }] = await Promise.all([
          booking.clientId
            ? sb.from("clients").select("*").eq("id", booking.clientId).maybeSingle()
            : Promise.resolve({ data: null }),
          booking.serviceId
            ? sb.from("services").select("*").eq("id", booking.serviceId).maybeSingle()
            : Promise.resolve({ data: null }),
        ]);
        preview = previewReminderTemplate({
          kind,
          tech: tech as Tech,
          booking: booking as Booking,
          client: (client as Client) ?? null,
          service: (service as Service) ?? null,
          channel,
        });
      }
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Template previewer</h1>
        <p className="text-sm text-ink-soft">
          Render any reminder template with real account data. Never sends.
        </p>
      </div>
      <OwnerNav />

      <form className="flex flex-wrap gap-2 rounded-xl border border-edge bg-surface p-4">
        <input
          name="techId"
          defaultValue={techId}
          required
          placeholder="Tech id"
          className="min-w-[220px] flex-1 rounded-lg border border-edge px-3 py-2 font-mono text-xs"
        />
        <select name="kind" defaultValue={kind} className="rounded-lg border border-edge px-3 py-2 text-sm">
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {k} ({classifyKind(k)})
            </option>
          ))}
        </select>
        <select
          name="channel"
          defaultValue={channel}
          className="rounded-lg border border-edge px-3 py-2 text-sm"
        >
          <option value="email">Email</option>
          <option value="sms">SMS</option>
        </select>
        <button type="submit" className="rounded-lg bg-brand-600 px-4 py-2 text-sm text-white">
          Preview
        </button>
      </form>

      {loadError ? <p className="text-sm text-warning-text">{loadError}</p> : null}

      {preview ? (
        <section className="space-y-3 rounded-xl border border-edge bg-surface p-4">
          <div className="flex flex-wrap gap-2 text-sm">
            <Badge tone={preview.classification === "marketing" ? "amber" : "green"}>
              {preview.classification}
            </Badge>
            <span>From: {preview.from}</span>
            <span>Reply-To: {preview.replyTo}</span>
          </div>
          <p className="font-medium">Subject: {preview.subject}</p>
          <pre className="whitespace-pre-wrap rounded-lg bg-cream p-3 text-sm">{preview.text}</pre>
          {preview.channel === "email" ? (
            <iframe
              title="HTML preview"
              sandbox=""
              srcDoc={preview.html}
              className="h-[420px] w-full rounded-lg border border-edge bg-white"
            />
          ) : null}
        </section>
      ) : !techId ? (
        <p className="text-sm text-ink-soft">Enter a tech id to preview.</p>
      ) : null}
    </div>
  );
}
