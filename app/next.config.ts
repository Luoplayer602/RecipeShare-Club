import type { NextConfig } from "next";
import { networkInterfaces } from "node:os";

const devOrigins = Object.values(networkInterfaces()).flatMap((entries) =>
  (entries ?? []).filter((entry) => entry.family === "IPv4" && !entry.internal).map((entry) => entry.address),
);

const nextConfig: NextConfig = {
  allowedDevOrigins: devOrigins,
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  serverExternalPackages: ["file-type"],
  turbopack: {
    rules: {
      "globals.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
