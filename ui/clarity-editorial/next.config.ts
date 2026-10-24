import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  devIndicators: false,
  // Reuse the reviewed advisor source on main without copying or editing it.
  turbopack: { root: path.resolve(__dirname, "../..") },
};

export default nextConfig;
