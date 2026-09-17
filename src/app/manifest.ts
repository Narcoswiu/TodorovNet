import type { MetadataRoute } from "next";

// Installed from the timing page ("Add to Home Screen"), the app opens straight into timing, full screen.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/t",
    name: "TodorovNET Хронометраж",
    short_name: "TodorovNET",
    description: "Хронометраж на трасето, работи и без покритие · Course timing that works without coverage",
    start_url: "/t",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0b0d10",
    theme_color: "#0b0d10",
    lang: "bg",
    categories: ["sports", "utilities"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
