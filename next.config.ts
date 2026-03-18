import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Configuração para resolver problemas de chunks
  webpack: (config, { isServer, dev }) => {
    // Configuração para resolver problemas de vendor chunks
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }

    // Configuração específica para resolver problemas de chunks
    if (dev && !isServer) {
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendors',
              chunks: 'all',
            },
          },
        },
      };
    }

    return config;
  },
  // Configuração experimental para resolver problemas de chunks
  experimental: {
    optimizePackageImports: ['@supabase/supabase-js'],
  },
  poweredByHeader: false,
  reactStrictMode: true,
};

export default nextConfig;