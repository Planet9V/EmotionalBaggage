import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
  serverExternalPackages: ["pg", "node-pg-migrate"],
  // Migrations are read from disk at start-up, so they must travel with the standalone build.
  outputFileTracingIncludes: { "/**": ["./migrations/**/*"] },
  experimental: { proxyClientMaxBodySize: "30mb" },
};

export default nextConfig;
