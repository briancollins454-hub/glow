import { getDashboardContext } from "@/lib/auth/session";
import { createAuditEvent } from "@/lib/db/queries";
import { buildTaxPackPdf, loadTaxPackData, taxPackFilename } from "@/lib/tax-pack";
import { taxYearRange, taxYearStartForDate } from "@/lib/tax-year";

export async function GET(request: Request) {
  const c = await getDashboardContext();
  if (!c) return new Response("Unauthorized", { status: 401 });

  const url = new URL(request.url);
  const yearParam = url.searchParams.get("year");
  const startYear = yearParam ? parseInt(yearParam, 10) : taxYearStartForDate();
  if (!Number.isFinite(startYear) || startYear < 2000 || startYear > 2100) {
    return new Response("Invalid tax year", { status: 400 });
  }

  const data = await loadTaxPackData(c.sb, c.tech, startYear);
  const pdf = await buildTaxPackPdf(data);
  const filename = taxPackFilename(c.tech, data.taxYear, data.generatedAt);

  try {
    await createAuditEvent(c.sb, {
      techId: c.tech.id,
      actor: "tech",
      action: "tax_pack_exported",
      entityType: "tech",
      entityId: c.tech.id,
      metadata: { taxYear: taxYearRange(startYear).label, filename },
    });
  } catch {
    // Export should still work if audit logging fails.
  }

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
