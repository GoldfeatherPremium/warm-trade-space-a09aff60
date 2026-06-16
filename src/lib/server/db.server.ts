import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import { BASE_CATEGORIES } from "./categories.server";

/**
 * Dual-engine data layer.
 *
 *  - DATABASE_URL set (e.g. a Supabase Postgres connection string)  → postgres.js
 *  - otherwise → local SQLite file via better-sqlite3 (zero-config dev)
 *
 * One async interface for both:
 *   q(sql, params)  → all rows        q1(sql, params) → first row | undefined
 *   run(sql, params)→ void            tx(fn)          → serialized transaction
 *
 * SQL is written once in a portable dialect: `?` placeholders (translated to
 * $1..$n for Postgres), integer 0/1 flags, epoch-ms bigint timestamps.
 */

type Params = ReadonlyArray<string | number | null>;

interface Engine {
  q<T>(sql: string, params?: Params): Promise<T[]>;
  run(sql: string, params?: Params): Promise<void>;
  exec(sql: string): Promise<void>;
  tx<T>(fn: () => Promise<T>): Promise<T>;
}

let engine: Engine | null = null;
let migrated: Promise<void> | null = null;

/** True once migrate() confirms FTS5 is available on SQLite. */
export let sqliteFts5 = false;

function isPostgres(): boolean {
  return !!process.env.DATABASE_URL;
}

// Postgres SQLSTATEs meaning "this object already exists" — i.e. another
// concurrent cold-start isolate created it first, which is the desired end
// state. `create table/index if not exists` is NOT atomic on Postgres: two
// isolates can both pass the existence check then collide, throwing 23505
// (duplicate pg_type) / 42P07 (duplicate_table) / 42710 (duplicate_object) /
// 42P06 (duplicate_schema) / 42P07. Swallowing these makes concurrent
// migration safe WITHOUT a session-level advisory lock — which is unreliable
// behind a transaction-mode pooler (PgBouncer / Neon pooled / Supabase pooler).
const DUPLICATE_OBJECT_CODES = new Set(["23505", "42P07", "42710", "42P06"]);
export function isDuplicateObjectError(e: unknown): boolean {
  const code = (e as { code?: string } | null)?.code;
  if (code && DUPLICATE_OBJECT_CODES.has(code)) return true;
  const msg = (e as Error | null)?.message?.toLowerCase() ?? "";
  return msg.includes("already exists") || msg.includes("duplicate key value");
}

// Benign during the additive `alter table ... add column` pass: the column
// already exists (re-run / concurrent isolate), OR the target table is created
// later in migrate() than the alter that references it (existing ordering
// quirk). Postgres: 42701 duplicate_column, 42P01 undefined_table. SQLite:
// "duplicate column name", "no such table". Everything else must surface.
function isBenignMigrationError(e: unknown): boolean {
  if (isDuplicateObjectError(e)) return true;
  const code = (e as { code?: string } | null)?.code;
  if (code === "42701" || code === "42P01") return true;
  const msg = (e as Error | null)?.message?.toLowerCase() ?? "";
  return (
    msg.includes("duplicate column") ||
    msg.includes("no such table") ||
    msg.includes("does not exist")
  );
}

// ---------------------------------------------------------------------------
// SQLite engine (local development / single-server deployments)
// ---------------------------------------------------------------------------
async function createSqliteEngine(): Promise<Engine> {
  const { default: Database } = await import("better-sqlite3");
  const { existsSync, mkdirSync } = await import("node:fs");
  const path = await import("node:path");
  const dataDir = process.env.DATA_DIR ?? path.join(process.cwd(), "data");
  const dbPath = process.env.DB_PATH ?? path.join(dataDir, "marketplace.db");
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
  const d = new Database(dbPath);
  d.pragma("journal_mode = WAL");
  d.pragma("foreign_keys = ON");

  // single shared connection: serialize async transactions with a mutex
  let txChain: Promise<unknown> = Promise.resolve();
  let txDepth = 0;

  return {
    async q<T>(sql: string, params: Params = []) {
      return d.prepare(sql).all(...params) as T[];
    },
    async run(sql: string, params: Params = []) {
      d.prepare(sql).run(...params);
    },
    async exec(sql: string) {
      d.exec(sql);
    },
    tx<T>(fn: () => Promise<T>): Promise<T> {
      if (txDepth > 0) return fn(); // join the outer transaction
      const job = txChain.then(async () => {
        txDepth++;
        d.exec("begin");
        try {
          const result = await fn();
          d.exec("commit");
          return result;
        } catch (e) {
          d.exec("rollback");
          throw e;
        } finally {
          txDepth--;
        }
      });
      txChain = job.catch(() => undefined);
      return job as Promise<T>;
    },
  };
}

// ---------------------------------------------------------------------------
// Postgres engine (Supabase or any Postgres via DATABASE_URL)
// ---------------------------------------------------------------------------
type PgSql = {
  unsafe: (sql: string, params?: unknown[]) => Promise<unknown[]>;
  begin: <T>(fn: (tx: PgSql) => Promise<T>) => Promise<T>;
  end: (opts?: { timeout?: number }) => Promise<void>;
};

const pgTxStore = new AsyncLocalStorage<PgSql>();
// Per-request postgres client cache. On Cloudflare Workers, I/O objects
// (TCP sockets) created during one request cannot be reused in another, so we
// scope the client to the current request via AsyncLocalStorage. Clients
// created outside a scope are one-shot and closed after use.
const pgRequestStore = new AsyncLocalStorage<{ sql: PgSql | null }>();
// Persistent, isolate-scoped connection pool used when there is NO request
// scope (the Next.js App Router never calls withDbRequest). Reusing one pool
// for the isolate's lifetime — instead of opening and tearing down a pool per
// query — eliminates per-query TCP+TLS connection churn, which is the dominant
// cost and the first thing to exhaust Postgres / the connection pooler at high
// request volume. postgres.js manages the pool via max / idle_timeout /
// max_lifetime. Point DATABASE_URL at a transaction-mode pooler in production.
let sharedPg: PgSql | null = null;
let migratedFlag = false;
let baseCategoriesEnsured: Promise<number> | null = null;

function toPgPlaceholders(sql: string): string {
  let n = 0;
  return sql.replace(/\?/g, () => `$${++n}`);
}

async function makePgClient(): Promise<PgSql> {
  const { default: postgres } = await import("postgres");
  const numericOids = [20, 1700];
  return postgres(process.env.DATABASE_URL!, {
    max: 5,
    prepare: false,
    idle_timeout: 5,
    max_lifetime: 60,
    types: Object.fromEntries(
      numericOids.map((oid) => [
        `num${oid}`,
        {
          to: oid,
          from: [oid],
          serialize: (x: unknown) => String(x),
          parse: (x: string) => Number(x),
        },
      ]),
    ),
  }) as unknown as PgSql;
}

async function getPgClient(): Promise<{ sql: PgSql; oneShot: boolean }> {
  const tx = pgTxStore.getStore();
  if (tx) return { sql: tx, oneShot: false };
  const slot = pgRequestStore.getStore();
  if (slot) {
    if (!slot.sql) slot.sql = await makePgClient();
    return { sql: slot.sql, oneShot: false };
  }
  // No request scope (Next.js RSC / route handlers): reuse the isolate-scoped
  // pool rather than a one-shot client. Never end() it — it lives for the
  // isolate so subsequent queries/requests skip the connect handshake.
  if (!sharedPg) sharedPg = await makePgClient();
  return { sql: sharedPg, oneShot: false };
}

/** Wrap a server handler so the postgres client is request-scoped.
 * We do NOT await sql.end() — closing the TCP socket can take seconds on
 * Cloudflare Workers and would delay the response. The isolate's GC handles
 * cleanup; postgres.js has idle_timeout/max_lifetime as a backstop. */
export async function withDbRequest<T>(fn: () => Promise<T>): Promise<T> {
  const slot: { sql: PgSql | null } = { sql: null };
  try {
    return await pgRequestStore.run(slot, fn);
  } finally {
    if (slot.sql) {
      void slot.sql.end({ timeout: 1 }).catch(() => {});
    }
  }
}

async function createPostgresEngine(): Promise<Engine> {
  return {
    async q<T>(text: string, params: Params = []) {
      const { sql, oneShot } = await getPgClient();
      try {
        return (await sql.unsafe(toPgPlaceholders(text), params as unknown[])) as T[];
      } finally {
        if (oneShot) await sql.end({ timeout: 1 }).catch(() => {});
      }
    },
    async run(text: string, params: Params = []) {
      const { sql, oneShot } = await getPgClient();
      try {
        await sql.unsafe(toPgPlaceholders(text), params as unknown[]);
      } finally {
        if (oneShot) await sql.end({ timeout: 1 }).catch(() => {});
      }
    },
    async exec(text: string) {
      const { sql, oneShot } = await getPgClient();
      try {
        await sql.unsafe(text);
      } finally {
        if (oneShot) await sql.end({ timeout: 1 }).catch(() => {});
      }
    },
    async tx<T>(fn: () => Promise<T>): Promise<T> {
      if (pgTxStore.getStore()) return fn();
      const { sql, oneShot } = await getPgClient();
      try {
        return (await sql.begin((txSql) => pgTxStore.run(txSql, fn))) as T;
      } finally {
        if (oneShot) await sql.end({ timeout: 1 }).catch(() => {});
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
async function schemaAlreadyMigrated(e: Engine): Promise<boolean> {
  // Sentinel: bump whenever you add new tables/columns to migrate() so
  // production databases pick up changes on the next cold start. Currently
  // points at users.store_banner_url (seller storefront columns).
  try {
    if (isPostgres()) {
      const r = await e.q<{ c: number }>(
        `select count(*)::int as c from information_schema.columns
         where table_schema = 'public' and table_name = 'users'
           and column_name = 'store_banner_url'`,
      );
      return !!r[0] && Number(r[0].c) > 0;
    }
    const r = await e.q<{ c: number }>(
      `select count(*) as c from pragma_table_info('users') where name = 'store_banner_url'`,
    );
    return !!r[0] && Number(r[0].c) > 0;
  } catch {
    return false;
  }
}

async function getEngine(): Promise<Engine> {
  if (!engine) {
    // Fail fast if a production *runtime* has no DATABASE_URL — a silent SQLite
    // fallback in serverless means data is written to an ephemeral disk and lost.
    // Skip during `next build` (NEXT_PHASE=phase-production-build): prerendering
    // has no DB and is already handled by per-query graceful fallbacks.
    if (
      process.env.NODE_ENV === "production" &&
      process.env.NEXT_PHASE !== "phase-production-build" &&
      !process.env.DATABASE_URL
    ) {
      throw new Error(
        "DATABASE_URL is required in production. SQLite is only suitable for local development. " +
          "Set DATABASE_URL to a Postgres connection string (e.g. Supabase, Neon, Railway).",
      );
    }
    engine = await (isPostgres() ? createPostgresEngine() : createSqliteEngine());
  }
  if (isPostgres()) {
    if (!migratedFlag) {
      // Sentinel check short-circuits once any isolate has migrated, so this
      // runs only against a fresh DB. The migrate DDL itself tolerates the
      // concurrent-create race (see migrate()), so no cross-isolate advisory
      // lock is needed — important because session-level locks are unreliable
      // behind a transaction-mode pooler (Neon pooled / PgBouncer).
      if (!(await schemaAlreadyMigrated(engine))) await migrate(engine);
      migratedFlag = true;
    }
  } else {
    if (!migrated) migrated = migrate(engine);
    await migrated;
  }
  // Additive taxonomy backfill — runs once per process, independent of the
  // migration sentinel, so live databases pick up new base categories on the
  // next cold start without ever touching admin-customised ones.
  if (!baseCategoriesEnsured) baseCategoriesEnsured = ensureBaseCategories(engine);
  await baseCategoriesEnsured;
  return engine;
}

/**
 * Idempotently insert any missing base categories (keyed by slug). Never
 * updates, renames, reorders or deletes existing rows — admins keep full
 * control via /admin/categories. Uses the engine directly to avoid re-entering
 * getEngine() while it is still resolving.
 */
async function ensureBaseCategories(e: Engine): Promise<number> {
  let inserted = 0;
  try {
    const existing = await e.q<{ slug: string }>(`select slug from categories`);
    const have = new Set(existing.map((r) => r.slug));
    for (const c of BASE_CATEGORIES) {
      if (have.has(c.slug)) continue;
      await e.run(
        `insert into categories (id, name, slug, icon, sort, default_warranty_hours, commission_pct, risk_tier, is_active)
         values (?,?,?,?,?,?,?,?,1)`,
        [
          randomUUID(),
          c.name,
          c.slug,
          c.icon,
          c.sort,
          c.defaultWarrantyHours,
          c.commissionPct,
          c.riskTier,
        ],
      );
      inserted++;
    }
  } catch (err) {
    // Non-fatal: never block DB access if the categories table isn't ready yet.
    console.error("[db] ensureBaseCategories failed:", (err as Error)?.message);
  }
  return inserted;
}

/** On-demand additive backfill, e.g. from the admin categories screen. */
export async function ensureBaseCategoriesNow(): Promise<number> {
  return ensureBaseCategories(await getEngine());
}

export async function q<T = Record<string, unknown>>(sql: string, params?: Params): Promise<T[]> {
  try {
    return await (await getEngine()).q<T>(sql, params);
  } catch (e) {
    // Params are intentionally omitted — they may contain password_hash, session tokens,
    // or other credentials that must never appear in logs.
    console.error("[db] q failed:", (e as Error)?.message, "sql:", sql.slice(0, 200));
    throw e;
  }
}

export async function q1<T = Record<string, unknown>>(
  sql: string,
  params?: Params,
): Promise<T | undefined> {
  return (await q<T>(sql, params))[0];
}

export async function run(sql: string, params?: Params): Promise<void> {
  try {
    return await (await getEngine()).run(sql, params);
  } catch (e) {
    console.error("[db] run failed:", (e as Error)?.message, "sql:", sql.slice(0, 200));
    throw e;
  }
}

export async function tx<T>(fn: () => Promise<T>): Promise<T> {
  return (await getEngine()).tx(fn);
}

export function resetDbForTests() {
  engine = null;
  migrated = null;
  migratedFlag = false;
  baseCategoriesEnsured = null;
  if (sharedPg) void sharedPg.end({ timeout: 1 }).catch(() => {});
  sharedPg = null;
}

// ---------------------------------------------------------------------------
// Schema — portable DDL applied on first boot (idempotent). The same schema
// ships as supabase/migrations/0001_init.sql for the Supabase SQL editor.
// ---------------------------------------------------------------------------
export function schemaSql(dialect: "sqlite" | "postgres"): string {
  const pk =
    dialect === "postgres"
      ? "bigint generated always as identity primary key"
      : "integer primary key autoincrement";
  const big = dialect === "postgres" ? "bigint" : "integer";
  const real = dialect === "postgres" ? "double precision" : "real";
  return `
  create table if not exists users (
    id text primary key,
    email text unique not null,
    username text unique not null,
    password_hash text not null,
    role text not null default 'buyer',
    seller_status text not null default 'none',
    seller_level integer not null default 1,
    rating ${real} not null default 0,
    rating_count integer not null default 0,
    total_sales integer not null default 0,
    completion_rate ${real} not null default 100,
    is_banned integer not null default 0,
    wallet_frozen integer not null default 0,
    vacation_mode integer not null default 0,
    created_at ${big} not null
  );

  create table if not exists sessions (
    token text primary key,
    user_id text not null references users(id),
    expires_at ${big} not null,
    created_at ${big} not null
  );

  create table if not exists seller_applications (
    id text primary key,
    user_id text not null references users(id),
    full_name text not null,
    country text not null,
    experience text not null,
    usdt_payout_address text not null,
    usdt_network text not null,
    status text not null default 'pending',
    admin_note text,
    reviewed_by text,
    created_at ${big} not null,
    reviewed_at ${big}
  );

  create table if not exists categories (
    id text primary key,
    name text not null,
    slug text unique not null,
    icon text,
    sort integer not null default 0,
    default_warranty_hours integer not null default 72,
    commission_pct ${real} not null default 8,
    risk_tier text not null default 'normal',
    is_active integer not null default 1
  );

  create table if not exists products (
    id text primary key,
    seller_id text not null references users(id),
    category_id text not null references categories(id),
    title text not null,
    slug text unique not null,
    description text not null,
    image_key text,
    delivery_type text not null,
    delivery_sla_minutes integer not null default 60,
    warranty_hours integer,
    price_cents ${big} not null,
    min_qty integer not null default 1,
    max_qty integer not null default 100,
    stock_count integer not null default 0,
    status text not null default 'pending_review',
    reject_reason text,
    region text,
    platform text,
    required_info text,
    views integer not null default 0,
    sold_count integer not null default 0,
    created_at ${big} not null
  );

  create table if not exists stock_items (
    id text primary key,
    product_id text not null references products(id),
    content_encrypted text not null,
    content_hash text not null,
    status text not null default 'available',
    order_id text,
    delivered_at ${big},
    created_at ${big} not null
  );
  create index if not exists idx_stock_product on stock_items(product_id, status);

  create table if not exists orders (
    id text primary key,
    order_no text unique not null,
    buyer_id text not null references users(id),
    seller_id text not null references users(id),
    product_id text not null references products(id),
    product_title text not null,
    image_key text,
    qty integer not null,
    unit_price_cents ${big} not null,
    total_cents ${big} not null,
    commission_pct ${real} not null,
    commission_cents ${big} not null,
    seller_net_cents ${big} not null,
    status text not null default 'awaiting_payment',
    delivery_type text not null,
    delivery_sla_minutes integer not null default 60,
    warranty_hours integer not null,
    buyer_info text,
    cancel_reason text,
    paid_at ${big},
    delivered_at ${big},
    completed_at ${big},
    warranty_ends_at ${big},
    released_at ${big},
    auto_confirm_at ${big},
    expires_at ${big},
    created_at ${big} not null
  );
  create index if not exists idx_orders_buyer on orders(buyer_id, created_at);
  create index if not exists idx_orders_seller on orders(seller_id, created_at);
  create index if not exists idx_orders_status on orders(status);

  create table if not exists order_deliveries (
    id text primary key,
    order_id text not null references orders(id),
    type text not null,
    payload text,
    note text,
    delivered_by text,
    created_at ${big} not null
  );

  create table if not exists deposits (
    id text primary key,
    order_id text references orders(id),
    user_id text not null references users(id),
    amount_cents ${big} not null,
    network text not null,
    pay_address text not null,
    tx_hash text,
    confirmations integer not null default 0,
    status text not null default 'pending',
    expires_at ${big},
    created_at ${big} not null
  );

  create table if not exists wallets (
    user_id text primary key references users(id),
    available_cents ${big} not null default 0,
    pending_cents ${big} not null default 0,
    frozen_cents ${big} not null default 0
  );

  create table if not exists wallet_ledger (
    id ${pk},
    user_id text not null,
    order_id text,
    type text not null,
    amount_cents ${big} not null,
    balance_after_cents ${big} not null,
    note text,
    created_at ${big} not null
  );
  create index if not exists idx_ledger_user on wallet_ledger(user_id, created_at);

  create table if not exists withdrawals (
    id text primary key,
    user_id text not null references users(id),
    amount_cents ${big} not null,
    fee_cents ${big} not null,
    address text not null,
    network text not null,
    status text not null default 'pending',
    tx_hash text,
    reviewed_by text,
    created_at ${big} not null,
    reviewed_at ${big}
  );

  create table if not exists conversations (
    id text primary key,
    order_id text references orders(id),
    product_id text references products(id),
    buyer_id text not null references users(id),
    seller_id text not null references users(id),
    buyer_last_read_at ${big} not null default 0,
    seller_last_read_at ${big} not null default 0,
    last_message_at ${big},
    created_at ${big} not null
  );
  create index if not exists idx_conv_buyer on conversations(buyer_id);
  create index if not exists idx_conv_seller on conversations(seller_id);

  create table if not exists messages (
    id text primary key,
    conversation_id text not null references conversations(id),
    sender_id text,
    body text not null,
    is_system integer not null default 0,
    is_flagged integer not null default 0,
    flag_reason text,
    moderated_at ${big},
    moderated_by text,
    created_at ${big} not null
  );
  create index if not exists idx_msg_conv on messages(conversation_id, created_at);

  create table if not exists disputes (
    id text primary key,
    order_id text unique not null references orders(id),
    opened_by text not null,
    reason text not null,
    description text,
    seller_response text,
    status text not null default 'open',
    resolution text,
    resolution_cents ${big},
    resolved_by text,
    created_at ${big} not null,
    resolved_at ${big}
  );

  create table if not exists reviews (
    id text primary key,
    order_id text unique not null references orders(id),
    buyer_id text not null,
    seller_id text not null,
    product_id text not null,
    rating integer not null,
    comment text,
    seller_reply text,
    created_at ${big} not null
  );
  create index if not exists idx_reviews_seller on reviews(seller_id, created_at);
  create index if not exists idx_reviews_product on reviews(product_id, created_at);

  create table if not exists notifications (
    id text primary key,
    user_id text not null,
    type text not null,
    title text not null,
    body text,
    link text,
    read_at ${big},
    created_at ${big} not null
  );
  create index if not exists idx_notif_user on notifications(user_id, created_at);

  create table if not exists audit_logs (
    id ${pk},
    actor_id text,
    action text not null,
    entity text,
    entity_id text,
    meta text,
    created_at ${big} not null
  );

  create table if not exists site_settings (
    id integer primary key check (id = 1),
    default_commission_pct ${real} not null default 8,
    withdrawal_fee_cents ${big} not null default 100,
    min_withdrawal_cents ${big} not null default 1000,
    auto_confirm_hours integer not null default 48,
    payment_window_minutes integer not null default 30,
    maintenance_mode integer not null default 0
  );
  insert into site_settings (id) values (1) on conflict (id) do nothing;

  create table if not exists favorites (
    user_id text not null references users(id),
    product_id text not null references products(id),
    created_at ${big} not null,
    primary key (user_id, product_id)
  );

  create index if not exists idx_products_status on products(status, sold_count);
  create index if not exists idx_products_seller on products(seller_id, status);
  create index if not exists idx_deposits_order on deposits(order_id);
  create index if not exists idx_conv_order on conversations(order_id);
  create index if not exists idx_disputes_status on disputes(status);
  create index if not exists idx_withdrawals_status on withdrawals(status, created_at);
  create index if not exists idx_sessions_user on sessions(user_id);
  create index if not exists idx_sessions_expires on sessions(expires_at);

  create table if not exists catalog_items (
    id text primary key,
    name text not null,
    slug text unique not null,
    is_active integer not null default 1,
    sort integer not null default 0,
    created_at ${big} not null
  );

  -- allowed sub-categories per item (no rows = all categories allowed)
  create table if not exists catalog_item_categories (
    item_id text not null references catalog_items(id),
    category_id text not null references categories(id),
    primary key (item_id, category_id)
  );

  create table if not exists item_suggestions (
    id text primary key,
    user_id text not null references users(id),
    name text not null,
    note text,
    status text not null default 'pending',
    admin_note text,
    reviewed_by text,
    created_at ${big} not null,
    reviewed_at ${big}
  );

  create table if not exists product_variants (
    id text primary key,
    product_id text not null references products(id),
    title text not null,
    price_cents ${big} not null,
    sort integer not null default 0
  );
  create index if not exists idx_variants_product on product_variants(product_id);

  create table if not exists coupons (
    id text primary key,
    code text unique not null,
    pct_off ${real} not null,
    min_total_cents ${big} not null default 0,
    max_uses integer not null default 0,
    used_count integer not null default 0,
    expires_at ${big},
    is_active integer not null default 1,
    created_at ${big} not null
  );
  `;
}

async function migrate(e: Engine): Promise<void> {
  const dialect = isPostgres() ? "postgres" : "sqlite";
  if (dialect === "postgres") {
    // strip line comments first (a ";" inside a comment would corrupt the split)
    const cleaned = schemaSql("postgres")
      .split("\n")
      .filter((line) => !line.trim().startsWith("--"))
      .join("\n");
    // Run statements one by one so partial application is idempotent. Swallow
    // "already exists" races: a concurrent isolate may have created the same
    // object between our `if not exists` check and execution. Any other error
    // (a genuinely broken statement) still propagates.
    for (const stmt of cleaned.split(";")) {
      const s = stmt.trim();
      if (s)
        await e.exec(s).catch((err) => {
          if (!isDuplicateObjectError(err)) throw err;
        });
    }
  } else {
    await e.exec(schemaSql("sqlite"));
  }
  // additive columns for databases created before these features existed
  const big = dialect === "postgres" ? "bigint" : "integer";
  const real = dialect === "postgres" ? "double precision" : "real";
  const addColumns = [
    `alter table orders add column discount_cents ${big} not null default 0`,
    `alter table orders add column coupon_code text`,
    `alter table site_settings add column announcement text`,
    `alter table products add column item_id text`,
    `alter table products add column expires_at ${big}`,
    `alter table products add column insurance_days integer not null default 0`,
    `alter table orders add column variant_title text`,
    // --- Seller trust system ---
    `alter table users add column verification_tier text not null default 'unverified'`,
    `alter table users add column trust_score ${real} not null default 0`,
    `alter table users add column refund_count integer not null default 0`,
    `alter table users add column dispute_count integer not null default 0`,
    `alter table users add column avg_delivery_minutes integer not null default 0`,
    // --- Phase 3: explicit escrow state machine ---
    `alter table orders add column escrow_status text not null default 'none'`,
    `alter table orders add column escrow_hold_reason text`,
    `alter table orders add column escrow_hold_by text`,
    `alter table orders add column escrow_hold_at ${big}`,
    // --- Phase 5: dispute evidence vault & thread ---
    `alter table disputes add column priority text not null default 'normal'`,
    `alter table disputes add column staff_owner text`,
    `alter table disputes add column last_activity_at ${big} not null default 0`,
    // --- Phase 6: subscription sharing & digital goods ---
    `alter table products add column product_kind text not null default 'one_time'`,
    `alter table products add column subscription_provider text`,
    `alter table products add column subscription_cycle_days integer not null default 30`,
    `alter table products add column subscription_seats_total integer not null default 1`,
    `alter table products add column download_size_mb integer not null default 0`,
    // --- Phase 7: international expansion (locale, currency, region gating) ---
    `alter table users add column country text`,
    `alter table users add column locale text not null default 'en'`,
    `alter table users add column preferred_currency text not null default 'USD'`,
    `alter table products add column allowed_countries text`,
    `alter table products add column blocked_countries text`,
    `alter table site_settings add column base_currency text not null default 'USD'`,
    // --- Phase 11: seller promotions ---
    `alter table coupons add column seller_id text`,
    `alter table coupons add column product_id text`,
    `alter table coupons add column label text`,
    `alter table products add column sale_price_cents ${big}`,
    `alter table products add column sale_ends_at ${big}`,
    // --- Phase 12: sponsored / featured placement (paid or admin-granted) ---
    `alter table products add column featured_until ${big}`,
    // --- Phase 9: buyer loyalty engine ---
    `alter table users add column lifetime_spend_cents ${big} not null default 0`,
    `alter table users add column loyalty_tier text not null default 'bronze'`,
    `alter table users add column loyalty_tier_at ${big}`,
    // --- Phase 2: presence (online dots in chat) ---
    `alter table users add column last_seen_at ${big} not null default 0`,
    // --- Phase 5: buyer credits (refunds + promos go here, not into wallet cash) ---
    `alter table orders add column credits_applied_cents ${big} not null default 0`,
    `alter table withdrawals add column from_credits integer not null default 0`,
    // Four-eyes payout control: records the staff member who approved, so a
    // different staff member is required to mark the withdrawal sent.
    `alter table withdrawals add column approved_by text`,
    // --- Phase 6: frozen product snapshot for order proof ---
    `alter table orders add column product_snapshot text`,
    // --- Phase 4: per-category submission schema + product custom attrs + admin SEO copy ---
    `alter table categories add column submission_schema text`,
    `alter table products add column category_attrs text`,
    `alter table products add column admin_seo_description text`,
    // --- Phase 8: global configurability sweep ---
    `alter table site_settings add column credit_withdrawal_fee_pct ${real} not null default 2`,
    `alter table site_settings add column credit_withdrawal_min_fee_cents ${big} not null default 100`,
    `alter table site_settings add column attachment_max_mb integer not null default 5`,
    `alter table site_settings add column presence_ping_seconds integer not null default 60`,
    `alter table site_settings add column low_stock_threshold integer not null default 5`,
    `alter table site_settings add column dispute_sla_hours integer not null default 72`,
    // --- Phase 8 round 2: automod severity + chat rate limit knob ---
    `alter table site_settings add column chat_rate_limit_per_min integer not null default 20`,
    `alter table site_settings add column automod_severity text not null default 'block'`,
    // --- Phase 1: staff-only seller contact channels (for compliance / payout) ---
    `alter table seller_verifications add column contact_phone text`,
    `alter table seller_verifications add column contact_whatsapp text`,
    `alter table seller_verifications add column contact_telegram text`,
    // --- Seller application: richer onboarding (business profile, track record,
    // reachable contact channels). All nullable for backward compatibility. ---
    `alter table seller_applications add column display_name text`,
    `alter table seller_applications add column years_experience text`,
    `alter table seller_applications add column product_categories text`,
    `alter table seller_applications add column source_of_goods text`,
    `alter table seller_applications add column monthly_volume text`,
    `alter table seller_applications add column portfolio text`,
    `alter table seller_applications add column telegram text`,
    `alter table seller_applications add column whatsapp text`,
    `alter table seller_applications add column wechat text`,
    // --- Phase 13: admin-configurable category + per-product subscription / delivery / stock ---
    `alter table categories add column requires_subscription integer not null default 0`,
    `alter table categories add column allowed_durations text not null default ''`,
    `alter table categories add column admin_description text`,
    `alter table categories add column delivery_kind text not null default 'code'`,
    `alter table products add column subscription_duration text`,
    `alter table products add column max_orders_at_once integer not null default 10`,
    `alter table products add column manual_stock integer`,
    `alter table stock_items add column locked_at ${big}`,
    `alter table order_deliveries add column locked_at ${big}`,
    // --- Seller storefront (banner/logo/description/socials/announcement) +
    // response-time metric. Queried by getSellerStoreData / saveStorefrontAction
    // but were never created in migrate() — added here so the storefront works
    // on fresh databases. (Sentinel bumped to store_banner_url below.)
    `alter table users add column store_banner_url text`,
    `alter table users add column store_logo_url text`,
    `alter table users add column store_description text`,
    `alter table users add column store_socials text`,
    `alter table users add column store_announcement text`,
    `alter table users add column avg_response_minutes integer not null default 0`,
  ];

  for (const stmt of addColumns) {
    // Swallow ONLY benign races (column already exists) and the ordering quirk
    // where a few alters reference tables created later in this same function
    // (missing table). Any other error — syntax, type mismatch, constraint —
    // now propagates instead of being silently lost.
    await e.exec(stmt).catch((err) => {
      if (!isBenignMigrationError(err)) throw err;
    });
  }
  await e
    .exec(
      `create table if not exists subscription_slots (
        id text primary key,
        product_id text not null,
        seller_id text not null,
        label text not null,
        credentials_encrypted text not null,
        status text not null default 'available',
        buyer_id text,
        order_id text,
        started_at ${big},
        expires_at ${big},
        created_at ${big} not null
      )`,
    )
    .catch(() => {});
  await e
    .exec(
      `create index if not exists idx_subscription_slots on subscription_slots(product_id, status)`,
    )
    .catch(() => {});

  await e
    .exec(
      `create table if not exists seller_verifications (
        id text primary key,
        user_id text not null references users(id),
        tier_requested text not null,
        legal_name text not null,
        country text not null,
        business_name text,
        business_registration text,
        id_doc_ref text,
        notes text,
        status text not null default 'pending',
        reviewed_by text,
        admin_note text,
        created_at ${big} not null,
        reviewed_at ${big}
      )`,
    )
    .catch(() => {});

  // --- Phase 5: Buyer credit balances + ledger ---
  await e
    .exec(
      `create table if not exists buyer_credits (
        user_id text primary key references users(id),
        balance_cents ${big} not null default 0,
        updated_at ${big} not null default 0
      )`,
    )
    .catch(() => {});
  await e
    .exec(
      `create table if not exists credit_ledger (
        id ${dialect === "postgres" ? "bigint generated always as identity primary key" : "integer primary key autoincrement"},
        user_id text not null,
        order_id text,
        type text not null,
        amount_cents ${big} not null,
        balance_after_cents ${big} not null,
        source text,
        note text,
        actor_id text,
        created_at ${big} not null
      )`,
    )
    .catch(() => {});
  await e
    .exec(`create index if not exists idx_credit_ledger_user on credit_ledger(user_id, created_at)`)
    .catch(() => {});

  // --- Phase 6: Order attachments (delivery proof, before/after, dispute evidence) ---
  await e
    .exec(
      `create table if not exists order_attachments (
        id text primary key,
        order_id text not null references orders(id),
        uploader_id text not null references users(id),
        uploader_role text not null,
        kind text not null,
        mime text not null,
        data text not null,
        note text,
        created_at ${big} not null
      )`,
    )
    .catch(() => {});
  await e
    .exec(
      `create index if not exists idx_order_attachments on order_attachments(order_id, created_at)`,
    )
    .catch(() => {});

  await e
    .exec(
      `create table if not exists fx_rates (
        currency text primary key,
        rate_to_base ${real} not null,
        symbol text,
        updated_at ${big} not null
      )`,
    )
    .catch(() => {});

  // --- Phase 12: seller-uploaded product images (multiple per listing) ---
  await e
    .exec(
      `create table if not exists product_images (
        id text primary key,
        product_id text,
        seller_id text not null,
        mime text not null,
        data text not null,
        sort integer not null default 0,
        created_at ${big} not null
      )`,
    )
    .catch(() => {});
  await e
    .exec(`create index if not exists idx_product_images on product_images(product_id, sort)`)
    .catch(() => {});

  // --- Phase 2: search analytics ---
  await e
    .exec(
      `create table if not exists search_queries (
        id ${dialect === "postgres" ? "bigint generated always as identity primary key" : "integer primary key autoincrement"},
        query text not null,
        user_id text,
        results integer not null default 0,
        clicked_product_id text,
        created_at ${big} not null
      )`,
    )
    .catch(() => {});
  await e
    .exec(`create index if not exists idx_search_queries_query on search_queries(query)`)
    .catch(() => {});
  await e
    .exec(`create index if not exists idx_search_queries_created on search_queries(created_at)`)
    .catch(() => {});
  await e
    .exec(`create index if not exists idx_favorites_product on favorites(product_id)`)
    .catch(() => {});

  // --- Phase 4: Affiliate / Referrals ---
  await e
    .exec(
      `create table if not exists referrals (
        id text primary key,
        owner_user_id text not null references users(id),
        code text unique not null,
        commission_pct ${real} not null default 5.0,
        click_count integer not null default 0,
        signup_count integer not null default 0,
        purchase_count integer not null default 0,
        earnings_cents ${big} not null default 0,
        created_at ${big} not null
      )`,
    )
    .catch(() => {});
  await e
    .exec(`create index if not exists idx_referrals_owner on referrals(owner_user_id)`)
    .catch(() => {});
  await e
    .exec(
      `create table if not exists referral_clicks (
        id ${dialect === "postgres" ? "bigint generated always as identity primary key" : "integer primary key autoincrement"},
        referral_id text not null,
        fingerprint text,
        user_agent text,
        country text,
        created_at ${big} not null
      )`,
    )
    .catch(() => {});
  await e
    .exec(
      `create index if not exists idx_referral_clicks_ref on referral_clicks(referral_id, created_at)`,
    )
    .catch(() => {});
  await e
    .exec(
      `create table if not exists referral_attributions (
        user_id text primary key references users(id),
        referral_id text not null,
        attributed_at ${big} not null
      )`,
    )
    .catch(() => {});
  // --- Phase 4: Vault dedup index on stock content hash ---
  await e
    .exec(`create index if not exists idx_stock_hash on stock_items(product_id, content_hash)`)
    .catch(() => {});

  // --- Trust Engine: per-seller score history (daily snapshots) ---
  await e
    .exec(
      `create table if not exists seller_trust_history (
        id ${dialect === "postgres" ? "bigint generated always as identity primary key" : "integer primary key autoincrement"},
        user_id text not null,
        score ${real} not null,
        seller_level integer not null,
        total_sales integer not null,
        captured_at ${big} not null
      )`,
    )
    .catch(() => {});
  await e
    .exec(
      `create index if not exists idx_trust_history_user on seller_trust_history(user_id, captured_at)`,
    )
    .catch(() => {});

  // --- Seller follows (buyers subscribe to a seller's storefront) ---
  await e
    .exec(
      `create table if not exists seller_follows (
        user_id text not null,
        seller_id text not null,
        created_at ${big} not null,
        primary key (user_id, seller_id)
      )`,
    )
    .catch(() => {});
  await e
    .exec(`create index if not exists idx_follows_seller on seller_follows(seller_id)`)
    .catch(() => {});
  await e
    .exec(`create index if not exists idx_follows_user on seller_follows(user_id, created_at)`)
    .catch(() => {});

  // --- Phase 14: Fraud rules engine — risk events recorded per order ---
  await e
    .exec(
      `create table if not exists risk_events (
        id ${dialect === "postgres" ? "bigint generated always as identity primary key" : "integer primary key autoincrement"},
        user_id text,
        seller_id text,
        order_id text,
        kind text not null,
        score integer not null,
        band text not null,
        reasons text not null,
        action text not null,
        created_at ${big} not null
      )`,
    )
    .catch(() => {});
  await e
    .exec(`create index if not exists idx_risk_user on risk_events(user_id, created_at)`)
    .catch(() => {});
  await e
    .exec(`create index if not exists idx_risk_order on risk_events(order_id)`)
    .catch(() => {});
  await e
    .exec(`create index if not exists idx_risk_created on risk_events(created_at)`)
    .catch(() => {});

  // --- Phase 14: Follow digest watermark (per-user last-sent) ---
  await e
    .exec(
      `create table if not exists follow_digest_state (
        user_id text primary key,
        last_sent_at ${big} not null,
        last_count integer not null default 0
      )`,
    )
    .catch(() => {});

  // --- Phase 12: index for featured-product sort hot-path ---
  await e
    .exec(`create index if not exists idx_products_featured on products(featured_until)`)
    .catch(() => {});

  // --- Phase C (perf audit): additional hot-path indexes ---
  await e
    .exec(
      `create index if not exists idx_products_category_status on products(category_id, status, created_at)`,
    )
    .catch(() => {});
  await e
    .exec(`create index if not exists idx_products_active_created on products(status, created_at)`)
    .catch(() => {});
  await e
    .exec(`create index if not exists idx_audit_created on audit_logs(created_at)`)
    .catch(() => {});
  await e
    .exec(`create index if not exists idx_notif_user_read on notifications(user_id, read_at)`)
    .catch(() => {});
  await e
    .exec(`create index if not exists idx_reviews_product_rating on reviews(product_id, rating)`)
    .catch(() => {});

  // --- Phase D (perf audit): time-range scans on the homepage pulse,
  // admin/seller order & user listings, and analytics roll-ups ---
  await e
    .exec(`create index if not exists idx_orders_created on orders(created_at)`)
    .catch(() => {});
  await e.exec(`create index if not exists idx_orders_paid on orders(paid_at)`).catch(() => {});
  await e.exec(`create index if not exists idx_users_created on users(created_at)`).catch(() => {});
  // orders(order_id, created_at) for deposit lookups with ORDER BY created_at DESC
  await e
    .exec(`create index if not exists idx_deposits_order_created on deposits(order_id, created_at)`)
    .catch(() => {});
  // composite filter used by PUBLIC_SELLER_COND in every browse / homepage query
  await e
    .exec(
      `create index if not exists idx_users_seller_filter on users(seller_status, is_banned, vacation_mode)`,
    )
    .catch(() => {});
  // status + created_at scans used by admin pulse, recent-sales, and order listings
  await e
    .exec(`create index if not exists idx_orders_status_created on orders(status, created_at)`)
    .catch(() => {});

  // --- Lifecycle sweep hot-path + dispute/seller covering indexes ---
  // sweepLifecycle scans orders by (status, expires_at/auto_confirm_at/warranty_ends_at)
  // and products by (status, expires_at); without these each sweep is a full scan.
  await e
    .exec(`create index if not exists idx_orders_sweep_expires on orders(status, expires_at)`)
    .catch(() => {});
  await e
    .exec(`create index if not exists idx_orders_sweep_confirm on orders(status, auto_confirm_at)`)
    .catch(() => {});
  await e
    .exec(`create index if not exists idx_orders_sweep_release on orders(status, warranty_ends_at)`)
    .catch(() => {});
  await e
    .exec(`create index if not exists idx_products_sweep_expires on products(status, expires_at)`)
    .catch(() => {});
  // disputes.order_id is hit by every dispute lookup (orders, queries, lifecycle, trust)
  await e
    .exec(`create index if not exists idx_disputes_order on disputes(order_id)`)
    .catch(() => {});
  // seller dashboard order counts filter by (seller_id, status)
  await e
    .exec(`create index if not exists idx_orders_seller_status on orders(seller_id, status)`)
    .catch(() => {});

  // --- Phase E (perf audit): full-text search acceleration ---
  // Product search runs `lower(col) like '%term%'`, whose leading wildcard a
  // btree index can't serve — a full table scan as the catalog grows. On
  // Postgres, pg_trgm GIN indexes let the planner satisfy those LIKE scans
  // from an index. SQLite keeps the sequential LIKE (fine at its scale).
  // Extension/index creation is best-effort: a host without pg_trgm simply
  // falls back to the scan rather than failing boot.
  if (dialect === "postgres") {
    await e.exec(`create extension if not exists pg_trgm`).catch(() => {});
    await e
      .exec(
        `create index if not exists idx_products_title_trgm on products using gin (lower(title) gin_trgm_ops)`,
      )
      .catch(() => {});
    await e
      .exec(
        `create index if not exists idx_products_desc_trgm on products using gin (lower(description) gin_trgm_ops)`,
      )
      .catch(() => {});
  }

  // --- SQLite FTS5 full-text search ---
  // Postgres gets pg_trgm GIN indexes (above); SQLite gets a standalone FTS5
  // virtual table kept in sync via row-level triggers. All three operations
  // use .catch(() => {}) so a host compiled without the fts5 extension falls
  // back gracefully to the existing LIKE scan rather than failing boot.
  if (dialect === "sqlite") {
    const ftsOk = await e
      .exec(
        `create virtual table if not exists products_fts using fts5(
           product_id unindexed, title, description, platform, tokenize='unicode61'
         )`,
      )
      .then(() => true)
      .catch(() => false);
    if (ftsOk) {
      sqliteFts5 = true;
      // Idempotent backfill — only inserts rows not already indexed
      await e
        .exec(
          `insert into products_fts(product_id, title, description, platform)
             select id, coalesce(title,''), coalesce(description,''), coalesce(platform,'')
             from products where id not in (select product_id from products_fts)`,
        )
        .catch(() => {});
      await e
        .exec(
          `create trigger if not exists fts_products_ai after insert on products begin
             insert into products_fts(product_id,title,description,platform)
               values(new.id,coalesce(new.title,''),coalesce(new.description,''),coalesce(new.platform,''));
           end`,
        )
        .catch(() => {});
      await e
        .exec(
          `create trigger if not exists fts_products_au after update on products begin
             delete from products_fts where product_id=old.id;
             insert into products_fts(product_id,title,description,platform)
               values(new.id,coalesce(new.title,''),coalesce(new.description,''),coalesce(new.platform,''));
           end`,
        )
        .catch(() => {});
      await e
        .exec(
          `create trigger if not exists fts_products_ad after delete on products begin
             delete from products_fts where product_id=old.id;
           end`,
        )
        .catch(() => {});
    }
  }

  // --- Payment methods registry ---
  // Foundation for offering multiple checkout rails. USDT is live today; the
  // others are scaffolded as disabled "coming soon" entries whose providers
  // get configured later. Per-method `config` (JSON) holds provider keys.
  await e
    .exec(
      `create table if not exists payment_methods (
        code text primary key,
        name text not null,
        kind text not null,
        enabled integer not null default 0,
        is_default integer not null default 0,
        config text,
        sort integer not null default 0,
        created_at ${big} not null
      )`,
    )
    .catch(() => {});
  const pmSeeded = await e.q<{ c: number }>(`select count(*) as c from payment_methods`);
  if (!pmSeeded[0] || Number(pmSeeded[0].c) === 0) {
    const t = Date.now();
    const methods: Array<[string, string, string, number, number]> = [
      // code, name, kind, enabled, is_default
      ["usdt", "USDT (crypto)", "crypto", 1, 1],
      ["wallet", "X-VAULT wallet balance", "wallet", 1, 0],
      ["credits", "Store credits", "wallet", 1, 0],
      ["card", "Credit / Debit Card", "card", 0, 0],
      ["paypal", "PayPal", "ewallet", 0, 0],
      ["alipay", "Alipay", "ewallet", 0, 0],
      ["wechat_pay", "WeChat Pay", "ewallet", 0, 0],
      ["skrill", "Skrill", "ewallet", 0, 0],
    ];
    let sort = 0;
    for (const [code, name, kind, enabled, isDefault] of methods) {
      await e
        .run(
          `insert into payment_methods (code, name, kind, enabled, is_default, sort, created_at)
           values (?,?,?,?,?,?,?)`,
          [code, name, kind, enabled, isDefault, sort++, t],
        )
        .catch(() => {});
    }
  }

  // --- PWA: web push subscriptions ---
  await e
    .exec(
      `create table if not exists push_subscriptions (
        id text primary key,
        user_id text not null references users(id) on delete cascade,
        endpoint text not null unique,
        p256dh text not null,
        auth text not null,
        created_at ${big} not null
      )`,
    )
    .catch(() => {});
  await e
    .exec(`create index if not exists idx_push_subs_user on push_subscriptions(user_id)`)
    .catch(() => {});

  // seed a sane default set if empty
  const seeded = await e.q<{ c: number }>(`select count(*) as c from fx_rates`);
  if (!seeded[0] || Number(seeded[0].c) === 0) {
    const t = Date.now();
    const seed: Array<[string, number, string]> = [
      ["USD", 1, "$"],
      ["EUR", 0.92, "€"],
      ["GBP", 0.79, "£"],
      ["BRL", 5.4, "R$"],
      ["INR", 83.5, "₹"],
      ["NGN", 1550, "₦"],
      ["RUB", 92, "₽"],
      ["IDR", 16000, "Rp"],
      ["PHP", 57, "₱"],
      ["TRY", 32, "₺"],
    ];
    for (const [c, r, s] of seed) {
      await e
        .run(`insert into fx_rates (currency, rate_to_base, symbol, updated_at) values (?,?,?,?)`, [
          c,
          r,
          s,
          t,
        ])
        .catch(() => {});
    }
  }
}
