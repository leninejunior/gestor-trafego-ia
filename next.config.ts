import type { NextConfig } from "next";
import type { Configuration } from "webpack"; // Import Configuration type from webpack

const nextConfig: NextConfig = {
  webpack: (config: Configuration) => { // Explicitly type config
    if (process.env.NODE_ENV === "development") {
      config.module?.rules.push({ // Use optional chaining for module and rules
        test: /\.(jsx|tsx)$/,
        exclude: /node_modules/,
        enforce: "pre",
        use: "@dyad-sh/nextjs-webpack-component-tagger",
      });
    }
    return config;
  },
};

export default nextConfig;