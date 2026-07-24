import Script from "next/script";

type Provider = "off" | "plausible" | "ga" | "google";

function analyticsProvider(): Provider {
  const raw = (process.env.NEXT_PUBLIC_ANALYTICS ?? process.env.ANALYTICS ?? "off")
    .trim()
    .toLowerCase();
  if (raw === "plausible") return "plausible";
  if (raw === "ga" || raw === "google" || raw === "gtag") return "ga";
  return "off";
}

/**
 * Optional third-party analytics. Off unless NEXT_PUBLIC_ANALYTICS is
 * "plausible" or "ga", with matching domain / measurement id env vars.
 */
export function SiteAnalytics() {
  const provider = analyticsProvider();

  if (provider === "plausible") {
    const domain =
      process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN?.trim() ||
      process.env.PLAUSIBLE_DOMAIN?.trim();
    if (!domain) return null;
    return (
      <Script
        defer
        data-domain={domain}
        src="https://plausible.io/js/script.js"
        strategy="afterInteractive"
      />
    );
  }

  if (provider === "ga") {
    const id =
      process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() ||
      process.env.GA_MEASUREMENT_ID?.trim();
    if (!id) return null;
    return (
      <>
        <Script src={`https://www.googletagmanager.com/gtag/js?id=${id}`} strategy="afterInteractive" />
        <Script id="ga-gtag" strategy="afterInteractive">
          {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${id}',{anonymize_ip:true});`}
        </Script>
      </>
    );
  }

  return null;
}
