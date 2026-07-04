import type { MetadataRoute } from "next";

// Makes Glow installable as a home-screen app (PWA): own icon, full-screen,
// no browser chrome. Techs land on their dashboard when opening the app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Glow - bookings for beauty techs",
    short_name: "Glow",
    description: "Your booking page, deposits, reminders and clients in one place.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#0b0910",
    theme_color: "#0b0910",
    orientation: "portrait",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
