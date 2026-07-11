import { notFound } from "next/navigation";
import { loadPublicTechByHandle } from "@/lib/booking/public-tech-load";

/**
 * Validate the handle before the page streams.
 * Route-level loading.tsx wraps only page.tsx; checking here keeps HTTP 404
 * (streaming from loading.tsx would lock the status at 200 — a soft 404).
 */
export default async function PublicHandleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const tech = await loadPublicTechByHandle(handle);
  if (!tech) notFound();
  return children;
}
