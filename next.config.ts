import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The PDF renderer loads fonts and native-style modules at runtime; bundling it breaks that.
  serverExternalPackages: ["@react-pdf/renderer"],
  // Fonts are read from disk by the PDF routes, so they must ship with those functions.
  outputFileTracingIncludes: {
    "/api/pdf/**": ["./src/assets/fonts/**"],
  },
};

export default nextConfig;
