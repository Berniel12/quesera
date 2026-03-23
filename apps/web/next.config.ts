import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@signal-map/db",
    "@signal-map/queue",
    "@signal-map/logger",
    "@signal-map/shared",
  ],
};

export default nextConfig;
