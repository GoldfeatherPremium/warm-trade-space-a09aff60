# DEAD_CODE_AUDIT.md — X-VAULT Marketplace

**DO NOT DELETE YET** — this lists candidates with the evidence used to classify them. Confirm with a build + a tool like `knip`/`ts-prune` before removal.

## Files safe to delete (verified unimported)

### 1. `app/admin/_components/admin-shell.tsx`
- **Evidence:** `grep -rn "admin/_components|_components/admin-shell" app src` → **no matches**. The `AdminShell` actually used is the sibling `app/admin/admin-shell.tsx`, imported at `app/admin/layout.tsx:4` (`import { AdminShell } from "./admin-shell"`). The `_components/` copy is an orphaned duplicate.
- **Risk:** none (no importer).

### 2. `app/admin/_components/admin-ui.tsx`
- **Evidence:** no import sites for the file or its exports. `StatCard`/`SectionCard` are **redefined locally** in `app/admin/dashboard-client.tsx:110` and `app/seller/page.tsx:25`, not imported from here.
- **Risk:** none. (After deleting both, the `app/admin/_components/` directory is empty and can be removed.)

### 3. `scripts/http-test.mjs`
- **Evidence:** referenced only by its own usage comment (`grep http-test` → only `scripts/http-test.mjs:6`); **not** wired into `package.json` scripts. Tests an old wire protocol. `scripts/smoke-test.ts` is the current test artifact.
- **Risk:** none to the app; confirm it isn't used by CI before deletion (`grep` found no CI reference in-repo).

## Stale / unused dependencies (verified: no runtime import in `app/` or `src/`)
`grep -rln "tanstack/react-router|tanstack/react-start|@vitejs|from \"vite|tailwindcss/vite|@lovable.dev/vite"` over `app/ src/` → the only hit is a **comment** in `src/lib/types.ts:5` (no import). The project builds with **Next.js**, not Vite/TanStack Start. These `package.json` entries are dead weight:

**dependencies:** `@tailwindcss/vite`, `@tanstack/react-router`, `@tanstack/react-start`, `@tanstack/router-plugin`, `vite-tsconfig-paths`
**devDependencies:** `@vitejs/plugin-react`, `vite`, `nitro`, `eslint-plugin-react-refresh`, `@lovable.dev/vite-tanstack-config`

> Note: a previous report **claimed these were already removed** — they are **still present** in `package.json` (`:42-46,69-70,81,88,92`). Verify `@types/better-sqlite3`/`better-sqlite3` are retained (used by the SQLite dev engine in `db.server.ts:58`).

## Duplicate / redundant code (not dead, but consolidation candidates)
- `StatCard` defined twice (`app/admin/dashboard-client.tsx:110`, `app/seller/page.tsx:25`) — extract one shared component.
- `middleware.ts` re-sets `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` that are **already** set globally in `next.config.ts:3-29` — redundant duplication (and the two `Permissions-Policy` values differ: config includes `interest-cohort=()`, middleware omits it).
- Refund logic duplicated between `txRefund` and `txRefundToCredits` (`money.server.ts:93-138, 291-344`) — large shared body; factor common escrow-reversal.

## Method / caveats
- Classification is by static `grep` for import sites + export usage. **Recommend** running `npx knip` and `next build` to catch dynamic imports or string-based references before deleting. Mark anything `knip` disputes as **UNVERIFIED**.
- `loading.tsx`/`error.tsx`/`not-found.tsx` are Next.js convention files — **not** dead even if not explicitly imported.
