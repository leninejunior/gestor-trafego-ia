import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  devIndicators: false,
  // Turbopack vazio para Next.js 16
  turbopack: {},
};

export default nextConfig;
