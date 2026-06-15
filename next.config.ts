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
      // unsafe-eval removed; not needed in production Next.js 15 builds
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      // Allow next/image optimized images (/_next/image) and uploaded images
      "img-src 'self' data: blob:",
      // next/font serves fonts from /_next/static — 'self' covers it
      "font-src 'self'",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  compress: true,
  // Native / Node-only DB drivers must not be bundled by the server compiler.
  serverExternalPackages: ["better-sqlite3", "postgres"],
  // During the in-place migration the legacy TanStack app under src/routes is
  // frozen and Vite-built; only lint the new App Router surface.
  eslint: { dirs: ["app"] },
  // Use a Next-scoped tsconfig so the build's type-check doesn't choke on the
  // legacy Vite entrypoints (?url imports, vite/client types).
  typescript: { tsconfigPath: "tsconfig.next.json" },
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 86400,
  },
  async headers() {
    return [
      // Security headers on every route
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
      // Hashed JS/CSS bundles: immutable, 1 year
      {
        source: "/_next/static/(.*)",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      // Public image assets: 1 day + 7 day stale-while-revalidate
      {
        source: "/assets/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=604800",
          },
        ],
      },
      // next/image optimized output: 24h
      {
        source: "/_next/image(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=604800",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
