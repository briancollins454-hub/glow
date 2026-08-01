"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOwner, ownerSb } from "@/lib/owner/require-owner";
import { assertNotViewAs } from "@/lib/owner/view-as";
import { writeOwnerAudit } from "@/lib/owner/owner-audit-log";
import { sendEmail } from "@/lib/email";
import { getTechById, updateTech } from "@/lib/db/queries";
import { addCostRecord, currentPeriodMonth } from "@/lib/owner/economics";
import { addPartnerLedgerEntry } from "@/lib/owner/referrals";
import { setFeedbackThemeStatus, type RoadmapStatus } from "@/lib/owner/feedback-board";
import { runOwnerDailyJob } from "@/lib/owner/daily-job";
import { randomId } from "@/lib/ids";
import { isConfirmed } from "@/lib/owner/confirm";

export async function worklistNudgeAction(formData: FormData) {
  await assertNotViewAs();
  const { tech: admin } = await requireOwner();
  if (!isConfirmed(formData)) redirect("/dashboard/admin/worklists?err=confirm");
  const id = String(formData.get("id") ?? "");
  const kind = String(formData.get("kind") ?? "setup_help");
  const target = await getTechById(ownerSb(), id);
  if (!target) redirect("/dashboard/admin/worklists");

  const subjects: Record<string, string> = {
    setup_help: "Need a hand finishing your Glow setup?",
    go_live: "Your Glow booking page is ready to go live",
    win_back: "We'd love to have you back on Glow",
    trial_nudge: "Your Glow trial — a quick nudge",
  };
  const bodies: Record<string, string> = {
    setup_help:
      `Hi ${target.name || target.businessName},\n\n` +
      `I'm Brian from Glow. Happy to help you add services and get your booking page live — reply to this email or use the in-app import.\n\nBrian`,
    go_live:
      `Hi ${target.name || target.businessName},\n\n` +
      `Your services look set up. Flip booking page live in Settings when you're ready for clients.\n\nBrian`,
    win_back:
      `Hi ${target.name || target.businessName},\n\n` +
      `Noticed your Glow subscription needs attention. Reply if I can help get things back on track.\n\nBrian`,
    trial_nudge:
      `Hi ${target.name || target.businessName},\n\n` +
      `Quick check-in on your Glow trial — add a service and share your page when you're ready. I'm here if you get stuck.\n\nBrian`,
  };

  const text = bodies[kind] ?? bodies.setup_help!;
  await sendEmail({
    to: target.email,
    subject: subjects[kind] ?? subjects.setup_help!,
    text,
    html: `<pre style="font-family:sans-serif;white-space:pre-wrap">${text.replace(/</g, "&lt;")}</pre>`,
    kind: `owner_${kind}`,
    techId: target.id,
  });

  await writeOwnerAudit({
    actorEmail: admin.email,
    action: `worklist_nudge_${kind}`,
    targetType: "tech",
    targetId: id,
    metadata: { handle: target.handle },
  });
  await ownerSb().from("owner_notes").insert({
    id: randomId("onote"),
    techId: id,
    body: `Worklist nudge sent: ${kind}`,
    authorEmail: admin.email,
    createdAt: new Date().toISOString(),
  });

  revalidatePath("/dashboard/admin/worklists");
  redirect(`/dashboard/admin/worklists?ok=nudge`);
}

export async function setAtRiskManualAction(formData: FormData) {
  await assertNotViewAs();
  const { tech: admin } = await requireOwner();
  const id = String(formData.get("id") ?? "");
  if (!isConfirmed(formData)) redirect(`/dashboard/admin/accounts/${id}?err=confirm`);
  const on = formData.get("on") === "1";
  await updateTech(ownerSb(), id, { atRiskManual: on });
  await writeOwnerAudit({
    actorEmail: admin.email,
    action: on ? "mark_at_risk_manual" : "unmark_at_risk_manual",
    targetType: "tech",
    targetId: id,
  });
  revalidatePath("/dashboard/admin/worklists");
  revalidatePath(`/dashboard/admin/accounts/${id}`);
  redirect(`/dashboard/admin/accounts/${id}?ok=atrisk`);
}

export async function setOwnerTagsAction(formData: FormData) {
  await assertNotViewAs();
  const { tech: admin } = await requireOwner();
  if (!isConfirmed(formData)) {
    redirect(`/dashboard/admin/accounts/${String(formData.get("id") ?? "")}?err=confirm`);
  }
  const id = String(formData.get("id") ?? "");
  const raw = String(formData.get("tags") ?? "");
  const tags = raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 20);
  await updateTech(ownerSb(), id, { ownerTags: tags });
  await writeOwnerAudit({
    actorEmail: admin.email,
    action: "set_owner_tags",
    targetType: "tech",
    targetId: id,
    metadata: { tags },
  });
  revalidatePath(`/dashboard/admin/accounts/${id}`);
  redirect(`/dashboard/admin/accounts/${id}?ok=tags`);
}

export async function addCostRecordAction(formData: FormData) {
  await assertNotViewAs();
  const { tech: admin } = await requireOwner();
  if (!isConfirmed(formData)) redirect("/dashboard/admin/economics?err=confirm");
  const provider = String(formData.get("provider") ?? "") as
    | "supabase"
    | "resend"
    | "twilio"
    | "vercel"
    | "stripe";
  const amountPounds = Number(formData.get("amount") ?? "0");
  const notes = String(formData.get("notes") ?? "").trim();
  const periodMonth = String(formData.get("periodMonth") ?? currentPeriodMonth());
  if (!["supabase", "resend", "twilio", "vercel", "stripe"].includes(provider) || !(amountPounds > 0)) {
    redirect("/dashboard/admin/economics?err=input");
  }
  await addCostRecord({
    periodMonth,
    provider,
    amountPennies: Math.round(amountPounds * 100),
    notes,
    enteredBy: admin.email,
  });
  await writeOwnerAudit({
    actorEmail: admin.email,
    action: "add_cost_record",
    metadata: { provider, amountPounds, periodMonth },
  });
  revalidatePath("/dashboard/admin/economics");
  redirect("/dashboard/admin/economics?ok=cost");
}

export async function addPartnerLedgerAction(formData: FormData) {
  await assertNotViewAs();
  const { tech: admin } = await requireOwner();
  if (!isConfirmed(formData)) redirect("/dashboard/admin/referrals?err=confirm");
  const partnerSlug = String(formData.get("partnerSlug") ?? "").trim();
  const kind = String(formData.get("kind") ?? "") as "commission_owed" | "commission_paid" | "adjustment";
  const amountPounds = Number(formData.get("amount") ?? "0");
  const note = String(formData.get("note") ?? "").trim();
  if (!partnerSlug || !["commission_owed", "commission_paid", "adjustment"].includes(kind)) {
    redirect("/dashboard/admin/referrals?err=input");
  }
  await addPartnerLedgerEntry({
    partnerSlug,
    kind,
    amountPennies: Math.round(amountPounds * 100),
    note,
    createdByEmail: admin.email,
  });
  await writeOwnerAudit({
    actorEmail: admin.email,
    action: "partner_ledger_entry",
    metadata: { partnerSlug, kind, amountPounds },
  });
  revalidatePath("/dashboard/admin/referrals");
  redirect("/dashboard/admin/referrals?ok=ledger");
}

export async function setFeedbackStatusAction(formData: FormData) {
  await assertNotViewAs();
  const { tech: admin } = await requireOwner();
  if (!isConfirmed(formData)) redirect("/dashboard/admin/feedback?err=confirm");
  const themeKey = String(formData.get("themeKey") ?? "");
  const status = String(formData.get("status") ?? "") as RoadmapStatus;
  const ids = String(formData.get("ids") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!themeKey || !ids.length || !["open", "planned", "shipped", "declined"].includes(status)) {
    redirect("/dashboard/admin/feedback?err=input");
  }
  await setFeedbackThemeStatus({ ids, status, themeKey });
  await writeOwnerAudit({
    actorEmail: admin.email,
    action: "feedback_theme_status",
    metadata: { themeKey, status, ids },
  });

  if (status === "shipped" && formData.get("notify") === "1") {
    const { data: rows } = await ownerSb()
      .from("feedback_submissions")
      .select("techId")
      .in("id", ids);
    const techIds = [...new Set((rows ?? []).map((r) => r.techId as string))];
    for (const tid of techIds) {
      const t = await getTechById(ownerSb(), tid);
      if (!t) continue;
      const shipText = `Hi ${t.name || t.businessName},\n\nSomething you requested on Glow is now available. Thanks for the feedback — it shapes the roadmap.\n\nBrian`;
      await sendEmail({
        to: t.email,
        subject: "A Glow feature you asked for has shipped",
        text: shipText,
        html: `<pre style="font-family:sans-serif;white-space:pre-wrap">${shipText.replace(/</g, "&lt;")}</pre>`,
        kind: "owner_feedback_shipped",
        techId: t.id,
      }).catch(() => undefined);
    }
  }

  revalidatePath("/dashboard/admin/feedback");
  redirect("/dashboard/admin/feedback?ok=status");
}

function isNextRedirect(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "digest" in e &&
    String((e as { digest?: unknown }).digest).startsWith("NEXT_REDIRECT")
  );
}

/** Manual owner-daily from Ops. Always redirects with ok/err so the button never "does nothing". */
export async function runOwnerDailyAction(formData: FormData) {
  try {
    await assertNotViewAs();
    const { tech: admin } = await requireOwner();
    if (String(formData.get("confirm") ?? "") !== "yes") {
      redirect("/dashboard/admin/ops?err=confirm");
    }
    const result = await runOwnerDailyJob("manual");
    await writeOwnerAudit({
      actorEmail: admin.email,
      action: "owner_daily_manual",
      metadata: !result.ok
        ? { error: result.error }
        : "skipped" in result && result.skipped
          ? { skipped: true, reason: result.reason }
          : {
              updated: "health" in result ? result.health.updated : 0,
              snapshotted: "health" in result ? result.health.snapshotted : 0,
              errors: "health" in result ? result.health.errors : 0,
              smsRows: "smsRows" in result ? result.smsRows : 0,
              durationMs: "durationMs" in result ? result.durationMs : 0,
            },
    });
    revalidatePath("/dashboard/admin");
    revalidatePath("/dashboard/admin/ops");
    revalidatePath("/dashboard/admin/accounts");
    redirect(result.ok ? "/dashboard/admin/ops?ok=owner_daily" : "/dashboard/admin/ops?err=owner_daily");
  } catch (e) {
    if (isNextRedirect(e)) throw e;
    console.error("[runOwnerDailyAction]", (e as Error).message);
    redirect("/dashboard/admin/ops?err=owner_daily");
  }
}
