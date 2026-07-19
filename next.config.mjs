import bundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

const supabaseHost = process.env.SUPABASE_URL
  ? new URL(process.env.SUPABASE_URL).hostname
  : undefined;

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      // Images are resized client-side before upload (lib/image-prepare.ts).
      // Large Move-to-Glow CSVs stage via Supabase Storage when over ~2MB;
      // keep this high for medium files and multipart overhead.
      bodySizeLimit: "50mb",
    },
    // Next.js 15 defaults dynamic staleTime to 0 — every click refetches the server.
    // Restore client router cache so repeat navigation feels instant.
    staleTimes: {
      dynamic: 60,
      static: 300,
    },
  },
  images: supabaseHost
    ? {
        remotePatterns: [
          {
            protocol: "https",
            hostname: supabaseHost,
            pathname: "/storage/v1/object/**",
          },
        ],
      }
    : undefined,
  serverExternalPackages: ["pdfkit"],
};

export default withBundleAnalyzer(nextConfig);
