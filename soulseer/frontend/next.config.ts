import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Netlify supports full Next.js with SSR
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
