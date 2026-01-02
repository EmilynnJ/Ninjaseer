import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Netlify supports full Next.js with SSR
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
