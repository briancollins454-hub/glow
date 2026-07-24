import type { Metadata } from "next";
import { ComingSoonCustomer } from "@/components/marketing/marketing-article";
import { marketingMetadata } from "@/lib/marketing/types";

export const revalidate = 3600;

export const metadata: Metadata = marketingMetadata({
  path: "/customers/claire",
  title: "Claire — Glow customer story",
  description: "Coming soon: how Claire uses Glow for beauty bookings.",
});

export default function Page() {
  return (
    <ComingSoonCustomer
      name="Claire's studio"
      path="/customers/claire"
      demoLabel="Brow bar"
    />
  );
}
