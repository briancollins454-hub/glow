"use client";

import { serviceSectionId } from "@/lib/booking/service-groups";

/** Collapsible service row in an accordion list. */
export function ServiceListItem({
  serviceId,
  isOpen,
  onToggle,
  summary,
  children,
}: {
  serviceId: string;
  isOpen: boolean;
  onToggle: () => void;
  summary: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <details
      id={serviceSectionId(serviceId)}
      open={isOpen}
      className="group scroll-mt-24 rounded-xl border border-edge bg-cream"
    >
      <summary
        className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden"
        onClick={(e) => {
          e.preventDefault();
          onToggle();
        }}
      >
        {summary}
        <span className="text-xs font-medium text-brand-400 group-open:hidden">Edit</span>
      </summary>
      <div className="border-t border-edge p-4">{children}</div>
    </details>
  );
}
