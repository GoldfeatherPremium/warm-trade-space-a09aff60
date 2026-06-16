# DATABASE_AUDIT.md — X-VAULT Marketplace

Data layer: dual-engine in `src/lib/server/db.server.ts` — Postgres (`DATABASE_URL`, postgres.js) or SQLite fallback. Schema in `schemaSql()` (`:375-717`) + additive `migrate()` (`:719-1356`). Query map built from `src/server/actions/**` and `src/server/queries/**`. Query plans were **not** executed (no live DB) → scan/index conclusions are inferred from SQL + DDL and marked **UNVERIFIED** where stated.

## 1. Connection pool / exhaustion
**File:** `db.server.ts:135-155` (`makePgClient`)
```ts
postgres(DATABASE_URL, { max: 5, prepare: false, idle_timeout: 5, max_lifetime: 60, ... })
```
- **`max: 5` per isolate.** On Vercel with many concurrent lambdas this both starves a single hot instance *and*, multiplied across isolates, can exhaust a small Postgres `max_connections` if not behind a transaction-mode pooler. The comment says to point `DATABASE_URL` at a pooler — correct, but `max:5` is low for a 10k-orders/day target.
- `prepare: false` is required for PgBouncer transaction mode (correct) but forgoes prepared-statement caching.
- `idle_timeout: 5s`, `max_lifetime: 60s` cause frequent reconnects → TCP/TLS churn under steady load.
**Recommend:** `max: 15–20` (tune to pooler capacity), `idle_timeout: 20–30`, `max_lifetime: 300`; keep `prepare:false` only if behind PgBouncer txn mode.

## 2. Missing indexes on hot paths (UNVERIFIED via EXPLAIN, inferred from query filters)
Cross-referencing the query map against created indexes (`schemaSql` + `migrate`):

| Table | Filter/sort seen in code | Index exists? | Recommendation |
|---|---|---|---|
| `withdrawals` | `where user_id = ? and created_at > ?` (`wallet.ts:35`, `seller.ts:811`) | only `(status,created_at)` + `(status)` | `create index idx_withdrawals_user on withdrawals(user_id, created_at)` |
| `deposits` | listed/aggregated by `user_id`; `where order_id=?` indexed | `(order_id)`,`(order_id,created_at)` only | `create index idx_deposits_user on deposits(user_id, created_at)` |
| `referral_attributions` | `where user_id = ?` (PK) | PK ok | ok |
| `referral_clicks` | `(referral_id,created_at)` | yes | ok |
| `seller_follows` | `(seller_id)`,`(user_id,created_at)` | yes | ok |
| `subscription_slots` | `where buyer_id=?` (`account.ts:105`) | only `(product_id,status)` | `create index idx_subslots_buyer on subscription_slots(buyer_id)` |
| `product_images` | `where seller_id=? and created_at>?` (rate limit, `seller.ts:438`) | only `(product_id,sort)` | `create index idx_product_images_seller on product_images(seller_id, created_at)` |
| `credit_ledger` | `(user_id,created_at)` | yes | ok |
| `reviews` | `(seller_id,created_at)`,`(product_id,...)` | yes | ok |

Most order/product/notification hot paths **are** well-indexed (an extensive index set was already added in `migrate()` `:1126-1215`, incl. `pg_trgm` GIN for search and SQLite FTS5). The gaps above are the notable omissions.

## 3. Schema risks
- **Large base64 blobs stored as `text`:** `product_images.data` (`migrate` `:963-973`), `order_attachments.data` (`:930-947`), `stock_items.content_encrypted`, `subscription_slots.credentials_encrypted`. At 50k products × multiple images, image bytes inline in the row store cause severe table bloat, TOAST overhead, and slow `select *` list queries that don't project the blob out. **Recommend:** move binaries to object storage (R2/Supabase Storage), keep only a key/URL. (See PERFORMANCE/SCALABILITY.)
- **`image_key` vs `product_images`** dual representation — confirm no `select *` pulls `data` into list endpoints.
- **Timestamps as epoch-ms bigint, money as cents bigint:** consistent and sound.

## 4. Foreign keys & referential integrity
- FKs declared throughout `schemaSql` (e.g. `orders.buyer_id references users(id)`), good. **But almost no `ON DELETE` behavior** is specified (only `push_subscriptions ... on delete cascade`, `:1318`). Deleting/ banning users is done by flagging (`is_banned`), not deleting, so orphans are unlikely in practice — acceptable, but document it.
- SQLite enforces FKs (`pragma foreign_keys = ON`, `:66`); Postgres enforces natively.

## 5. Migration strategy risks
- **No version table / no down migrations.** Schema evolves by a long list of `alter table ... add column` each wrapped in `.catch(()=>{})` (`migrate` `:850-851`) which **silently swallows all errors**, not just "already exists". A genuinely failing column add (type mismatch, constraint conflict) is invisible.
- **Sentinel-based "already migrated" gate** keyed on one column `users.store_banner_url` (`:228-248, 269-277`). If that column exists but a *later* additive change failed, the gate short-circuits and the DB is silently behind. Works, but fragile.
- `ensureBaseCategories` runs every cold start (`:285-286`) — one extra `select slug from categories` per isolate boot; cheap but unbounded with isolate count.
- Concurrent-create races on Postgres are handled by swallowing duplicate-object SQLSTATEs (`:46-52`) — reasonable given no advisory lock behind a pooler.
**Recommend:** introduce a `schema_migrations(version)` table and only swallow the specific duplicate codes (already done for DDL via `isDuplicateObjectError`) — apply the same narrow catch to `addColumns` instead of `catch(()=>{})`.

## 6. Transactions & locking
- `tx()` Postgres: real `BEGIN` via `sql.begin` + `AsyncLocalStorage` (`:213-221`). SQLite: single connection serialized by a promise-chain mutex (`:82-100`).
- **No `SELECT ... FOR UPDATE` anywhere.** Wallet/credit mutations rely on `set col = col ± ?` atomicity (safe) **except** the check-then-update flows that read first and conditionally update (`txWithdrawalHold`, `txCreditSpend`, `txEscrowRelease` reads `pending` then subtracts). Under Postgres READ COMMITTED these have a TOCTOU window → see SECURITY C3 / FRAUD #2. SQLite's mutex masks this in dev only.
**Recommend:** conditional `WHERE balance >= ?` + affected-row assertion, or `FOR UPDATE` on the wallet row.

## 7. Scale simulation (UNVERIFIED — analytical, no EXPLAIN run)
- **50k products / 100k users:** with the existing composite indexes + pg_trgm, browse/search/order queries should hold sub-100ms *provided* list endpoints never select the base64 blob columns. The base64 bloat is the dominant risk to table/cache size.
- **1M users:** pool `max:5` + per-isolate pools is the first ceiling; the SSE polling query (`app/api/events/route.ts`) and inline per-order risk scoring (7 queries, `fraud.server.ts`) become the dominant DB load. Move images out of Postgres before this scale.

## 8. Recommended index DDL (safe, additive)
```sql
create index if not exists idx_withdrawals_user on withdrawals(user_id, created_at);
create index if not exists idx_deposits_user    on deposits(user_id, created_at);
create index if not exists idx_subslots_buyer    on subscription_slots(buyer_id);
create index if not exists idx_product_images_seller on product_images(seller_id, created_at);
```
