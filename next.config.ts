import type { NextConfig } from "next";

const supabase = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321");

const nextConfig: NextConfig = {
  // The PDF renderer loads fonts and native-style modules at runtime; bundling it breaks that.
  serverExternalPackages: ["@react-pdf/renderer"],
  // Fonts are read from disk by the PDF routes, so they must ship with those functions.
  outputFileTracingIncludes: {
    "/api/pdf/**": ["./src/assets/fonts/**"],
  },
  experimental: {
    // A branded 404 for any unmatched URL; the root layout lives under the dynamic [lang] segment.
    globalNotFound: true,
  },
  images: {
    // Event covers: uploaded to Supabase Storage, or free photos linked from Unsplash.
    // Object form (not new URL(...)) so image links may carry query strings, e.g. Unsplash sizing.
    remotePatterns: [
      {
        protocol: supabase.protocol.replace(":", "") as "http" | "https",
        hostname: supabase.hostname,
        port: supabase.port,
        pathname: "/storage/v1/object/public/**",
      },
      { protocol: "https", hostname: "images.unsplash.com", pathname: "/**" },
    ],
    qualities: [70, 85],
    // Only the local Supabase in Docker lives on a private address; production never does.
    dangerouslyAllowLocalIP: supabase.hostname === "127.0.0.1",
  },
};

export default nextConfig;
