import js from "@eslint/js";
import eslintPluginPrettier from "eslint-plugin-prettier/recommended";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import nextPlugin from "@next/eslint-plugin-next";
import tseslint from "typescript-eslint";

// Identifiers that exist BOTH as a DOM global (lib.dom.d.ts) and as a
// lucide-react icon export. TypeScript silently resolves a missing import to
// the DOM global, so a forgotten `import { Lock } from "lucide-react"` type-
// checks but throws `ReferenceError: Lock is not defined` at runtime in Node
// — exactly what crashed every product page. Restricting these globals turns
// that into a build-time lint error; a proper import shadows the global and
// keeps the rule quiet.
// Kept deliberately narrow: each name is a common lucide icon AND a DOM global,
// but is almost never used here in its Web-API form (e.g. next/image is always
// imported as `Image`). Web APIs that ARE used directly — Notification, Headers,
// Request, Response — are intentionally excluded to avoid false positives.
const ICON_DOM_GLOBAL_COLLISIONS = ["Lock", "Image", "Text", "Option"];

export default tseslint.config(
  { ignores: ["dist", ".output", ".vinxi", ".next", "next-env.d.ts"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "server-only",
              message:
                "TanStack Start does not use the Next.js `server-only` package. Rename the module to `*.server.ts` or mark it with `@tanstack/react-start/server-only`.",
            },
          ],
        },
      ],
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  {
    // Next.js App Router files legitimately export non-components (metadata,
    // generateMetadata, route config, Server Actions) and use the idiomatic
    // `server-only` package — relax the Vite-era guards here. Add the Next.js
    // plugin (the build warned it was missing) and the icon/global collision
    // guard so a forgotten lucide import fails the build instead of prod.
    files: ["app/**/*.{ts,tsx}"],
    plugins: { "@next/next": nextPlugin },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
      "no-restricted-imports": "off",
      "no-restricted-globals": [
        "error",
        ...ICON_DOM_GLOBAL_COLLISIONS.map((name) => ({
          name,
          message: `"${name}" resolves to a DOM global here — if you meant the lucide-react icon, import it: import { ${name} } from "lucide-react".`,
        })),
      ],
    },
  },
  eslintPluginPrettier,
);
