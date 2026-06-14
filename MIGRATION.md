# X-VAULT — TanStack Start → Next.js (App Router + RSC) Migration Plan

**Status:** Phase 0 complete & **APPROVED (2026-06-14)**. Executing phase by phase.
**Branch:** `claude/nextjs-migration` (from `main`). One PR per phase.
**Target host:** Vercel (preview deploy per phase; Vercel is the testing source of truth). **DB:** Postgres (Supabase) via `DATABASE_URL`; SQLite for local dev (existing dual-engine layer).

---

## 0. Approved decisions & constraints (2026-06-14)

1. **Repo layout — in-place.** Introduce the Next.js App Router alongside the existing TanStack/Vite app in the same repo. Both build systems stay green until Phase 7 cutover, then the Vite/Start build is retired. No `next/` subdirectory.
2. **Site URL — env-driven.** All SEO/metadata/canonical/OG/sitemap/robots/JSON-LD derive from **`NEXT_PUBLIC_SITE_URL`**. Remove every hardcoded `lovable.app` reference.
3. **Chat realtime — polling only** during migration and launch (matches today's 4–5 s intervals). No WebSockets/SSE until post-launch if scale requires.
4. **Vercel — primary target.** Repo already connected to Vercel. Preview deployment per phase; validate on the preview URL before advancing; all env vars set in Vercel; production-ready throughout. App Router, RSC, Server Actions, metadata, sitemap, robots, route handlers must all work on Vercel.

**Required environment variables** (local `.env` and Vercel):
`DATABASE_URL` (Supabase Postgres), `STOCK_ENCRYPTION_KEY`, `SESSION_SECRET`, `COOKIE_SECRET`, `ENCRYPTION_KEY`, `NEXT_PUBLIC_SITE_URL`.
_Note:_ the current core uses `STOCK_ENCRYPTION_KEY` for stock encryption and a cookie token (random, DB-backed sessions — no signing secret today). `SESSION_SECRET`/`COOKIE_SECRET`/`ENCRYPTION_KEY` are provisioned now and wired in as we harden session signing / at-rest encryption during the port (documented per phase; no behavior regression).

### ⚠️ Execution-environment constraint (how the Vercel/Lighthouse gates are run)

This build sandbox has **no outbound network egress and no live preview URL**, so I cannot run Lighthouse/PageSpeed or fetch the Vercel preview from here. Division of labor:

- **I do here:** scaffold/port code; verify `tsc --noEmit`, `eslint`, `next build`, and `scripts/smoke-test.ts` locally; capture bundle/JS metrics from the build output; push (which triggers the Vercel preview build via the GitHub integration).
- **Read from Vercel preview (by you/CI):** mobile PageSpeed/Lighthouse Performance/A11y/Best-Practices/SEO, FCP, LCP, TBT, CLS, Speed Index. Paste them back (or point me at the preview) and I record them in the tables below before advancing. Phase 2's 90+ mobile gate is enforced this way.

---

## 0a. Baseline performance report (current TanStack/Vite app)

**Locally measurable (captured from `npm run build`, this commit):**

| Metric                                                             | Value                                                                                                                           |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| Total client JS (uncompressed)                                     | ~1.8 MB                                                                                                                         |
| Shared framework/runtime chunk (`index-*.js`, hydrates every page) | **548 KB**                                                                                                                      |
| Charts (`recharts`, lazy)                                          | 375 KB                                                                                                                          |
| Shell chunk (`shell-*.js`)                                         | 91 KB                                                                                                                           |
| Global CSS                                                         | 123 KB (19.6 KB gzip)                                                                                                           |
| Largest route chunks                                               | `seller.new-product` 22 KB, `orders.$orderId` 19 KB, `seller.promotions` 17 KB, `p.$slug` 16 KB, `menu` 14 KB, `chat-box` 12 KB |
| Total client output (JS+CSS+img)                                   | 2.4 MB                                                                                                                          |

**Field metrics (mobile) — to be captured on the Vercel preview / PageSpeed (no egress in sandbox):**

| Metric                          | Baseline (old app) | Notes                            |
| ------------------------------- | ------------------ | -------------------------------- |
| Lighthouse Performance (mobile) | _pending_          | reported ~33–45 historically     |
| Accessibility                   | _pending_          |                                  |
| Best Practices                  | _pending_          |                                  |
| SEO                             | _pending_          |                                  |
| FCP                             | _pending_          |                                  |
| LCP                             | _pending_          | target after migration < 2.5 s   |
| TBT                             | _pending_          | target after migration < 300 ms  |
| CLS                             | _pending_          | target after migration < 0.1     |
| Speed Index                     | _pending_          |                                  |
| JS transferred (mobile, gzip)   | _pending_          | derive from preview / build gzip |
| JS executed                     | _pending_          | from Lighthouse trace            |

> The 548 KB always-hydrated chunk is the root cause and the primary thing this migration removes from public pages.

---

## 0b. Route classification

Legend — _Bundle contribution_ assumes the shared 548 KB hydration chunk loads on every current route, **plus** the route's own chunk. _Est. gain_ is the qualitative win once the route is RSC with islands only.

### Highest-priority public routes (Phase 2 — must hit 90+ mobile before proceeding)

| Route                                               | Access | Current bundle (shared + route) | Hydration today | Pure RSC?         | Needs island?                | Est. gain     |
| --------------------------------------------------- | ------ | ------------------------------- | --------------- | ----------------- | ---------------------------- | ------------- |
| `/` (home)                                          | Public | 548 KB + ~18 KB                 | Full page       | **Yes**           | Search box, favorite btn     | **Very high** |
| `/browse`                                           | Public | 548 KB + ~10 KB                 | Full page       | **Yes** (grid)    | Filters/search island        | **Very high** |
| `/search`                                           | Public | (served by browse/smart-search) | Full page       | **Yes** (results) | Search input island          | **Very high** |
| `/p/[slug]`                                         | Public | 548 KB + 16 KB                  | Full page       | **Yes**           | Buy/qty/favorite/chat island | **Very high** |
| `/s/[username]`                                     | Public | 548 KB + route                  | Full page       | **Yes**           | Follow btn island            | **Very high** |
| `/sellers`                                          | Public | 548 KB + route                  | Full page       | **Yes**           | minimal                      | **Very high** |
| `/legal/*` (8)                                      | Public | 548 KB + small                  | Full page       | **Yes**           | none                         | **Very high** |
| `/about`, `/contact`                                | Public | 548 KB + small                  | Full page       | **Yes**           | contact form island          | **Very high** |
| `sitemap.xml`, `robots.txt`, `/api/public/img/[id]` | Public | n/a (handlers)                  | n/a             | route handlers    | —                            | n/a           |

### Authenticated / interactive routes (Phases 3–6 — islands + Server Actions, not perf-critical)

| Group    | Routes                                                                                                                                                | Access        | Pure RSC?      | Needs island?        |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | -------------- | -------------------- |
| Auth     | `/auth`                                                                                                                                               | Public→auth   | Shell RSC      | Yes (form)           |
| Buyer    | `/dashboard`, `/orders`, `/orders/[id]`, `/pay/[id]`, `/wallet`, `/favorites`, `/notifications`, `/account/*`, `/menu`, `/disputes`, `/disputes/[id]` | Auth          | Shell/data RSC | Yes                  |
| Seller   | `/sell`, `/seller` + 14 children                                                                                                                      | Auth (seller) | Shell RSC      | Yes                  |
| Admin    | `/admin` + 18 children                                                                                                                                | Auth (staff)  | Shell RSC      | Yes                  |
| Chat     | `/chat`                                                                                                                                               | Auth          | Shell RSC      | Yes (polling island) |
| Redirect | `/r/[code]`                                                                                                                                           | Public        | route handler  | —                    |

**Priority order (approved): public marketplace pages first — NOT dashboards.** Phase 2 covers `/`, `/browse`, `/search`, `/p/[slug]`, `/s/[username]`, `/sellers`, `/legal/*`, `/about`, `/contact` and is gated on **90+ mobile**.

---

## 0c. Per-route bundle & hydration investigation (filled in per migrated route)

For every migrated route we record, in the phase PR and here:

| Route                                                     | JS before (shared+route) | JS after (island only) | JS transferred before→after | Hydration before→after | Lighthouse mobile before→after |
| --------------------------------------------------------- | ------------------------ | ---------------------- | --------------------------- | ---------------------- | ------------------------------ |
| _(populated Phase 2+ from build output + Vercel preview)_ |                          |                        |                             |                        |                                |

Primary objective restated: **eliminate unnecessary hydration and cut JS execution on public pages.** Target: Performance 90+, LCP < 2.5 s, TBT < 300 ms, CLS < 0.1, minimal public-page JS.

---

## 0d. Correctness gates (every phase)

Escrow, wallet/ledger, coupon redemption, stock reservation, fraud, trust, loyalty, auth/session, and payment logic must stay **functionally identical** — achieved by porting `src/lib/server/*` verbatim and reusing it. `scripts/smoke-test.ts` (≥53 checks) stays green every phase. Migration sentinel behavior preserved.

## 0e. Verification gates (must all pass before advancing a phase)

1. `tsc --noEmit` clean · 2. `eslint` 0 errors · 3. `next build` succeeds · 4. smoke test passes · 5. **Vercel preview deploy succeeds** · 6. **mobile PageSpeed/Lighthouse recorded in this file** (Phase 2 must be 90+).

---

## 1. Why we're migrating

The current app is TanStack Start (React SPA + SSR). Every public page ships and **fully hydrates** a ~535 KB framework bundle, which caps mobile Lighthouse at ~33–45 even against an empty DB. The fix is **React Server Components**: render public pages on the server with near‑zero client JS and hydrate only small interactive islands. Target: **90+ mobile** on `/`, `/browse`, `/p/[slug]`, `/s/[username]`, `/sellers`, `/legal/*`, and scale to 100k+ products.

## 2. Current architecture — coupling analysis (the load-bearing finding)

I audited every `@tanstack/*` import across the server layers:

| Layer                                                                                                                                                  | Framework coupling                                                                                              | Action                                                                                                                                             |
| ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/server/*.server.ts` (15 files: db, lifecycle, money, auth, core, search, fraud, loyalty, trust, coupons, cache, rate-limit, growth, seed, ai) | **None — except `auth.server.ts`** (`getCookie`/`setCookie`/`deleteCookie` from `@tanstack/react-start/server`) | **Port verbatim.** Only `auth.server.ts` needs a 3-line cookie-adapter swap.                                                                       |
| `src/lib/api/*.ts` (25 files, ~185 `createServerFn` definitions)                                                                                       | **All** wrap logic in `createServerFn({...}).handler()` with a zod `inputValidator`                             | **Rewrite the wrapper, keep the body.** GET reads → call server core directly from RSC; POST mutations → Server Actions. zod schemas reused as-is. |
| `src/routes/*` (TanStack file routes)                                                                                                                  | All (`createFileRoute`)                                                                                         | **Rewrite** into `app/`.                                                                                                                           |
| `src/router.tsx`, `src/server.ts`, `src/start.ts`, `routeTree.gen.ts`                                                                                  | All (Start/Nitro/Cloudflare wiring)                                                                             | **Replace** with Next config + `app/layout.tsx` + `middleware.ts`.                                                                                 |
| `src/components/*`, `src/hooks/*`, `src/lib/format.ts`, `src/lib/images.ts`, `src/lib/utils.ts`                                                        | None (pure React/TS)                                                                                            | **Port** with `"use client"` where they use state/effects/Radix; small import tweaks (`Link`, navigation).                                         |

**Implication:** the risky, valuable code (escrow, double-entry ledger, atomic stock/coupon guards, dual-engine DB, auto-migration) moves **unchanged**. The migration is concentrated in routing, the API-wrapper rewrite, and auth-cookie adaptation.

Other framework specifics found:

- `start.ts` wraps each request in `withDbRequest()` (a Cloudflare Workers I/O-scoping workaround for the postgres.js client) + security headers + error page. On Vercel/Node this scoping isn't strictly required, but we keep `withDbRequest` and call it from a Next `middleware`/per-action wrapper to preserve behavior.
- `app.server.ts#appContext()` runs `seedIfEmpty()` once per isolate and a throttled `sweepLifecycle()` (≤ every 5 min). This stays and is invoked at the top of every RSC data read / Server Action, exactly as today.
- Request metadata (IP, etc.) is **not** pulled from framework helpers in the core; rate-limit keys are caller-supplied strings. Where IP-based limiting is wanted we'll source it from `next/headers` `headers()` and pass it in.
- Security headers (`server.ts`/`start.ts`) → Next `middleware.ts` + `headers()` in `next.config`.

## 3. Target architecture

- **Next 15 App Router, RSC by default.** Public pages are Server Components that import the server core directly and `await` data in the component — no client data layer, no React Query, minimal JS.
- **Client islands** (`"use client"`) only for genuinely interactive bits: search box, favorite button, add-to-cart/checkout, chat box, dashboards, forms, admin tables. Islands talk to the server via **Server Actions** (mutations) and, where they need polling/caching, React Query calling **route handlers** or actions.
- **Server Actions** (`"use server"`) replace every POST `createServerFn`. They call the same server-core functions and reuse the same zod schemas.
- **Auth** via `next/headers` `cookies()`, wrapped in a tiny adapter so `auth.server.ts` stays otherwise identical.
- **No heavy code in public bundles** — RSC enforces this naturally; verified with `@next/bundle-analyzer`.

### Data-flow patterns

1. **Public read (RSC):** `app/p/[slug]/page.tsx` → `await appContext()` → call `getProduct(slug)` core fn → render. Zero client JS for the data.
2. **Authed read (RSC):** server component calls `currentUser()` (cookies) then core fns; redirect via `next/navigation` `redirect()` if unauthorized.
3. **Mutation:** form/island calls a Server Action → `appContext()` → zod parse → core fn → `revalidatePath()`/return result.
4. **Interactive polling island (chat, pay status):** `"use client"` + React Query → calls a route handler (`app/api/.../route.ts`) or a Server Action; same 4–5s intervals as today.

## 4. File-by-file mapping

### 4a. Routes → `app/`

**Public (RSC, zero/minimal JS — the 90+ targets):**
| Current | New |
|---|---|
| `routes/index.tsx` | `app/page.tsx` |
| `routes/browse.tsx` | `app/browse/page.tsx` (filters = client island; grid = RSC) |
| `routes/p.$slug.tsx` | `app/p/[slug]/page.tsx` (+ `generateMetadata`, JSON-LD) |
| `routes/s.$username.tsx` | `app/s/[username]/page.tsx` |
| `routes/sellers.tsx` | `app/sellers/page.tsx` |
| `routes/about.tsx`, `contact.tsx` | `app/about/page.tsx`, `app/contact/page.tsx` |
| `routes/legal.*.tsx` (8) | `app/legal/{buyer-protection,credits,escrow,fees,payouts,privacy,prohibited,terms}/page.tsx` |
| `routes/sitemap[.]xml.ts` | `app/sitemap.ts` (Next metadata route) |
| `routes/robots[.]txt.ts` | `app/robots.ts` |
| `routes/r.$code.tsx` | `app/r/[code]/route.ts` (redirect handler) |
| `routes/api/public/img.$id.ts` | `app/api/public/img/[id]/route.ts` |
| `routes/api/public/cron/follow-digest.ts` | `app/api/public/cron/follow-digest/route.ts` (Vercel Cron) |

**Interactive (client islands + Server Actions):**
| Current | New |
|---|---|
| `routes/__root.tsx` | `app/layout.tsx` (root shell, providers, fonts, global CSS) |
| `routes/auth.tsx` | `app/auth/page.tsx` |
| `routes/dashboard.tsx` | `app/dashboard/page.tsx` |
| `routes/orders.index.tsx`, `orders.$orderId.tsx` | `app/orders/page.tsx`, `app/orders/[orderId]/page.tsx` |
| `routes/pay.$orderId.tsx` | `app/pay/[orderId]/page.tsx` |
| `routes/wallet.tsx`, `favorites.tsx`, `notifications.tsx`, `menu.tsx`, `sell.tsx` | `app/{wallet,favorites,notifications,menu,sell}/page.tsx` |
| `routes/chat.tsx` | `app/chat/page.tsx` |
| `routes/disputes.tsx`, `disputes.$orderId.tsx` | `app/disputes/page.tsx`, `app/disputes/[orderId]/page.tsx` |
| `routes/account*.tsx` (5) | `app/account/{page,credits,following,subscriptions,affiliate}/page.tsx` |
| `routes/seller.tsx` (+ 14 `seller.*`) | `app/seller/layout.tsx` + `app/seller/**/page.tsx` |
| `routes/admin.tsx` (+ 18 `admin.*`) | `app/admin/layout.tsx` + `app/admin/**/page.tsx` |

(`seller.stock.$productId` → `app/seller/stock/[productId]/page.tsx`; `admin.products_.$id.edit` → `app/admin/products/[id]/edit/page.tsx`.)

### 4b. API layer (`src/lib/api/*.ts`, ~185 server fns) → RSC reads + Server Actions

Each file is split by HTTP method semantics. New home: `src/server/actions/<domain>.ts` (`"use server"` mutations) and `src/server/queries/<domain>.ts` (plain async fns called from RSC). zod schemas move alongside, unchanged.

| API file                                                                                                                                                                                                                  | fns                                                                            | Primary destination                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| `catalog.ts` (16)                                                                                                                                                                                                         | home, browse, product, store, facets, search, sitemap data                     | **queries** (public RSC). `quickSearch`/`searchSuggest` also exposed via route handler for the search island. |
| `orders.ts` (12)                                                                                                                                                                                                          | createOrder, getPayment, getOrder, listMyOrders, mark/confirm/cancel, disputes | **actions** (mutations) + **queries** (getOrder/listMyOrders).                                                |
| `auth.ts` (6)                                                                                                                                                                                                             | register, login, logout, getMe, updateProfile                                  | **actions**; `getMe` → query/RSC via `currentUser()`.                                                         |
| `admin.ts` (32)                                                                                                                                                                                                           | dashboard + all back-office mutations                                          | **queries** (dashboards) + **actions** (mutations). Phase 5.                                                  |
| `seller.ts` (21)                                                                                                                                                                                                          | overview, products, stock, storefront, application                             | **queries** + **actions**. Phase 4.                                                                           |
| `chat.ts` (8)                                                                                                                                                                                                             | list/get/send/presence                                                         | **actions** (send/ping) + route handler (poll). Phase 6.                                                      |
| `dashboard.ts` (2), `loyalty.ts` (2), `reviews.ts` (2), `analytics.ts` (3), `notifications.ts` (3), `risk.ts` (3)                                                                                                         | mixed                                                                          | queries + actions by method.                                                                                  |
| `credits.ts` (7), `extras.ts` (7), `follows.ts` (4), `growth.ts` (4), `i18n.ts` (6), `payments.ts` (4), `promotions.ts` (8), `subscriptions.ts` (6), `trust.ts` (8), `attachments.ts` (5), `disputes.ts` (5), `ai.ts` (8) | mixed                                                                          | queries + actions by method.                                                                                  |
| `example.functions.ts` (3)                                                                                                                                                                                                | scaffold demo                                                                  | **delete** (not used in prod paths — verify, then drop).                                                      |

Rewrite recipe (mechanical, per fn):

- `createServerFn({method:"GET"}).inputValidator(S).handler(async ({data}) => BODY)` → `export async function name(input: z.infer<typeof S>) { const data = S.parse(input); BODY }` (called from RSC).
- `createServerFn({method:"POST"})...` → `"use server"; export async function name(input) { const data = S.parse(input); BODY; revalidatePath(...) }`.
- `appContext()`, `requireUser()`, `fail()`, all core calls stay identical.

### 4c. Server core → `src/server/*` (verbatim)

All of `src/lib/server/*.server.ts` copied unchanged **except** `auth.server.ts`: introduce `src/server/cookies.ts` exporting `getCookie/setCookie/deleteCookie` backed by `next/headers` `cookies()`, and point `auth.server.ts` at it. `withDbRequest` retained; invoked from `middleware.ts` and an action wrapper.

### 4d. Components / hooks / libs

- `components/ui/*` (Radix) → mostly `"use client"` (they already are interactive); copied with `cn` import intact.
- `shell.tsx`, `mobile-bottom-nav.tsx`, `smart-search.tsx`, `chat-box.tsx`, `ai-assistant.tsx`, `product-card.tsx` (favorite button), forms, `dashboard.tsx` charts → `"use client"` islands.
- `seller-badge.tsx`, `legal-page.tsx`, static `product-card` shell → can stay RSC where no interactivity.
- `lib/format.ts`, `lib/images.ts`, `lib/utils.ts` → copied as-is.
- `hooks/use-me.ts` (presence ping + cached me) → client hook; `getMe` becomes a route handler/action. `use-locale.ts`, `use-mobile.tsx` → client.
- `Link` from `@tanstack/react-router` → `next/link`; `useNavigate`/`useSearch` → `next/navigation` (`useRouter`, `useSearchParams`, `usePathname`).

### 4e. SEO

- Per-route `export const metadata` / `generateMetadata()` (titles/descriptions/canonicals currently in route `head()`).
- JSON-LD (product/breadcrumb/FAQ/org) → `<script type="application/ld+json">` in RSC.
- `app/sitemap.ts`, `app/robots.ts`. Replace hardcoded `lovable.app` base with `NEXT_PUBLIC_SITE_URL`.

## 5. Risks & mitigations

1. **`better-sqlite3` on Vercel serverless** — native module; fine locally, not on Vercel. _Mitigation:_ prod uses Postgres (`DATABASE_URL` always set on Vercel); keep `isPostgres()` switch; `better-sqlite3` lazy-imported only when `DATABASE_URL` is unset (dev). Mark it external in `next.config` `serverExternalPackages`.
2. **postgres.js connection scoping** — the Cloudflare per-request workaround. On Vercel (Node) a small pool works; retain `withDbRequest` to avoid behavior changes; tune pool for serverless (low `max`, `idle_timeout`).
3. **Escrow/money correctness** — port `lifecycle.server.ts` + `money.server.ts` byte-for-byte; smoke test (53 checks) must stay green every phase. No logic edits.
4. **Atomic stock / coupon guards** — guarded `UPDATE ... RETURNING` preserved exactly; covered by smoke checks 9–10.
5. **Migration sentinel** — `schemaAlreadyMigrated` (currently `seller_applications.display_name`) stays; rule documented: bump when adding columns. Auto-migrate-on-boot via `appContext()` unchanged on both engines.
6. **Cookie semantics** — current `sameSite:"none"; secure:true`. Verify works on the Vercel domain; keep identical so existing sessions/flows behave the same.
7. **Server Actions + Radix forms** — ensure progressive enhancement and `useFormStatus`/`useActionState` wiring; keep toasts (sonner) on the client.
8. **Image route** — base64 in `product_images`; port to a Node-runtime route handler (`atob` works) with same cache headers.
9. **Two apps in one repo during transition** — keep TanStack app fully working until Phase 7. Next lives under `app/` + `next.config.ts`; we run Next's build for previews and keep `vite` scripts until cutover. (Confirm with maintainer whether to scaffold Next in-place or in a subdir — see open question.)

## 6. Phases (one PR each)

- **0. Plan** — this file. _(awaiting approval)_
- **1. Foundation** — Next 15 + TS + Tailwind 4 + tokens/global CSS; port `src/server/*` core + shared UI; wire DB + env (`DATABASE_URL`, `STOCK_ENCRYPTION_KEY`, `NEXT_PUBLIC_SITE_URL`); auth cookie adapter; `middleware.ts` (security headers + db scoping); Vercel preview deploys; smoke test green against ported core.
- **2. Public pages as RSC** — `/`, `/browse`, `/search`, `/p/[slug]`, `/s/[username]`, `/sellers`, `/legal/*`, `/about`, `/contact` + SEO/metadata/JSON-LD/sitemap/robots/img, all driven by `NEXT_PUBLIC_SITE_URL`. **MEASURE Lighthouse on the Vercel preview; confirm 90+ mobile before continuing.**
- **3. Auth + buyer** — register/login/logout/sessions; account, orders, checkout/pay (Server Actions).
- **4. Seller** — dashboard, product create/manage, stock, storefront, verification/application.
- **5. Admin** — all back-office tooling.
- **6. Chat + the rest** — chat, disputes, wallet/withdrawals, loyalty, affiliate, payments registry, notifications.
- **7. Cutover** — redirects, full buyer/seller/admin QA, point domain at Vercel, retire vite/Start build.

**Per-phase verification:** `tsc --noEmit`, `eslint` (0 errors), `next build`, `scripts/smoke-test.ts` (≥53 checks), and `pagespeed.web.dev` mobile on the Vercel preview.

## 7. Testing

- **Smoke test** (`scripts/smoke-test.ts`) imports the server core directly (no HTTP) — runs unchanged against `src/server/*`; extend per phase. Stays the correctness backbone for escrow/money/stock/coupon/cache.
- **Lighthouse/PageSpeed** mobile on each preview; Phase 2 is the gate (90+).
- Manual journey QA at Phase 7 across buyer/seller/admin.

## 8. Open questions for maintainer

1. **Repo layout:** scaffold Next **in-place** in this repo (run both builds during transition) or in a `next/` subdirectory until cutover? (Recommend in-place with `app/` + keep `vite.config.ts` until Phase 7.)
2. **Canonical domain / `NEXT_PUBLIC_SITE_URL`** for sitemap/canonicals/OG (currently `warm-trade-space.lovable.app`).
3. **Realtime chat:** keep polling (simplest, matches today) or move to SSE/websockets in Phase 6?
4. Confirm Vercel project + that `DATABASE_URL` (Supabase) and `STOCK_ENCRYPTION_KEY` will be set as Vercel env vars.

## 9. Progress checklist

- [x] Phase 0 — MIGRATION.md — **APPROVED 2026-06-14**
- [ ] Phase 1 — Foundation + server core + Vercel preview
- [ ] Phase 2 — Public RSC pages + SEO + **Lighthouse 90+ mobile**
- [ ] Phase 3 — Auth + buyer + checkout/pay
- [ ] Phase 4 — Seller
- [ ] Phase 5 — Admin
- [ ] Phase 6 — Chat, disputes, wallet, loyalty, affiliate, payments, notifications
- [ ] Phase 7 — Cutover

https://claude.ai/code/session_01W9tmNVFtccFioiZuheVjeL
