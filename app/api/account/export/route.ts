import { getDashboardContext } from "@/lib/auth/session";
import {
  listAccountClosureRequests,
  listAuditEvents,
  listBookings,
  listCategories,
  listClientPhotosForTech,
  listClients,
  listFormResponsesForTech,
  listMessagesForTech,
  listPayments,
  listPatchTests,
  listQuestions,
  listReminders,
  listServices,
  listTimeOff,
  listWorkingHours,
  createAuditEvent,
} from "@/lib/db/queries";
import { formatInTimeZone } from "date-fns-tz";
import { TZ } from "@/lib/format";

export async function GET() {
  const c = await getDashboardContext();
  if (!c) return new Response("Unauthorized", { status: 401 });
  const { sb, tech } = c;

  const [
    categories,
    services,
    workingHours,
    timeOff,
    clients,
    bookings,
    payments,
    patchTests,
    reminders,
    questions,
    formResponses,
    messages,
    photos,
    auditEvents,
    closureRequests,
  ] = await Promise.all([
    listCategories(sb, tech.id),
    listServices(sb, tech.id),
    listWorkingHours(sb, tech.id),
    listTimeOff(sb, tech.id),
    listClients(sb, tech.id),
    listBookings(sb, tech.id),
    listPayments(sb, tech.id),
    listPatchTests(sb, tech.id),
    listReminders(sb, tech.id),
    listQuestions(sb, tech.id),
    listFormResponsesForTech(sb, tech.id),
    listMessagesForTech(sb, tech.id),
    listClientPhotosForTech(sb, tech.id),
    listAuditEvents(sb, tech.id),
    listAccountClosureRequests(sb, tech.id),
  ]);

  try {
    await createAuditEvent(sb, {
      techId: tech.id,
      actor: "tech",
      action: "account_data_exported",
      entityType: "tech",
      entityId: tech.id,
      metadata: { format: "json" },
    });
  } catch {
    // Export should still work if audit migration has not reached an environment yet.
  }

  const exportedAt = new Date();
  const body = {
    exportedAt: exportedAt.toISOString(),
    product: "Glow",
    formatVersion: 1,
    tech,
    categories,
    services,
    workingHours,
    timeOff,
    clients,
    bookings,
    payments,
    patchTests,
    reminders,
    consultationQuestions: questions,
    formResponses,
    messages,
    clientPhotos: photos.map((p) => ({
      ...p,
      note: "Photo export includes storage metadata only. Contact support if you need the binary image files bundled.",
    })),
    auditEvents,
    accountClosureRequests: closureRequests,
  };
  const filename = `glow-account-export-${tech.handle}-${formatInTimeZone(exportedAt, TZ, "yyyy-MM-dd")}.json`;

  return new Response(JSON.stringify(body, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
