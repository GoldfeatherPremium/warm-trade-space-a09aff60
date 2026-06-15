import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // unsafe-eval needed for Next.js HMR in dev
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self'",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  // Native / Node-only DB drivers must not be bundled by the server compiler.
  serverExternalPackages: ["better-sqlite3", "postgres"],
  // During the in-place migration the legacy TanStack app under src/routes is
  // frozen and Vite-built; only lint the new App Router surface.
  eslint: { dirs: ["app"] },
  // Use a Next-scoped tsconfig so the build's type-check doesn't choke on the
  // legacy Vite entrypoints (?url imports, vite/client types).
  typescript: { tsconfigPath: "tsconfig.next.json" },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
