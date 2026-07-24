import type { Metadata } from "next";
import { ComingSoonCustomer } from "@/components/marketing/marketing-article";
import { marketingMetadata } from "@/lib/marketing/types";

export const revalidate = 3600;

export const metadata: Metadata = marketingMetadata({
  path: "/customers/klaudia",
  title: "Klaudia — Glow customer story",
  description: "Coming soon: how Klaudia uses Glow for lash and brow bookings.",
});

export default function Page() {
  return (
    <ComingSoonCustomer
      name="Klaudia's lash studio"
      path="/customers/klaudia"
      demoLabel="Lash studio"
    />
  );
}
