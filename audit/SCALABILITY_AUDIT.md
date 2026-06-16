# SCALABILITY_AUDIT.md — X-VAULT Marketplace

Question: can the architecture serve 100k / 500k / 1M users? Verdict per tier with the binding constraints. Analytical (no load test run) → **UNVERIFIED** where noted.

## Architecture summary
- Next.js 15 App Router on serverless (Vercel implied by `vercel.json`, `lovable.app` domain in automod allowlist `core.server.ts:190`).
- Dual DB engine; production = Postgres via `DATABASE_URL` behind a pooler (`db.server.ts`).
- Stateless app tier (sessions in DB), per-isolate connection pool + per-isolate in-memory caches/rate-limits.

## Binding constraints, in the order they bite

1. **Base64 images in Postgres (P1/DB§3)** — *bites first.* Primary DB balloons to tens of GB, hurting backups, cache hit ratio, and any list query that touches the blob. **Must** move to object storage before ~50k products. **Severity: blocker for scale.**

2. **DB connection model (`max:5` per isolate, `idle_timeout:5s`)** — at 100k users with bursty serverless concurrency, either single-isolate starvation or pooler/Postgres connection pressure. Needs pooler sizing + higher `max` + longer idle. **Severity: high at 100k+.**

3. **SSE presence polling (P2)** — O(concurrent users) held connections + 1 query/20s each. At 500k users / tens of thousands concurrent this is a dedicated load source and ties up serverless invocations. **Severity: high at 500k+.** Replace with pub/sub or push.

4. **Inline per-order risk scoring (P3, 7 queries)** — scales with order volume (10k/day target is fine; 100k/day strains). **Severity: medium.**

5. **Per-isolate state (rate limits, caches)** — correctness degrades horizontally: rate limits are effectively `limit × isolates` and reset on cold start (SECURITY H3). Shared store (Redis) needed for real enforcement at scale. **Severity: medium (security-relevant).**

6. **Search corpus rebuild per isolate every 60s** (`search.server.ts:79-96`) — grows with active catalog; fine to ~50k, revisit beyond. **Severity: low/medium.**

7. **Migration on cold start** — `ensureBaseCategories` + sentinel check per isolate boot (`db.server.ts:285`, `:269-277`); cheap but a tiny per-boot tax that multiplies with isolate count. **Severity: low.**

## Tier verdicts
- **100k users:** Feasible **after** fixing the money-path correctness bugs (SECURITY C1–C3) and raising the pool size. Image-in-DB is tolerable but should already be migrating. Money correctness, not raw scale, is the real blocker at this tier.
- **500k users:** Requires: object storage for images, SSE→pub/sub or push, shared rate-limit/cache (Redis), pooler tuned, risk scoring partially deferred.
- **1M users:** Requires all of the above plus read replicas / query-path review (EXPLAIN-driven), search moved to a dedicated index (pg_trgm may not suffice; consider a search service), and async pipelines for analytics roll-ups (admin analytics issues multiple full-period aggregates, `admin.ts:1288-1352`).

## Stateless-tier positives
- Sessions in DB (not memory) → app tier scales horizontally cleanly.
- Idempotent, concurrency-tolerant migrations.
- Strong index groundwork already laid for orders/products.

## Capacity actions (priority)
1. Images → object storage + CDN.
2. Pool sizing + pooler.
3. SSE → pub/sub / web-push; denormalized unread counts.
4. Redis-backed rate limiting + shared caches.
5. Defer heavy fraud/analytics aggregation.
6. EXPLAIN-driven query review at a seeded 50k/100k dataset (replaces UNVERIFIED).
