import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/owner/require-owner";
import { ownerSb } from "@/lib/owner/require-owner";
import { omniSearch } from "@/lib/owner/omni-search";
import { shouldIncludeInternal } from "@/lib/owner/internal-accounts";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  await requireOwner();
  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? "";
  const includeInternal = await shouldIncludeInternal(ownerSb());
  const results = await omniSearch(ownerSb(), q, { includeInternal });
  return NextResponse.json({ results });
}
