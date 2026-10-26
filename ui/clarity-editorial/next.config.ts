import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  devIndicators: false,
  // The app imports the root finance.ts, so the build root is the repository root.
  turbopack: { root: path.resolve(__dirname, "../..") },
};

export default nextConfig;
