# PERFORMANCE_AUDIT.md — X-VAULT Marketplace

Next.js 15 App Router, React 19, Tailwind v4. Findings from static review; real bundle/Lighthouse numbers require a production build + Chrome, which were **not** run here → those are marked **UNVERIFIED**.

## High-impact

### P1 — Images stored as base64 text in Postgres and served by a route handler
**Files:** `product_images.data` (`db.server.ts:963-973`), served via `app/api/public/img/[id]/route.ts` (`atob` decode per request). **Impact:** (a) huge row/TOAST bloat; (b) every image is a dynamic Node route hit (`runtime` Node, no CDN origin for the bytes) instead of a static/CDN asset; (c) risk that list queries select the `data` column. **Fix:** offload to object storage + CDN; keep next/image. **Quantify:** 50k products × ~3 imgs × ~150KB base64 ≈ tens of GB inside the primary DB.

### P2 — SSE long-poll runs a correlated DB query per connection every 20s
**File:** `app/api/events/route.ts:27-57`. Each connected user → one correlated `notifications`+`messages`/`conversations` subquery every 20s for 55s, then reconnect. At 10k concurrent users that is ~500 queries/sec of pure presence polling on top of real traffic, plus 10k held Node connections (each serverless invocation occupied). **Fix:** Redis pub/sub or a denormalized `unread_count` column updated on write; widen poll interval; or push via web-push (already wired, `push.server.ts`).

### P3 — Inline fraud scoring on the payment hot path
**File:** `src/lib/server/fraud.server.ts:29-127`. `assessOrderRisk` issues ~7 sequential `q1` queries synchronously during payment confirmation. Adds latency + DB load to the most important conversion step. **Fix:** keep the cheap signals inline, defer the heavier velocity aggregates to an async job; cache per-buyer risk for a short TTL.

### P4 — Connection pool `max: 5`, aggressive idle/lifetime
`db.server.ts:139`. See DATABASE_AUDIT §1 — under-provisioned and reconnect-churny for the target scale.

## Medium

### P5 — Three Google font families, many weights
**File:** `app/layout.tsx:7-26`. Archivo Black (1) + Inter (4 weights) + JetBrains Mono (3 weights) all self-hosted via `next/font`. `display:swap` is set (good) and next/font subsets+inlines, but this is a lot of font CSS/glyph payload on first paint. **Fix:** drop unused weights; consider loading JetBrains Mono only on routes that use it.

### P6 — 66 client components
`grep "use client"` → 66 files under `app/`. Several dashboards pull heavy client libs (`recharts`, `embla-carousel`, `cmdk`, `vaul`, `react-day-picker`). **UNVERIFIED** per-route JS weight without a build. **Fix:** `next/dynamic` for charts/carousels/command-menu so they're not in the initial bundle; verify with `@next/bundle-analyzer`.

### P7 — Per-process caches are correct but isolate-local
Settings cache 30s (`core.server.ts:154-165`), search suggestion corpus 60s (`search.server.ts:77-96`). Fine and cheap, but each isolate recomputes; the suggestion corpus query `union`s all active product titles every 60s per isolate — grows with catalog. **Fix:** cap corpus size / move to a materialized suggestions table at scale.

### P8 — Search uses leading-wildcard `LIKE '%term%'`
`search.server.ts:36-44`. A btree can't serve leading wildcards; mitigated on Postgres by the `pg_trgm` GIN indexes added in `migrate()` (`db.server.ts:1203-1215`) and SQLite FTS5 (`:1222-1266`). Confirm the GIN index is actually used by the planner (UNVERIFIED without EXPLAIN). The per-request JS Damerau-Levenshtein over the whole corpus (`search.server.ts:102-127`) is O(corpus) per "did-you-mean".

## Good / already done
- Static asset + `_next/static` immutable caching, `_next/image` caching, AVIF/WebP, sane `deviceSizes` (`next.config.ts:39-77`).
- `serverExternalPackages` for native drivers (`next.config.ts:34`).
- Extensive hot-path index coverage for orders/products/notifications (`db.server.ts:1126-1215`).
- Sitemap is `revalidate=3600` and capped (`app/sitemap.ts:5-31`).

## Suggested measurement plan (to replace UNVERIFIED items)
1. `next build` + `@next/bundle-analyzer` for per-route JS.
2. `EXPLAIN ANALYZE` on browse/search/order-list/SSE queries against a seeded 50k-product DB.
3. Lighthouse CI on the deployed preview (see LIGHTHOUSE_AUDIT).
