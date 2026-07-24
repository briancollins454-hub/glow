import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import { ThemeBootScript } from "@/components/theme/theme-boot-script";
import { SiteAnalytics } from "@/components/seo/site-analytics";
import { JsonLd } from "@/components/seo/json-ld";
import { organizationJsonLd } from "@/lib/seo/json-ld";
import { APP_URL } from "@/lib/seo/config";
import { DASHBOARD_THEME_STORAGE_KEY } from "@/lib/theme";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const grotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-display" });

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

const gsc =
  process.env.GOOGLE_SITE_VERIFICATION?.trim() ||
  process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION?.trim();

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: "Glow | Booking for lash, brow and nail techs UK",
    template: "%s | Glow",
  },
  description:
    "Glow is the UK booking platform for lash, brow and nail techs. Patch tests, deposits to your bank, 0% commission. £19/mo flat. Start online booking today.",
  keywords: [
    "Glow booking",
    "Glow UK booking",
    "booking system lash tech UK",
    "nail tech booking UK",
    "brow tech booking",
    "patch test booking system",
    "beauty tech deposits",
    "no commission booking",
    "lash tech insurance patch test",
  ],
  openGraph: {
    type: "website",
    locale: "en_GB",
    siteName: "Glow",
    title: "Glow | Booking for lash, brow and nail techs UK",
    description:
      "Glow is the UK booking platform for lash, brow and nail techs. Patch tests, deposits to your bank, 0% commission. £19/mo flat.",
    url: APP_URL,
  },
  twitter: {
    card: "summary_large_image",
    title: "Glow | Booking for lash, brow and nail techs UK",
    description:
      "Glow is the UK booking platform for lash, brow and nail techs. Patch tests, deposits to your bank, 0% commission. £19/mo flat.",
  },
  robots: { index: true, follow: true },
  appleWebApp: {
    capable: true,
    title: "Glow",
    statusBarStyle: "black-translucent",
  },
  ...(gsc ? { verification: { google: gsc } } : {}),
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
        <JsonLd data={organizationJsonLd()} />
      </head>
      <body>
        {children}
        <SiteAnalytics />
      </body>
    </html>
  );
}
