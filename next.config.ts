import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  // Turbopack vazio para Next.js 16
  turbopack: {},
};

export default nextConfig;