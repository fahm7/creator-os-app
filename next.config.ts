import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Set by `next upgrade --agent=security` when moving 16.4.0 -> 16.4.3 for the published
  // advisory. It records that an agent performed a security upgrade on this app.
  experimental: {
    agentUpgrade: "security",
  },
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
