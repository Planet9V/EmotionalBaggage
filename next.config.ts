import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
  serverExternalPackages: ["pg"],
  experimental: { proxyClientMaxBodySize: "30mb" },
};

export default nextConfig;
