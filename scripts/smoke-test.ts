/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Backend smoke test: exercises the full escrow state machine directly
 * against the server modules (no HTTP). Runs on whichever engine is
 * configured:
 *   node smoke.mjs                      → SQLite (temp file)
 *   DATABASE_URL=postgres://… node …    → Postgres (e.g. local PG / Supabase)
 */
import { rmSync } from "node:fs";

if (!process.env.DATABASE_URL) {
  process.env.DB_PATH = "/tmp/xvault-smoke.db";
  rmSync("/tmp/xvault-smoke.db", { force: true });
}

const { q, q1, run, tx, ensureBaseCategoriesNow } = await import("../src/lib/server/db.server");
const { seedIfEmpty } = await import("../src/lib/server/seed.server");
const { BASE_CATEGORIES } = await import("../src/lib/server/categories.server");
const core = await import("../src/lib/server/core.server");
const money = await import("../src/lib/server/money.server");
const lc = await import("../src/lib/server/lifecycle.server");

let passed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (!cond) {
    console.error(`✗ FAIL: ${name}`, detail ?? "");
    process.exit(1);
  }
  passed++;
  console.log(`✓ ${name}`);
}

if (process.env.DATABASE_URL) {
  // fresh schema for repeatable runs against Postgres
  await run(`drop schema public cascade`).catch(() => {});
  await run(`create schema public`).catch(() => {});
  const { resetDbForTests } = await import("../src/lib/server/db.server");
  resetDbForTests();
}
await seedIfEmpty();

const buyer = (await q1<{ id: string }>(`select id from users where username = 'demo_buyer'`))!;
const autoProduct = (await q1<any>(
  `select * from products where delivery_type = 'auto' and stock_count > 2 limit 1`,
))!;
check("seed created auto product with stock", !!autoProduct);

// --- helper replicating checkout's insert (the server fn wraps this with auth) ---
async function makeOrder(product: any, qty: number): Promise<string> {
  const orderId = core.uid();
  const total = product.price_cents * qty;
  const commission = Math.round((total * 8) / 100);
  const t = core.now();
  await tx(async () => {
    if (product.delivery_type === "auto") {
      const free = await q<{ id: string }>(
        `select id from stock_items where product_id = ? and status = 'available' limit ?`,
        [product.id, qty],
      );
      if (free.length < qty) throw new Error("no stock");
      for (const s of free)
        await run(`update stock_items set status='reserved', order_id=? where id=?`, [
          orderId,
          s.id,
        ]);
      await run(
        `update products set stock_count = (select count(*) from stock_items where product_id = ? and status = 'available') where id = ?`,
        [product.id, product.id],
      );
    }
    await run(
      `insert into orders (id, order_no, buyer_id, seller_id, product_id, product_title, qty, unit_price_cents,
        total_cents, commission_pct, commission_cents, seller_net_cents, status, delivery_type,
        delivery_sla_minutes, warranty_hours, expires_at, created_at)
       values (?,?,?,?,?,?,?,?,?,?,?,?, 'awaiting_payment', ?, 60, 72, ?, ?)`,
      [
        orderId,
        core.makeOrderNo(),
        buyer.id,
        product.seller_id,
        product.id,
        product.title,
        qty,
        product.price_cents,
        total,
        8,
        commission,
        total - commission,
        product.delivery_type,
        t + 30 * 60_000,
        t,
      ],
    );
    await run(
      `insert into deposits (id, order_id, user_id, amount_cents, network, pay_address, expires_at, created_at)
       values (?,?,?,?, 'TRC20', ?, ?, ?)`,
      [core.uid(), orderId, buyer.id, total, core.makePayAddress("TRC20"), t + 30 * 60_000, t],
    );
  });
  return orderId;
}

const stockOf = async (pid: string) =>
  (await q1<any>(`select stock_count from products where id = ?`, [pid]))!.stock_count;

// =============== 1. happy path: auto delivery → release ===============
const o1 = await makeOrder(autoProduct, 2);
const stockBefore = autoProduct.stock_count;
await lc.confirmPayment(o1);
let row = (await lc.getOrderRow(o1))!;
check("auto order delivered on payment", row.status === "delivered", row.status);

const delivery = (await q1<{ payload: string }>(
  `select payload from order_deliveries where order_id = ?`,
  [o1],
))!;
check(
  "delivery payload contains 2 decrypted codes",
  delivery.payload.split("\n").length === 2,
  delivery.payload,
);
check("codes are plaintext (not ciphertext)", !delivery.payload.includes("."), delivery.payload);
check("stock decremented by 2", (await stockOf(autoProduct.id)) === stockBefore - 2);

let sw = await money.getWallet(autoProduct.seller_id);
check("seller escrow (pending) = net", sw.pending_cents === row.seller_net_cents, sw);

await lc.completeOrder(o1, false);
row = (await lc.getOrderRow(o1))!;
check(
  "order completed, warranty running",
  row.status === "completed" && row.warranty_ends_at! > Date.now(),
);

// fast-forward warranty
await run(`update orders set warranty_ends_at = ? where id = ?`, [Date.now() - 1000, o1]);
await lc.sweepLifecycle(true);
row = (await lc.getOrderRow(o1))!;
check("escrow released after warranty", row.status === "released", row.status);
sw = await money.getWallet(autoProduct.seller_id);
check(
  "seller available = net, pending = 0",
  sw.available_cents === row.seller_net_cents && sw.pending_cents === 0,
  sw,
);

const ledgerTypes = (
  await q<any>(`select type from wallet_ledger where order_id = ? order by id`, [o1])
).map((r) => r.type);
check(
  "ledger trail: hold → release → commission",
  JSON.stringify(ledgerTypes) === JSON.stringify(["escrow_hold", "escrow_release", "commission"]),
  ledgerTypes,
);

// =============== 2. dispute → full refund ===============
const o2 = await makeOrder(autoProduct, 1);
await lc.confirmPayment(o2);
await run(`insert into disputes (id, order_id, opened_by, reason, created_at) values (?,?,?,?,?)`, [
  core.uid(),
  o2,
  buyer.id,
  "invalid_code",
  Date.now(),
]);
await run(`update orders set status = 'disputed' where id = ?`, [o2]);
const ord2 = (await lc.getOrderRow(o2))!;
await lc.refundOrder(o2, ord2.total_cents, "test refund");
// Refunds are issued to the buyer's credit balance (not spendable wallet cash).
const bc = await money.getBuyerCredits(buyer.id);
check("buyer refunded full total to credits", bc.balance_cents === ord2.total_cents, bc);
sw = await money.getWallet(autoProduct.seller_id);
check("seller pending back to 0 after refund", sw.pending_cents === 0, sw);
check("order status refunded", (await lc.getOrderRow(o2))!.status === "refunded");

// =============== 3. unpaid order expiry restores stock ===============
const o3 = await makeOrder(autoProduct, 1);
await run(`update orders set expires_at = ? where id = ?`, [Date.now() - 1000, o3]);
const stockBeforeExpiry = await stockOf(autoProduct.id);
await lc.sweepLifecycle(true);
check("unpaid order expired", (await lc.getOrderRow(o3))!.status === "expired");
check("reserved stock returned", (await stockOf(autoProduct.id)) === stockBeforeExpiry + 1);

// =============== 4. manual delivery + auto-confirm ===============
const manualProduct = (await q1<any>(
  `select * from products where delivery_type = 'manual' limit 1`,
))!;
const o4 = await makeOrder(manualProduct, 1);
await lc.confirmPayment(o4);
check("manual order → delivering on payment", (await lc.getOrderRow(o4))!.status === "delivering");
await lc.markManualDelivered(o4, manualProduct.seller_id, "Delivered in-game, screenshot attached");
check("manual order delivered", (await lc.getOrderRow(o4))!.status === "delivered");
await run(`update orders set auto_confirm_at = ? where id = ?`, [Date.now() - 1000, o4]);
await lc.sweepLifecycle(true);
check("auto-confirm kicked in", (await lc.getOrderRow(o4))!.status === "completed");

// =============== 5. partial refund ===============
const o5 = await makeOrder(manualProduct, 2);
await lc.confirmPayment(o5);
await lc.markManualDelivered(o5, manualProduct.seller_id, "partial delivery");
const ord5 = (await lc.getOrderRow(o5))!;
const sellerBefore = await money.getWallet(manualProduct.seller_id);
const buyerBefore = await money.getBuyerCredits(buyer.id);
const half = Math.round(ord5.total_cents / 2);
await lc.refundOrder(o5, half, "partial refund test");
const sellerAfter = await money.getWallet(manualProduct.seller_id);
const buyerAfter = await money.getBuyerCredits(buyer.id);
const keepGross = ord5.total_cents - half;
const keepNet = keepGross - Math.round((keepGross * ord5.commission_pct) / 100);
check(
  "partial: buyer got half as credits",
  buyerAfter.balance_cents - buyerBefore.balance_cents === half,
);
check(
  "partial: seller kept net of remainder",
  sellerAfter.available_cents - sellerBefore.available_cents === keepNet,
  {
    got: sellerAfter.available_cents - sellerBefore.available_cents,
    keepNet,
  },
);
check(
  "partial: seller pending reduced by original net",
  sellerBefore.pending_cents - sellerAfter.pending_cents === ord5.seller_net_cents,
);

// =============== 6. withdrawal hold + reversal ===============
const seller = autoProduct.seller_id;
const wBefore = await money.getWallet(seller);
await money.txWithdrawalHold(seller, 500, 100, "wd-test");
check(
  "withdrawal hold deducts amount+fee",
  (await money.getWallet(seller)).available_cents === wBefore.available_cents - 600,
);
await money.txWithdrawalReversal(seller, 500, 100, "wd-test");
check(
  "withdrawal reversal restores funds",
  (await money.getWallet(seller)).available_cents === wBefore.available_cents,
);

// =============== 7. transaction rollback on failure ===============
const preTx = await money.getWallet(seller);
await tx(async () => {
  await run(`update wallets set available_cents = available_cents + 99999 where user_id = ?`, [
    seller,
  ]);
  throw new Error("forced rollback");
}).catch(() => {});
check(
  "failed transaction rolls back",
  (await money.getWallet(seller)).available_cents === preTx.available_cents,
);

// =============== 8. encryption + automod ===============
const enc = core.encryptStock("SECRET-CODE-123");
check(
  "stock encryption round-trips",
  core.decryptStock(enc) === "SECRET-CODE-123" && enc !== "SECRET-CODE-123",
);
check("automod flags telegram", core.automodCheck("hit me on telegram @scam") !== null);
check("automod flags email", core.automodCheck("mail me at x@y.com") !== null);
check("automod passes normal text", core.automodCheck("thanks, code worked great!") === null);

// =============== 9. atomic stock reservation (oversell guard) ===============
// Exercises the exact guarded UPDATE…RETURNING used by checkout. Reserving
// more than is available must claim only what's left and report the shortfall.
{
  const stockProduct = (await q1<any>(
    `select * from products where delivery_type = 'auto' and stock_count > 0 limit 1`,
  ))!;
  const avail = await stockOf(stockProduct.id);
  const claimAll = await q<{ id: string }>(
    `update stock_items set status = 'reserved', order_id = ?
       where status = 'available'
         and id in (
           select id from stock_items where product_id = ? and status = 'available'
           order by id limit ?
         )
     returning id`,
    ["smoke-reserve-1", stockProduct.id, avail + 5],
  );
  check("atomic reserve claims only available stock", claimAll.length === avail, {
    claimed: claimAll.length,
    avail,
  });
  // A second reservation finds nothing left — never double-sells a code.
  const claimAgain = await q<{ id: string }>(
    `update stock_items set status = 'reserved', order_id = ?
       where status = 'available'
         and id in (
           select id from stock_items where product_id = ? and status = 'available'
           order by id limit ?
         )
     returning id`,
    ["smoke-reserve-2", stockProduct.id, 1],
  );
  check("atomic reserve never double-sells", claimAgain.length === 0);
  // restore for any later assertions
  await run(`update stock_items set status = 'available', order_id = null where order_id = ?`, [
    "smoke-reserve-1",
  ]);
}

// =============== 10. atomic coupon redemption (max_uses guard) ===============
{
  const cid = core.uid();
  await run(
    `insert into coupons (id, code, pct_off, min_total_cents, max_uses, used_count, is_active, created_at)
     values (?,?,?,?,?,?,?,?)`,
    [cid, "SMOKE1USE", 10, 0, 1, 0, 1, Date.now()],
  );
  const first = await q<{ id: string }>(
    `update coupons set used_count = used_count + 1
       where id = ? and (max_uses = 0 or used_count < max_uses) returning id`,
    [cid],
  );
  const second = await q<{ id: string }>(
    `update coupons set used_count = used_count + 1
       where id = ? and (max_uses = 0 or used_count < max_uses) returning id`,
    [cid],
  );
  check("coupon guard allows first redemption", first.length === 1);
  check("coupon guard blocks redemption past max_uses", second.length === 0);
}

// =============== 11. single-flight TTL cache ===============
{
  const { cached, invalidateCache } = await import("../src/lib/server/cache.server");
  let calls = 0;
  const compute = async () => {
    calls++;
    await new Promise((r) => setTimeout(r, 10));
    return calls;
  };
  // Concurrent callers during one in-flight computation share a single call.
  const [a, b, c] = await Promise.all([
    cached("t", 1000, compute),
    cached("t", 1000, compute),
    cached("t", 1000, compute),
  ]);
  check("cache single-flights concurrent callers", calls === 1 && a === 1 && b === 1 && c === 1);
  // Subsequent call within TTL is served from cache (no recompute).
  const d = await cached("t", 1000, compute);
  check("cache serves fresh value within TTL", calls === 1 && d === 1);
  // After invalidation it recomputes.
  invalidateCache("t");
  const e = await cached("t", 1000, compute);
  check("cache recomputes after invalidation", calls === 2 && e === 2);
}

// =============== 12. buyer dashboard aggregation ===============
{
  // Mirrors getBuyerDashboard: order stats by status + spend, recent orders,
  // favorites/follows counts. The buyer placed several orders above.
  const ACTIVE = ["awaiting_payment", "paid", "delivering", "delivered", "disputed"];
  const COMPLETED = ["completed", "released"];

  const byStatus = await q<{ status: string; c: number; s: number }>(
    `select status, count(*) as c, coalesce(sum(total_cents), 0) as s
       from orders where buyer_id = ? group by status`,
    [buyer.id],
  );
  let totalOrders = 0;
  let activeOrders = 0;
  let completedOrders = 0;
  let totalSpentCents = 0;
  for (const r of byStatus) {
    const c = Number(r.c);
    totalOrders += c;
    if (ACTIVE.includes(r.status)) activeOrders += c;
    if (COMPLETED.includes(r.status)) {
      completedOrders += c;
      totalSpentCents += Number(r.s);
    }
  }
  check("buyer dashboard sees all buyer orders", totalOrders >= 4, { totalOrders });
  check("buyer dashboard counts a released order as completed", completedOrders >= 1, {
    completedOrders,
  });
  check(
    "buyer dashboard sums spend only for completed/released orders",
    totalSpentCents > 0 && totalSpentCents <= totalOrders * 1_000_000_00,
    { totalSpentCents },
  );
  check(
    "buyer dashboard active+completed never exceeds total",
    activeOrders + completedOrders <= totalOrders,
  );

  const recent = await q<{ id: string; counterparty: string }>(
    `select o.id, u.username as counterparty
       from orders o join users u on u.id = o.seller_id
      where o.buyer_id = ? order by o.created_at desc limit 6`,
    [buyer.id],
  );
  check("buyer dashboard recent orders capped and joined", recent.length > 0 && recent.length <= 6);

  const favCount = (await q1<{ c: number }>(
    `select count(*) as c from favorites where user_id = ?`,
    [buyer.id],
  ))!.c;
  const followCount = (await q1<{ c: number }>(
    `select count(*) as c from seller_follows where user_id = ?`,
    [buyer.id],
  ))!.c;
  check(
    "buyer dashboard favorite/follow counts resolve",
    Number(favCount) >= 0 && Number(followCount) >= 0,
  );
}

// =============== 13. chat inbox + conversation card ===============
{
  // Order o1 already produced system messages via the lifecycle, so a
  // conversation exists. Add a buyer message so unread/preview are exercised.
  const conv = (await q1<{ id: string; seller_id: string; buyer_id: string }>(
    `select id, seller_id, buyer_id from conversations where order_id = ?`,
    [o1],
  ))!;
  check("order lifecycle created a conversation", !!conv?.id);

  await run(
    `insert into messages (id, conversation_id, sender_id, body, created_at) values (?,?,?,?,?)`,
    [core.uid(), conv.id, conv.buyer_id, "hi, did the codes arrive?", core.now()],
  );

  // Inbox query (mirrors listConversations) from the seller's perspective.
  const sellerId = conv.seller_id;
  const inbox = await q<Record<string, any>>(
    `select cv.id, cv.order_id, cv.product_id, cv.last_message_at,
            coalesce(ub.last_seen_at, 0) as buyer_last_seen,
            coalesce(us.last_seen_at, 0) as seller_last_seen,
            cv.buyer_id, cv.seller_id,
            o.order_no, o.product_title, o.status as order_status, o.total_cents as order_total_cents,
            p.title as product_title_presale, p.price_cents as product_price_cents, p.slug as product_slug,
            coalesce(o.image_key, p.image_key) as image_key,
            (select body from messages m where m.conversation_id = cv.id order by m.created_at desc limit 1) as last_body,
            (select sender_id from messages m where m.conversation_id = cv.id order by m.created_at desc limit 1) as last_sender_id,
            (select is_system from messages m where m.conversation_id = cv.id order by m.created_at desc limit 1) as last_is_system,
            (select count(*) from messages m where m.conversation_id = cv.id
               and m.created_at > case when cv.buyer_id = ? then cv.buyer_last_read_at else cv.seller_last_read_at end
               and (m.sender_id is null or m.sender_id != ?)) as unread
       from conversations cv
       join users ub on ub.id = cv.buyer_id
       join users us on us.id = cv.seller_id
       left join orders o on o.id = cv.order_id
       left join products p on p.id = cv.product_id
       where cv.buyer_id = ? or cv.seller_id = ?
       order by coalesce(cv.last_message_at, cv.created_at) desc limit 100`,
    [sellerId, sellerId, sellerId, sellerId],
  );
  const myRow = inbox.find((r) => r.id === conv.id)!;
  check("inbox returns the order conversation", !!myRow);
  check(
    "inbox last_body is the latest buyer message",
    myRow.last_body === "hi, did the codes arrive?",
  );
  check("inbox last_sender_id is the buyer", myRow.last_sender_id === conv.buyer_id);
  check("inbox surfaces order metadata", !!myRow.order_no && Number(myRow.order_total_cents) > 0);
  check("inbox counts unread for the seller", Number(myRow.unread) >= 1, myRow.unread);

  // Pinned card query (mirrors getMessages) for an order conversation.
  const card = (await q1<Record<string, any>>(
    `select o.id as order_id, o.order_no, o.status, o.product_title as title,
            o.total_cents, o.qty, o.unit_price_cents, o.image_key, o.product_id,
            p.slug as product_slug
       from orders o left join products p on p.id = o.product_id
      where o.id = ?`,
    [o1],
  ))!;
  check(
    "conversation card resolves order details",
    !!card && card.order_id === o1 && Number(card.total_cents) > 0 && !!card.product_slug,
    card,
  );
}

// =============== 14. base category taxonomy (additive ensure step) ===============
{
  // ensureBaseCategories runs on boot, so every base slug should already exist.
  const slugs = (await q<{ slug: string }>(`select slug from categories`)).map((r) => r.slug);
  const have = new Set(slugs);
  const missing = BASE_CATEGORIES.filter((c) => !have.has(c.slug)).map((c) => c.slug);
  check("all base categories provisioned on boot", missing.length === 0, missing);
  check(
    "G2G additions present (skins/telco/payment-cards)",
    have.has("skins") && have.has("telco") && have.has("payment-cards"),
  );

  // Idempotent: a second pass with everything present inserts nothing.
  check("ensure base categories is idempotent", (await ensureBaseCategoriesNow()) === 0);

  // Additive: removing a base category with no products and re-running restores
  // exactly that one, and never duplicates a slug.
  await run(`delete from categories where slug = 'telco'`);
  const added = await ensureBaseCategoriesNow();
  check("ensure re-adds a missing base category", added === 1, { added });
  const telcoCount = (await q1<{ c: number }>(
    `select count(*) as c from categories where slug = 'telco'`,
  ))!.c;
  check("re-added category is not duplicated", Number(telcoCount) === 1);
}

console.log(
  `\nAll ${passed} checks passed ✔ (engine: ${process.env.DATABASE_URL ? "postgres" : "sqlite"})`,
);
process.exit(0);
