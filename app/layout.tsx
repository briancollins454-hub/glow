import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Glow — booking for solo beauty techs",
  description:
    "A fee-free, branded booking platform for UK self-employed beauty techs. Deposits, no-show protection, patch-test tracking and infill timing rules built in.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en-GB">
      <body>{children}</body>
    </html>
  );
}
