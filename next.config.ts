import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

/**
 * Content Security Policy (robustness review S8), following "Without Nonces" in
 * node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md. Allowed beyond 'self':
 * - script-src 'unsafe-inline': Next.js writes its page data as inline scripts (a nonce would make every page dynamic);
 *   'wasm-unsafe-eval': occt-import-js (STEP files) and manifold-3d compile WebAssembly in the browser;
 *   'unsafe-eval' in development only, for React's dev tools and fast refresh;
 * - style-src 'unsafe-inline': the UI kit, React Flow, three.js labels and the landing preview set inline styles;
 * - img-src data: blob:: the preview's inlined images, canvas exports and thumbnails;
 * - worker-src blob:: three.js and the file readers start workers from blob addresses;
 * - connect-src blob: data:: models and files loaded from object addresses.
 * The landing preview is an about:srcdoc frame, which inherits this policy; it has no scripts, inline styles
 * and data: images only. Nothing loads from another origin: fonts and the vendored wasm are served by the app.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' blob: data:",
  "worker-src 'self' blob:",
  "media-src 'self' blob: data:",
  "frame-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "same-origin" },
  // older browsers that do not read frame-ancestors
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=(), hid=()" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
  serverExternalPackages: ["pg", "node-pg-migrate"],
  // Migrations are read from disk at start-up, so they must travel with the standalone build.
  outputFileTracingIncludes: { "/**": ["./migrations/**/*"] },
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
