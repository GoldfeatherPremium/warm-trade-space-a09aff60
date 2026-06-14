# X-VAULT — TanStack Start → Next.js (App Router + RSC) Migration Plan

**Status:** Phase 0 (plan) — awaiting approval before any execution.
**Branch:** `claude/nextjs-migration` (from `main`). One PR per phase.
**Target host:** Vercel. **DB:** Postgres (Supabase) via `DATABASE_URL`; SQLite for local dev (existing dual-engine layer).

---

## 1. Why we're migrating

The current app is TanStack Start (React SPA + SSR). Every public page ships and **fully hydrates** a ~535 KB framework bundle, which caps mobile Lighthouse at ~33–45 even against an empty DB. The fix is **React Server Components**: render public pages on the server with near‑zero client JS and hydrate only small interactive islands. Target: **90+ mobile** on `/`, `/browse`, `/p/[slug]`, `/s/[username]`, `/sellers`, `/legal/*`, and scale to 100k+ products.

## 2. Current architecture — coupling analysis (the load-bearing finding)

I audited every `@tanstack/*` import across the server layers:

| Layer | Framework coupling | Action |
|---|---|---|
| `src/lib/server/*.server.ts` (15 files: db, lifecycle, money, auth, core, search, fraud, loyalty, trust, coupons, cache, rate-limit, growth, seed, ai) | **None — except `auth.server.ts`** (`getCookie`/`setCookie`/`deleteCookie` from `@tanstack/react-start/server`) | **Port verbatim.** Only `auth.server.ts` needs a 3-line cookie-adapter swap. |
| `src/lib/api/*.ts` (25 files, ~185 `createServerFn` definitions) | **All** wrap logic in `createServerFn({...}).handler()` with a zod `inputValidator` | **Rewrite the wrapper, keep the body.** GET reads → call server core directly from RSC; POST mutations → Server Actions. zod schemas reused as-is. |
| `src/routes/*` (TanStack file routes) | All (`createFileRoute`) | **Rewrite** into `app/`. |
| `src/router.tsx`, `src/server.ts`, `src/start.ts`, `routeTree.gen.ts` | All (Start/Nitro/Cloudflare wiring) | **Replace** with Next config + `app/layout.tsx` + `middleware.ts`. |
| `src/components/*`, `src/hooks/*`, `src/lib/format.ts`, `src/lib/images.ts`, `src/lib/utils.ts` | None (pure React/TS) | **Port** with `"use client"` where they use state/effects/Radix; small import tweaks (`Link`, navigation). |

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

| API file | fns | Primary destination |
|---|---|---|
| `catalog.ts` (16) | home, browse, product, store, facets, search, sitemap data | **queries** (public RSC). `quickSearch`/`searchSuggest` also exposed via route handler for the search island. |
| `orders.ts` (12) | createOrder, getPayment, getOrder, listMyOrders, mark/confirm/cancel, disputes | **actions** (mutations) + **queries** (getOrder/listMyOrders). |
| `auth.ts` (6) | register, login, logout, getMe, updateProfile | **actions**; `getMe` → query/RSC via `currentUser()`. |
| `admin.ts` (32) | dashboard + all back-office mutations | **queries** (dashboards) + **actions** (mutations). Phase 5. |
| `seller.ts` (21) | overview, products, stock, storefront, application | **queries** + **actions**. Phase 4. |
| `chat.ts` (8) | list/get/send/presence | **actions** (send/ping) + route handler (poll). Phase 6. |
| `dashboard.ts` (2), `loyalty.ts` (2), `reviews.ts` (2), `analytics.ts` (3), `notifications.ts` (3), `risk.ts` (3) | mixed | queries + actions by method. |
| `credits.ts` (7), `extras.ts` (7), `follows.ts` (4), `growth.ts` (4), `i18n.ts` (6), `payments.ts` (4), `promotions.ts` (8), `subscriptions.ts` (6), `trust.ts` (8), `attachments.ts` (5), `disputes.ts` (5), `ai.ts` (8) | mixed | queries + actions by method. |
| `example.functions.ts` (3) | scaffold demo | **delete** (not used in prod paths — verify, then drop). |

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

1. **`better-sqlite3` on Vercel serverless** — native module; fine locally, not on Vercel. *Mitigation:* prod uses Postgres (`DATABASE_URL` always set on Vercel); keep `isPostgres()` switch; `better-sqlite3` lazy-imported only when `DATABASE_URL` is unset (dev). Mark it external in `next.config` `serverExternalPackages`.
2. **postgres.js connection scoping** — the Cloudflare per-request workaround. On Vercel (Node) a small pool works; retain `withDbRequest` to avoid behavior changes; tune pool for serverless (low `max`, `idle_timeout`).
3. **Escrow/money correctness** — port `lifecycle.server.ts` + `money.server.ts` byte-for-byte; smoke test (53 checks) must stay green every phase. No logic edits.
4. **Atomic stock / coupon guards** — guarded `UPDATE ... RETURNING` preserved exactly; covered by smoke checks 9–10.
5. **Migration sentinel** — `schemaAlreadyMigrated` (currently `seller_applications.display_name`) stays; rule documented: bump when adding columns. Auto-migrate-on-boot via `appContext()` unchanged on both engines.
6. **Cookie semantics** — current `sameSite:"none"; secure:true`. Verify works on the Vercel domain; keep identical so existing sessions/flows behave the same.
7. **Server Actions + Radix forms** — ensure progressive enhancement and `useFormStatus`/`useActionState` wiring; keep toasts (sonner) on the client.
8. **Image route** — base64 in `product_images`; port to a Node-runtime route handler (`atob` works) with same cache headers.
9. **Two apps in one repo during transition** — keep TanStack app fully working until Phase 7. Next lives under `app/` + `next.config.ts`; we run Next's build for previews and keep `vite` scripts until cutover. (Confirm with maintainer whether to scaffold Next in-place or in a subdir — see open question.)

## 6. Phases (one PR each)

- **0. Plan** — this file. *(awaiting approval)*
- **1. Foundation** — Next 15 + TS + Tailwind 4 + tokens/global CSS; port `src/server/*` core + shared UI; wire DB + env (`DATABASE_URL`, `STOCK_ENCRYPTION_KEY`, `NEXT_PUBLIC_SITE_URL`); auth cookie adapter; `middleware.ts` (security headers + db scoping); Vercel preview deploys; smoke test green against ported core.
- **2. Public pages as RSC** — home, browse, product, store, sellers, legal + SEO/metadata/JSON-LD/sitemap/robots/img. **MEASURE Lighthouse on the Vercel preview; confirm 90+ mobile before continuing.**
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
- [ ] Phase 0 — MIGRATION.md (this PR) — **awaiting approval**
- [ ] Phase 1 — Foundation + server core + Vercel preview
- [ ] Phase 2 — Public RSC pages + SEO + **Lighthouse 90+ mobile**
- [ ] Phase 3 — Auth + buyer + checkout/pay
- [ ] Phase 4 — Seller
- [ ] Phase 5 — Admin
- [ ] Phase 6 — Chat, disputes, wallet, loyalty, affiliate, payments, notifications
- [ ] Phase 7 — Cutover

https://claude.ai/code/session_01W9tmNVFtccFioiZuheVjeL
