import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native / Node-only DB drivers must not be bundled by the server compiler.
  serverExternalPackages: ["better-sqlite3", "postgres"],
  // During the in-place migration the legacy TanStack app under src/routes is
  // frozen and Vite-built; only lint the new App Router surface.
  eslint: { dirs: ["app"] },
  // Use a Next-scoped tsconfig so the build's type-check doesn't choke on the
  // legacy Vite entrypoints (?url imports, vite/client types).
  typescript: { tsconfigPath: "tsconfig.next.json" },
};

export default nextConfig;
