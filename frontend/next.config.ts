import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    formats: ["image/webp"],
  },
  // The /og share card reads its fonts from disk at runtime; list them so
  // Vercel's file tracing ships them with the function.
  outputFileTracingIncludes: {
    "/og": ["./app/og/fonts/*"],
  },
};

export default nextConfig;
