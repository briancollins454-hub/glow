import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import { ThemeBootScript } from "@/components/theme/theme-boot-script";
import { DASHBOARD_THEME_STORAGE_KEY } from "@/lib/theme";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const grotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-display" });

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://glow-uk.com";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // Boot script updates this to match the active theme.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf7fb" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0910" },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: "Booking system for lash, nail and brow techs UK | Glow",
    template: "%s | Glow",
  },
  description:
    "UK booking for self-employed lash, nail and brow techs. Patch tests, deposits to your bank, 0% commission. £19/mo flat.",
  keywords: [
    "booking system lash tech UK",
    "nail tech booking UK",
    "brow tech booking",
    "patch test booking system",
    "beauty tech deposits",
    "no commission booking",
    "lash tech insurance patch test",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_GB",
    siteName: "Glow",
    title: "Booking system for lash, nail and brow techs UK | Glow",
    description:
      "UK booking for self-employed lash, nail and brow techs. Patch tests, deposits to your bank, 0% commission. £19/mo flat.",
    url: APP_URL,
  },
  twitter: {
    card: "summary_large_image",
    title: "Booking system for lash, nail and brow techs UK | Glow",
    description:
      "UK booking for self-employed lash, nail and brow techs. Patch tests, deposits to your bank, 0% commission. £19/mo flat.",
  },
  robots: { index: true, follow: true },
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
    <html lang="en-GB" className={`${inter.variable} ${grotesk.variable}`} suppressHydrationWarning>
      <head>
        <ThemeBootScript storageKey={DASHBOARD_THEME_STORAGE_KEY} preference="system" />
      </head>
      <body>{children}</body>
    </html>
  );
}
