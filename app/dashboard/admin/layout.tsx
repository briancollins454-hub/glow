import type { Metadata } from "next";
import { OwnerOmniSearch } from "@/components/owner/owner-omni-search";

export const metadata: Metadata = { title: "Owner", robots: { index: false, follow: false } };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      <div className="pointer-events-none fixed bottom-4 right-4 z-40 sm:bottom-auto sm:top-20">
        <div className="pointer-events-auto">
          <OwnerOmniSearch />
        </div>
      </div>
      {children}
    </div>
  );
}
