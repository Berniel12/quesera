import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@signal-map/db",
    "@signal-map/queue",
    "@signal-map/logger",
    "@signal-map/shared",
  ],
  webpack: (config) => {
    // Resolve .js imports to .ts files in workspace packages
    // This allows source files to use .js extensions (required for ESM Node runtime)
    // while Turbopack/webpack resolves them to .ts during the Next.js build
    config.resolve = config.resolve ?? {};
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
    };
    return config;
  },
};

export default nextConfig;
