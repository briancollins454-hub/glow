import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const grotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-display" });

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://glow-uk.com";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0b0910",
};

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: "Glow - booking for beauty techs",
    template: "%s | Glow",
  },
  description:
    "A fee-free, branded booking platform for self-employed beauty techs. Deposits, no-show protection, patch-test tracking and infill timing rules built in.",
  keywords: [
    "beauty booking system",
    "lash tech booking",
    "nail tech booking",
    "brow tech booking",
    "booking deposits",
    "no-show protection",
    "beauty techs",
  ],
  openGraph: {
    type: "website",
    siteName: "Glow",
    title: "Glow - booking for beauty techs",
    description:
      "Your booking page, your rules. Deposits, patch tests, infill timing and reminders built in. 0% commission.",
    url: APP_URL,
  },
  twitter: {
    card: "summary_large_image",
    title: "Glow - booking for beauty techs",
    description:
      "Your booking page, your rules. Deposits, patch tests, infill timing and reminders built in. 0% commission.",
  },
  robots: { index: true, follow: true },
  // iPhone "Add to Home Screen": full-screen app experience with dark status bar.
  appleWebApp: {
    capable: true,
    title: "Glow",
    statusBarStyle: "black-translucent",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en-GB" className={`${inter.variable} ${grotesk.variable}`}>
      <body>{children}</body>
    </html>
  );
}
