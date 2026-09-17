import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TodorovNET — хронометраж на живо",
    short_name: "TodorovNET",
    description: "Хронометраж и класиране на живо за ендуро състезания",
    start_url: "/t",
    display: "standalone",
    background_color: "#0b0d10",
    theme_color: "#0b0d10",
    lang: "bg",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
