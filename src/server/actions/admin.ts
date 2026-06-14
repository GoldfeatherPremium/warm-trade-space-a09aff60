"use server";

import { z } from "zod";
import { q, q1, run, tx, ensureBaseCategoriesNow } from "@/lib/server/db.server";
import { appContext } from "@/lib/server/app.server";
import {
  audit,
  clearSettingsCache,
  fail,
  getOrCreateOrderConversation,
  notify,
  now,
  systemMessage,
  uid,
} from "@/lib/server/core.server";
import { callAiJson } from "@/lib/server/ai.server";
import {
  txAdjustment,
  txSetFreeze,
  txWithdrawalReversal,
  getBuyerCredits,
  txCreditGrant,
} from "@/lib/server/money.server";
import {
  getOrderRow,
  refundOrder,
  releaseOrder,
  expireOrder,
  adminEscrowHold,
  adminEscrowUnhold,
  adminExtendWarranty,
} from "@/lib/server/lifecycle.server";
import { invalidateCache } from "@/lib/server/cache.server";
import { requireAdmin, requireStaff, requireUser, isStaff } from "@/server/auth";

type Row = Record<string, string | number | null>;

const count = async (sql: string, params?: Array<string | number>) =>
  (await q1<{ c: number }>(sql, params))!.c;

const DAY = 86_400_000;
const RANGES = { "7d": 7, "30d": 30, "90d": 90 } as const;
type Range = keyof typeof RANGES;

function buildDaily(
  rows: Array<{ paid_at: number; v: number; n: number }>,
  days: number,
  t: number,
) {
  const out: Array<{ day: string; v: number; n: number }> = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(t - i * DAY);
    out.push({ day: `${d.getMonth() + 1}/${d.getDate()}`, v: 0, n: 0 });
  }
  for (const r of rows) {
    const idx = days - 1 - Math.min(days - 1, Math.max(0, Math.floor((t - r.paid_at) / DAY)));
    out[idx].v += r.v;
    out[idx].n += r.n;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------
export async function getAdminDashboard() {
  await appContext();
  await requireStaff();
  const t = now();
  const dayMs = 86_400_000;
  const gmv = (since: number) =>
    q1<{ s: number; c: number }>(
      `select coalesce(sum(total_cents),0) s, count(*) c from orders where paid_at > ? and status not in ('cancelled','expired')`,
      [since],
    );
  const [
    gmvToday,
    gmv30d,
    revenueRow,
    ordersByStatus,
    sellerApplications,
    productReviews,
    openDisputes,
    withdrawals,
    flaggedMessages,
    escrowRow,
    users,
    topSellers,
    paidOrders,
  ] = await Promise.all([
    gmv(t - dayMs),
    gmv(t - 30 * dayMs),
    q1<{ s: number }>(
      `select coalesce(sum(commission_cents),0) s from orders where status = 'released'`,
    ),
    q<{ status: string; c: number }>(`select status, count(*) c from orders group by status`),
    count(`select count(*) c from seller_applications where status = 'pending'`),
    count(`select count(*) c from products where status = 'pending_review'`),
    count(`select count(*) c from disputes where status != 'resolved'`),
    count(`select count(*) c from withdrawals where status = 'pending'`),
    count(`select count(*) c from messages where is_flagged = 1 and moderated_at is null`),
    q1<{ s: number }>(`select coalesce(sum(pending_cents),0) s from wallets`),
    count(`select count(*) c from users`),
    q<{ username: string; c: number; s: number }>(
      `select u.username, count(*) c, coalesce(sum(o.total_cents),0) s from orders o join users u on u.id = o.seller_id
       where o.paid_at > ? group by o.seller_id, u.username order by s desc limit 5`,
      [t - 30 * dayMs],
    ),
    q<{ paid_at: number; total_cents: number }>(
      `select paid_at, total_cents from orders where paid_at > ? and status not in ('cancelled','expired')`,
      [t - 13 * dayMs],
    ),
  ]);
  const daily: Array<{ day: string; gmv: number; orders: number }> = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(t - i * dayMs);
    daily.push({ day: `${d.getMonth() + 1}/${d.getDate()}`, gmv: 0, orders: 0 });
  }
  for (const o of paidOrders) {
    const idx = 13 - Math.min(13, Math.max(0, Math.floor((t - o.paid_at) / dayMs)));
    daily[idx].gmv += o.total_cents / 100;
    daily[idx].orders += 1;
  }
  return {
    daily,
    gmvToday: gmvToday!,
    gmv30d: gmv30d!,
    revenue: revenueRow!.s,
    ordersByStatus,
    pending: { sellerApplications, productReviews, openDisputes, withdrawals, flaggedMessages },
    escrowHeld: escrowRow!.s,
    users,
    topSellers,
  };
}

// ---------------------------------------------------------------------------
// Realtime pulse — lightweight metrics for the admin control center header.
// ---------------------------------------------------------------------------
export async function getAdminPulse() {
  await appContext();
  await requireStaff();
  const t = now();
  const dayMs = 86_400_000;
  const since = t - dayMs;
  const [
    orders24h,
    revenue24h,
    refunds24h,
    escrowOnHold,
    newUsers24h,
    activeDisputes,
    pendingWithdrawalAmt,
    avgTrustRow,
    topSellersCount,
  ] = await Promise.all([
    q1<{ c: number }>(
      `select count(*) c from orders where paid_at > ? and status not in ('cancelled','expired')`,
      [since],
    ),
    q1<{ s: number }>(
      `select coalesce(sum(total_cents),0) s from orders where paid_at > ? and status not in ('cancelled','expired')`,
      [since],
    ),
    q1<{ s: number; c: number }>(
      `select coalesce(sum(total_cents),0) s, count(*) c from orders where status = 'refunded' and coalesce(completed_at, paid_at, created_at) > ?`,
      [since],
    ),
    q1<{ c: number }>(`select count(*) c from orders where escrow_status = 'on_hold'`),
    q1<{ c: number }>(`select count(*) c from users where created_at > ?`, [since]),
    q1<{ c: number }>(`select count(*) c from disputes where status != 'resolved'`),
    q1<{ s: number }>(
      `select coalesce(sum(amount_cents),0) s from withdrawals where status = 'pending'`,
    ),
    q1<{ s: number }>(
      `select coalesce(avg(trust_score),0) s from users where role in ('seller','admin') and trust_score > 0`,
    ),
    q1<{ c: number }>(`select count(*) c from users where role in ('seller','admin')`),
  ]);
  return {
    orders24h: orders24h!.c,
    revenue24h: revenue24h!.s,
    refunds24h: refunds24h!,
    escrowOnHold: escrowOnHold!.c,
    newUsers24h: newUsers24h!.c,
    activeDisputes: activeDisputes!.c,
    pendingWithdrawalAmt: pendingWithdrawalAmt!.s,
    avgTrust: Math.round(avgTrustRow!.s),
    sellers: topSellersCount!.c,
    ts: t,
  };
}

// ---------------------------------------------------------------------------
// Seller approvals
// ---------------------------------------------------------------------------
export async function listSellerApplications() {
  await appContext();
  await requireStaff();
  const applications = await q<Row>(
    `select a.*, u.username, u.email from seller_applications a join users u on u.id = a.user_id
     order by case a.status when 'pending' then 0 else 1 end, a.created_at desc limit 200`,
  );
  return { applications };
}

export async function reviewSellerApplication(input: unknown) {
  const data = z
    .object({
      applicationId: z.string(),
      approve: z.boolean(),
      note: z.string().max(1000).optional(),
    })
    .parse(input);
  await appContext();
  const staff = await requireAdmin();
  const app = await q1<{ id: string; user_id: string; status: string }>(
    `select * from seller_applications where id = ?`,
    [data.applicationId],
  );
  if (!app || app.status !== "pending") fail("Application not found or already reviewed.");
  const status = data.approve ? "approved" : "rejected";
  await run(
    `update seller_applications set status = ?, admin_note = ?, reviewed_by = ?, reviewed_at = ? where id = ?`,
    [status, data.note ?? null, staff.id, now(), data.applicationId],
  );
  if (data.approve) {
    await run(`update users set seller_status = 'approved', role = 'seller' where id = ?`, [
      app!.user_id,
    ]);
    const { recomputeSellerTrust } = await import("@/lib/server/trust.server");
    await recomputeSellerTrust(app!.user_id);
  } else {
    await run(`update users set seller_status = 'rejected' where id = ?`, [app!.user_id]);
  }
  await notify(
    app!.user_id,
    "seller_application",
    data.approve ? "Seller application approved 🎉" : "Seller application rejected",
    data.note ?? (data.approve ? "You can now list products." : "See admin note."),
    data.approve ? "/seller" : "/sell",
  );
  await audit(
    staff.id,
    `seller_application.${status}`,
    "seller_application",
    data.applicationId,
    { note: data.note },
  );
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Product approvals
// ---------------------------------------------------------------------------
export async function listProductReviewQueue() {
  await appContext();
  await requireStaff();
  const products = await q<Row>(
    `select p.*, u.username as seller_name, c.name as category_name, c.risk_tier
     from products p join users u on u.id = p.seller_id join categories c on c.id = p.category_id
     order by case p.status when 'pending_review' then 0 else 1 end, p.created_at desc limit 300`,
  );
  return { products };
}

export async function reviewProduct(input: unknown) {
  const data = z
    .object({
      productId: z.string(),
      approve: z.boolean(),
      reason: z.string().max(1000).optional(),
    })
    .parse(input);
  await appContext();
  const staff = await requireAdmin();
  const p = await q1<{
    id: string;
    seller_id: string;
    title: string;
    status: string;
    delivery_type: string;
    stock_count: number;
  }>(
    `select id, seller_id, title, status, delivery_type, stock_count from products where id = ?`,
    [data.productId],
  );
  if (!p) fail("Product not found.");
  if (p!.status !== "pending_review") fail("Product is not awaiting review.");
  if (data.approve) {
    const next = p!.delivery_type === "auto" && p!.stock_count === 0 ? "out_of_stock" : "active";
    await run(`update products set status = ?, reject_reason = null where id = ?`, [
      next,
      data.productId,
    ]);
    // Fan out a notification to every follower of this seller — drives
    // repeat traffic from buyers who already trust the store.
    if (next === "active") {
      const followers = await q<{ user_id: string }>(
        `select user_id from seller_follows where seller_id = ?`,
        [p!.seller_id],
      );
      const sellerRow = await q1<{ username: string }>(
        `select username from users where id = ?`,
        [p!.seller_id],
      );
      const sellerName = sellerRow?.username ?? "A seller you follow";
      const productSlug = await q1<{ slug: string }>(`select slug from products where id = ?`, [
        data.productId,
      ]);
      const link = productSlug ? `/p/${productSlug.slug}` : "/browse";
      await Promise.all(
        followers.map((f) =>
          notify(
            f.user_id,
            "followed_seller_listing",
            `${sellerName} just listed something new`,
            p!.title,
            link,
          ),
        ),
      );
    }
  } else {
    if (!data.reason) fail("A rejection reason is required.");
    await run(`update products set status = 'rejected', reject_reason = ? where id = ?`, [
      data.reason!,
      data.productId,
    ]);
  }
  await notify(
    p!.seller_id,
    "product_review",
    data.approve ? "Product approved" : "Product rejected",
    `${p!.title}${data.reason ? ` — ${data.reason}` : ""}`,
    "/seller/products",
  );
  await audit(
    staff.id,
    `product.${data.approve ? "approve" : "reject"}`,
    "product",
    data.productId,
    {
      reason: data.reason,
    },
  );
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Orders (global)
// ---------------------------------------------------------------------------
export async function adminListOrders(input: unknown) {
  const data = z
    .object({ q: z.string().max(80).optional(), status: z.string().optional() })
    .parse(input);
  await appContext();
  await requireStaff();
  const where: string[] = ["1=1"];
  const params: Array<string | number> = [];
  if (data.q) {
    const like = `%${data.q.toLowerCase()}%`;
    where.push(
      `(lower(o.order_no) like ? or lower(o.product_title) like ? or lower(ub.username) like ? or lower(us.username) like ?)`,
    );
    params.push(like, like, like, like);
  }
  if (data.status) {
    where.push(`o.status = ?`);
    params.push(data.status);
  }
  const orders = await q<Row>(
    `select o.*, ub.username as buyer_name, us.username as seller_name
     from orders o join users ub on ub.id = o.buyer_id join users us on us.id = o.seller_id
     where ${where.join(" and ")} order by o.created_at desc limit 200`,
    params,
  );
  return { orders };
}

export async function adminForceOrderAction(input: unknown) {
  const data = z
    .object({
      orderId: z.string(),
      action: z.enum(["refund", "release", "cancel"]),
      note: z.string().min(5).max(1000),
    })
    .parse(input);
  await appContext();
  const staff = await requireAdmin();
  const o = await getOrderRow(data.orderId);
  if (!o) fail("Order not found.");
  if (data.action === "cancel") {
    if (o!.status !== "awaiting_payment") fail("Only unpaid orders can be cancelled.");
    await expireOrder(data.orderId, `Admin: ${data.note}`, "cancelled");
  } else if (data.action === "refund") {
    if (!["paid", "delivering", "delivered", "completed", "disputed"].includes(o!.status))
      fail("This order can't be refunded.");
    await refundOrder(data.orderId, o!.total_cents, `Admin: ${data.note}`);
  } else {
    if (!["delivered", "completed", "disputed"].includes(o!.status))
      fail("This order can't be released.");
    await releaseOrder(data.orderId, `Released by staff: ${data.note}`);
  }
  await audit(staff.id, `order.force_${data.action}`, "order", data.orderId, { note: data.note });
  return { ok: true };
}

export async function adminEscrowAction(input: unknown) {
  const data = z
    .object({
      orderId: z.string(),
      action: z.enum(["hold", "unhold", "extend"]),
      hours: z.number().int().min(1).max(720).optional(),
      reason: z.string().min(5).max(500),
    })
    .parse(input);
  await appContext();
  const staff = await requireAdmin();
  const o = await getOrderRow(data.orderId);
  if (!o) fail("Order not found.");
  if (data.action === "hold") {
    await adminEscrowHold(data.orderId, staff.id, data.reason);
  } else if (data.action === "unhold") {
    await adminEscrowUnhold(data.orderId, staff.id);
  } else {
    if (!data.hours) fail("Hours required for warranty extension.");
    await adminExtendWarranty(data.orderId, data.hours!, data.reason);
  }
  await audit(staff.id, `escrow.${data.action}`, "order", data.orderId, {
    reason: data.reason,
    hours: data.hours,
  });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Disputes center
// ---------------------------------------------------------------------------
export async function listDisputes() {
  await appContext();
  await requireStaff();
  const disputes = await q<Row>(
    `select dd.*, o.order_no, o.product_title, o.total_cents, o.status as order_status, o.delivery_type,
            ub.username as buyer_name, us.username as seller_name, o.buyer_id, o.seller_id
     from disputes dd join orders o on o.id = dd.order_id
     join users ub on ub.id = o.buyer_id join users us on us.id = o.seller_id
     order by case dd.status when 'resolved' then 1 else 0 end, dd.created_at desc limit 200`,
  );
  return { disputes };
}

export async function resolveDispute(input: unknown) {
  const data = z
    .object({
      disputeId: z.string(),
      resolution: z.enum(["refund_full", "refund_partial", "release_seller"]),
      partialRefundUsdt: z.number().min(0).optional(),
      note: z.string().min(5).max(2000),
    })
    .parse(input);
  await appContext();
  const staff = await requireStaff(["support", "admin"]);
  const dd = await q1<{ id: string; order_id: string; status: string }>(
    `select * from disputes where id = ?`,
    [data.disputeId],
  );
  if (!dd || dd.status === "resolved") fail("Dispute not found or already resolved.");
  const o = (await getOrderRow(dd!.order_id))!;
  let resolutionCents = 0;
  if (data.resolution === "refund_full") {
    resolutionCents = o.total_cents;
    await refundOrder(o.id, o.total_cents, `Dispute resolved: full refund. ${data.note}`);
  } else if (data.resolution === "refund_partial") {
    resolutionCents = Math.round((data.partialRefundUsdt ?? 0) * 100);
    if (resolutionCents <= 0 || resolutionCents >= o.total_cents)
      fail("Partial refund must be between 0 and the order total.");
    await refundOrder(o.id, resolutionCents, `Dispute resolved: partial refund. ${data.note}`);
  } else {
    await releaseOrder(o.id, `Dispute resolved in seller's favour: ${data.note}`);
  }
  await run(
    `update disputes set status = 'resolved', resolution = ?, resolution_cents = ?, resolved_by = ?, resolved_at = ? where id = ?`,
    [data.resolution, resolutionCents, staff.id, now(), data.disputeId],
  );
  const convId = await getOrCreateOrderConversation(o.id);
  await systemMessage(
    convId,
    `Dispute resolved (${data.resolution.replaceAll("_", " ")}): ${data.note}`,
  );
  await notify(
    o.buyer_id,
    "dispute_resolved",
    "Dispute resolved",
    `${o.order_no}: ${data.resolution.replaceAll("_", " ")}`,
    `/orders/${o.id}`,
  );
  await notify(
    o.seller_id,
    "dispute_resolved",
    "Dispute resolved",
    `${o.order_no}: ${data.resolution.replaceAll("_", " ")}`,
    `/orders/${o.id}`,
  );
  await audit(staff.id, "dispute.resolve", "dispute", data.disputeId, {
    resolution: data.resolution,
    note: data.note,
  });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Finance: withdrawals + deposits + adjustments
// ---------------------------------------------------------------------------
export async function listWithdrawalQueue() {
  await appContext();
  await requireStaff(["finance", "admin"]);
  const withdrawals = await q<Row>(
    `select w.*, u.username, u.email, u.seller_level,
            (select available_cents from wallets where user_id = w.user_id) as wallet_available
     from withdrawals w join users u on u.id = w.user_id
     order by case w.status when 'pending' then 0 else 1 end, w.created_at desc limit 200`,
  );
  return { withdrawals };
}

export async function reviewWithdrawal(input: unknown) {
  const data = z
    .object({
      withdrawalId: z.string(),
      action: z.enum(["approve", "reject", "mark_sent"]),
      txHash: z.string().max(120).optional(),
      note: z.string().max(500).optional(),
    })
    .parse(input);
  await appContext();
  const staff = await requireStaff(["finance", "admin"]);
  const w = await q1<{
    id: string;
    user_id: string;
    amount_cents: number;
    fee_cents: number;
    status: string;
  }>(`select * from withdrawals where id = ?`, [data.withdrawalId]);
  if (!w) fail("Withdrawal not found.");
  if (data.action === "approve") {
    if (w!.status !== "pending") fail("Only pending withdrawals can be approved.");
    await run(
      `update withdrawals set status = 'approved', reviewed_by = ?, reviewed_at = ? where id = ?`,
      [staff.id, now(), w!.id],
    );
    await notify(
      w!.user_id,
      "withdrawal",
      "Withdrawal approved",
      "Payout is being processed.",
      "/seller/wallet",
    );
  } else if (data.action === "mark_sent") {
    if (!["pending", "approved"].includes(w!.status)) fail("Withdrawal is not awaiting payout.");
    if (!data.txHash) fail("Transaction hash is required.");
    await run(
      `update withdrawals set status = 'sent', tx_hash = ?, reviewed_by = ?, reviewed_at = ? where id = ?`,
      [data.txHash!, staff.id, now(), w!.id],
    );
    await notify(
      w!.user_id,
      "withdrawal",
      "Withdrawal sent",
      `${(w!.amount_cents / 100).toFixed(2)} USDT sent — tx ${data.txHash!.slice(0, 18)}…`,
      "/seller/wallet",
    );
  } else {
    if (!["pending", "approved"].includes(w!.status)) fail("Withdrawal can't be rejected now.");
    await txWithdrawalReversal(w!.user_id, w!.amount_cents, w!.fee_cents, w!.id);
    await run(
      `update withdrawals set status = 'rejected', reviewed_by = ?, reviewed_at = ? where id = ?`,
      [staff.id, now(), w!.id],
    );
    await notify(
      w!.user_id,
      "withdrawal",
      "Withdrawal rejected",
      data.note ?? "Funds returned to your wallet.",
      "/seller/wallet",
    );
  }
  await audit(staff.id, `withdrawal.${data.action}`, "withdrawal", data.withdrawalId, {
    note: data.note,
    txHash: data.txHash,
  });
  return { ok: true };
}

export async function listDeposits() {
  await appContext();
  await requireStaff(["finance", "admin"]);
  const deposits = await q<Row>(
    `select dp.*, u.username, o.order_no from deposits dp
     join users u on u.id = dp.user_id left join orders o on o.id = dp.order_id
     order by dp.created_at desc limit 200`,
  );
  return { deposits };
}

export async function adminAdjustWallet(input: unknown) {
  const data = z
    .object({ userId: z.string(), amountUsdt: z.number(), note: z.string().min(5).max(500) })
    .parse(input);
  await appContext();
  const staff = await requireAdmin();
  await txAdjustment(
    data.userId,
    Math.round(data.amountUsdt * 100),
    `Admin adjustment: ${data.note}`,
  );
  await audit(staff.id, "wallet.adjust", "user", data.userId, {
    amountUsdt: data.amountUsdt,
    note: data.note,
  });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------
export async function adminListUsers(input: unknown) {
  const data = z.object({ q: z.string().max(80).optional() }).parse(input);
  await appContext();
  await requireStaff();
  const where = data.q ? `where lower(u.username) like ? or lower(u.email) like ?` : "";
  const like = `%${(data.q ?? "").toLowerCase()}%`;
  const users = await q<Row>(
    `select u.id, u.email, u.username, u.role, u.seller_status, u.seller_level, u.rating, u.total_sales,
            u.is_banned, u.wallet_frozen, u.created_at,
            coalesce(w.available_cents,0) available_cents, coalesce(w.pending_cents,0) pending_cents,
            coalesce(w.frozen_cents,0) frozen_cents
     from users u left join wallets w on w.user_id = u.id ${where} order by u.created_at desc limit 200`,
    data.q ? [like, like] : [],
  );
  return { users };
}

export async function adminUserAction(input: unknown) {
  const data = z
    .object({
      userId: z.string(),
      action: z.enum([
        "ban",
        "unban",
        "freeze_wallet",
        "unfreeze_wallet",
        "set_role",
        "set_seller_level",
      ]),
      role: z.enum(["buyer", "seller", "support", "finance", "admin"]).optional(),
      level: z.number().int().min(1).max(5).optional(),
    })
    .parse(input);
  await appContext();
  const staff = await requireAdmin();
  if (data.userId === staff.id && (data.action === "ban" || data.action === "set_role"))
    fail("You can't do that to your own account.");
  const target = await q1(`select id from users where id = ?`, [data.userId]);
  if (!target) fail("User not found.");
  switch (data.action) {
    case "ban":
      await run(`update users set is_banned = 1 where id = ?`, [data.userId]);
      await run(`delete from sessions where user_id = ?`, [data.userId]);
      break;
    case "unban":
      await run(`update users set is_banned = 0 where id = ?`, [data.userId]);
      break;
    case "freeze_wallet":
      await txSetFreeze(data.userId, true);
      break;
    case "unfreeze_wallet":
      await txSetFreeze(data.userId, false);
      break;
    case "set_role":
      if (!data.role) fail("Role required.");
      await run(`update users set role = ? where id = ?`, [data.role!, data.userId]);
      break;
    case "set_seller_level":
      if (!data.level) fail("Level required.");
      await run(`update users set seller_level = ? where id = ?`, [data.level!, data.userId]);
      break;
  }
  await audit(staff.id, `user.${data.action}`, "user", data.userId, {
    role: data.role,
    level: data.level,
  });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Catalog management
// ---------------------------------------------------------------------------
export async function adminListCategories() {
  await appContext();
  await requireStaff();
  const categories = await q<Row>(
    `select c.*, (select count(*) from products p where p.category_id = c.id and p.status = 'active') product_count
     from categories c order by c.sort`,
  );
  return { categories };
}

export async function adminSaveCategory(input: unknown) {
  const data = z
    .object({
      categoryId: z.string().optional(),
      name: z.string().min(2).max(60),
      slug: z
        .string()
        .min(2)
        .max(60)
        .regex(/^[a-z0-9-]+$/),
      icon: z.string().max(8).optional(),
      sort: z.number().int().min(0).max(9999).optional(),
      defaultWarrantyHours: z
        .number()
        .int()
        .min(1)
        .max(24 * 90),
      commissionPct: z.number().min(0).max(50),
      riskTier: z.enum(["normal", "high"]),
      isActive: z.boolean(),
      submissionSchema: z.string().max(20_000).optional(),
      // Phase 13 — admin-configurable category surface
      requiresSubscription: z.boolean().default(false),
      allowedDurations: z
        .array(z.enum(["7d", "14d", "1m", "3m", "6m", "12m", "lifetime"]))
        .max(7)
        .default([]),
      adminDescription: z.string().max(8000).optional(),
      deliveryKind: z
        .enum(["code", "credentials", "invite", "giftcard_image", "manual_text"])
        .default("code"),
    })
    .parse(input);
  await appContext();
  const staff = await requireAdmin();
  // Validate submission_schema JSON if provided
  let schema: string | null = null;
  if (data.submissionSchema && data.submissionSchema.trim()) {
    try {
      const parsed = JSON.parse(data.submissionSchema);
      if (typeof parsed !== "object" || parsed === null) throw new Error();
      schema = JSON.stringify(parsed);
    } catch {
      fail("Submission schema must be valid JSON.");
    }
  }
  const allowedCsv = data.allowedDurations.join(",");
  const adminDesc = data.adminDescription?.trim() || null;
  if (data.categoryId) {
    await run(
      `update categories set name = ?, slug = ?, icon = ?, sort = coalesce(?, sort), default_warranty_hours = ?, commission_pct = ?, risk_tier = ?, is_active = ?, submission_schema = ?,
         requires_subscription = ?, allowed_durations = ?, admin_description = ?, delivery_kind = ?
       where id = ?`,
      [
        data.name,
        data.slug,
        data.icon ?? null,
        data.sort ?? null,
        data.defaultWarrantyHours,
        data.commissionPct,
        data.riskTier,
        data.isActive ? 1 : 0,
        schema,
        data.requiresSubscription ? 1 : 0,
        allowedCsv,
        adminDesc,
        data.deliveryKind,
        data.categoryId,
      ],
    );
  } else {
    if (await q1(`select 1 as x from categories where slug = ?`, [data.slug]))
      fail("Slug already exists.");
    await run(
      `insert into categories (id, name, slug, icon, sort, default_warranty_hours, commission_pct, risk_tier, is_active, submission_schema,
         requires_subscription, allowed_durations, admin_description, delivery_kind)
       values (?,?,?,?, (select coalesce(max(sort),0)+1 from categories), ?,?,?,?,?,?,?,?,?)`,
      [
        uid(),
        data.name,
        data.slug,
        data.icon ?? null,
        data.defaultWarrantyHours,
        data.commissionPct,
        data.riskTier,
        data.isActive ? 1 : 0,
        schema,
        data.requiresSubscription ? 1 : 0,
        allowedCsv,
        adminDesc,
        data.deliveryKind,
      ],
    );
  }
  await audit(staff.id, "category.save", "category", data.categoryId ?? data.slug);
  // Reflect taxonomy edits immediately on home + catalog surfaces
  invalidateCache("home:v1");
  invalidateCache("catalog-items:v1");

  return { ok: true };
}

/**
 * Idempotently add any missing G2G-style base categories. Additive only —
 * never renames, reorders or deletes existing categories.
 */
export async function adminEnsureBaseCategories() {
  await appContext();
  const staff = await requireAdmin();
  const added = await ensureBaseCategoriesNow();
  if (added > 0) {
    await audit(staff.id, "category.ensure_base", "category", `+${added}`);
    invalidateCache("home:v1");
    invalidateCache("catalog-items:v1");
  }
  return { added };
}

// Admin full product edit
export async function adminGetProduct(input: unknown) {
  const data = z.object({ productId: z.string() }).parse(input);
  await appContext();
  await requireStaff();
  const product = await q1<Row>(
    `select p.*, u.username as seller_name, c.name as category_name
     from products p join users u on u.id = p.seller_id join categories c on c.id = p.category_id
     where p.id = ?`,
    [data.productId],
  );
  if (!product) fail("Product not found.");
  const categories = await q<Row>(
    `select id, name, slug, commission_pct, default_warranty_hours from categories where is_active = 1 order by sort`,
  );
  const items = await q<{ id: string; name: string; slug: string }>(
    `select id, name, slug from catalog_items where is_active = 1 order by sort, name`,
  );
  const itemCats = await q<{ item_id: string; category_id: string }>(
    `select item_id, category_id from catalog_item_categories`,
  );
  return { product: product!, categories, items, itemCategories: itemCats };
}

export async function adminUpdateProduct(input: unknown) {
  const data = z
    .object({
      productId: z.string(),
      title: z.string().min(8).max(120),
      description: z.string().min(30).max(5000),
      categoryId: z.string(),
      itemId: z.string().optional().nullable(),
      priceUsdt: z.number().min(0.5).max(100_000),
      warrantyHours: z
        .number()
        .int()
        .min(1)
        .max(24 * 365)
        .nullable(),
      minQty: z.number().int().min(1).max(1000),
      maxQty: z.number().int().min(1).max(1000),
      region: z.string().max(40).optional(),
      platform: z.string().max(40).optional(),
      requiredInfo: z.string().max(500).optional(),
      adminSeoDescription: z.string().max(8000).optional(),
      categoryAttrs: z.record(z.string(), z.string().max(2000)).optional(),
      status: z.enum(["active", "paused", "rejected", "out_of_stock", "pending_review"]).optional(),
      // Phase 13 overrides
      subscriptionDuration: z
        .enum(["7d", "14d", "1m", "3m", "6m", "12m", "lifetime"])
        .nullable()
        .optional(),

      maxOrdersAtOnce: z.number().int().min(1).max(1000).optional(),
    })
    .parse(input);
  await appContext();
  const staff = await requireAdmin();
  if (data.minQty > data.maxQty) fail("Min qty exceeds max qty.");
  const exists = await q1(`select id from products where id = ?`, [data.productId]);
  if (!exists) fail("Product not found.");
  let itemId: string | null = null;
  if (data.itemId) {
    const item = await q1(`select id from catalog_items where id = ? and is_active = 1`, [
      data.itemId,
    ]);
    if (!item) fail("Selected sub-category is not available.");
    const allowed = await q<{ category_id: string }>(
      `select category_id from catalog_item_categories where item_id = ?`,
      [data.itemId],
    );
    if (allowed.length > 0 && !allowed.some((r) => r.category_id === data.categoryId)) {
      fail("That sub-category is not enabled for this category.");
    }
    itemId = data.itemId;
  }
  await run(
    `update products set title = ?, description = ?, category_id = ?, item_id = ?, price_cents = ?, warranty_hours = ?,
       min_qty = ?, max_qty = ?, region = ?, platform = ?, required_info = ?,
       admin_seo_description = ?, category_attrs = ?, subscription_duration = ?, max_orders_at_once = ?${data.status ? ", status = ?" : ""}
     where id = ?`,
    [
      data.title,
      data.description,
      data.categoryId,
      itemId,
      Math.round(data.priceUsdt * 100),
      data.warrantyHours,
      data.minQty,
      data.maxQty,
      data.region ?? null,
      data.platform ?? null,
      data.requiredInfo ?? null,
      data.adminSeoDescription?.trim() || null,
      data.categoryAttrs && Object.keys(data.categoryAttrs).length > 0
        ? JSON.stringify(data.categoryAttrs)
        : null,
      data.subscriptionDuration ? data.subscriptionDuration : null,
      data.maxOrdersAtOnce ?? 10,
      ...(data.status ? [data.status] : []),
      data.productId,
    ],
  );
  await audit(staff.id, "product.admin_edit", "product", data.productId);
  invalidateCache("home:v1");
  invalidateCache("catalog-items:v1");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Settings + audit + moderation
// ---------------------------------------------------------------------------
export async function getAdminSettings() {
  await appContext();
  await requireStaff();
  return { settings: (await q1<Row>(`select * from site_settings where id = 1`))! };
}

export async function updateAdminSettings(input: unknown) {
  const data = z
    .object({
      defaultCommissionPct: z.number().min(0).max(50),
      withdrawalFeeUsdt: z.number().min(0).max(100),
      minWithdrawalUsdt: z.number().min(0).max(10_000),
      autoConfirmHours: z.number().int().min(1).max(720),
      paymentWindowMinutes: z.number().int().min(5).max(1440),
      maintenanceMode: z.boolean(),
      announcement: z.string().max(300).optional(),
      creditWithdrawalFeePct: z.number().min(0).max(20),
      creditWithdrawalMinFeeUsdt: z.number().min(0).max(50),
      attachmentMaxMb: z.number().int().min(1).max(50),
      presencePingSeconds: z.number().int().min(15).max(600),
      lowStockThreshold: z.number().int().min(0).max(1000),
      disputeSlaHours: z.number().int().min(1).max(720),
      chatRateLimitPerMin: z.number().int().min(1).max(600),
      automodSeverity: z.enum(["block", "flag"]),
    })
    .parse(input);
  await appContext();
  const staff = await requireAdmin();
  await run(
    `update site_settings set default_commission_pct = ?, withdrawal_fee_cents = ?, min_withdrawal_cents = ?,
       auto_confirm_hours = ?, payment_window_minutes = ?, maintenance_mode = ?, announcement = ?,
       credit_withdrawal_fee_pct = ?, credit_withdrawal_min_fee_cents = ?, attachment_max_mb = ?,
       presence_ping_seconds = ?, low_stock_threshold = ?, dispute_sla_hours = ?,
       chat_rate_limit_per_min = ?, automod_severity = ? where id = 1`,
    [
      data.defaultCommissionPct,
      Math.round(data.withdrawalFeeUsdt * 100),
      Math.round(data.minWithdrawalUsdt * 100),
      data.autoConfirmHours,
      data.paymentWindowMinutes,
      data.maintenanceMode ? 1 : 0,
      data.announcement?.trim() || null,
      data.creditWithdrawalFeePct,
      Math.round(data.creditWithdrawalMinFeeUsdt * 100),
      data.attachmentMaxMb,
      data.presencePingSeconds,
      data.lowStockThreshold,
      data.disputeSlaHours,
      data.chatRateLimitPerMin,
      data.automodSeverity,
    ],
  );
  await audit(staff.id, "settings.update", "site_settings", "1", data);
  clearSettingsCache();
  return { ok: true };
}

export async function listAuditLogs() {
  await appContext();
  await requireAdmin();
  const logs = await q<Row>(
    `select a.*, u.username as actor_name from audit_logs a left join users u on u.id = a.actor_id
     order by a.id desc limit 300`,
  );
  return { logs };
}

export async function listFlaggedMessages() {
  await appContext();
  await requireStaff();
  const messages = await q<Row>(
    `select m.id, m.body, m.flag_reason, m.created_at, m.moderated_at, u.username as sender_name, m.conversation_id
     from messages m left join users u on u.id = m.sender_id
     where m.is_flagged = 1 order by case when m.moderated_at is null then 0 else 1 end, m.created_at desc limit 200`,
  );
  return { messages };
}

export async function moderateMessage(input: unknown) {
  const data = z
    .object({ messageId: z.string(), action: z.enum(["dismiss", "remove"]) })
    .parse(input);
  await appContext();
  const staff = await requireStaff();
  if (data.action === "remove") {
    await run(
      `update messages set body = '[removed by moderator]', moderated_at = ?, moderated_by = ? where id = ?`,
      [now(), staff.id, data.messageId],
    );
  } else {
    await run(
      `update messages set is_flagged = 0, moderated_at = ?, moderated_by = ? where id = ?`,
      [now(), staff.id, data.messageId],
    );
  }
  await audit(staff.id, `message.${data.action}`, "message", data.messageId);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Coupons
// ---------------------------------------------------------------------------
export async function adminListCoupons() {
  await appContext();
  await requireStaff();
  const coupons = await q<Row>(`select * from coupons order by created_at desc limit 200`);
  return { coupons };
}

export async function adminSaveCoupon(input: unknown) {
  const data = z
    .object({
      couponId: z.string().optional(),
      code: z
        .string()
        .min(2)
        .max(40)
        .regex(/^[A-Za-z0-9_-]+$/),
      pctOff: z.number().min(1).max(100),
      minTotalUsdt: z.number().min(0).max(100_000).default(0),
      maxUses: z.number().int().min(0).max(1_000_000).default(0),
      expiresInDays: z.number().int().min(0).max(365).default(0),
      isActive: z.boolean().default(true),
    })
    .parse(input);
  await appContext();
  const staff = await requireAdmin();
  const expiresAt = data.expiresInDays > 0 ? now() + data.expiresInDays * 86_400_000 : null;
  if (data.couponId) {
    await run(
      `update coupons set code = ?, pct_off = ?, min_total_cents = ?, max_uses = ?, expires_at = ?, is_active = ? where id = ?`,
      [
        data.code.toUpperCase(),
        data.pctOff,
        Math.round(data.minTotalUsdt * 100),
        data.maxUses,
        expiresAt,
        data.isActive ? 1 : 0,
        data.couponId,
      ],
    );
  } else {
    if (await q1(`select 1 as x from coupons where lower(code) = lower(?)`, [data.code]))
      fail("A coupon with that code already exists.");
    await run(
      `insert into coupons (id, code, pct_off, min_total_cents, max_uses, expires_at, is_active, created_at)
       values (?,?,?,?,?,?,?,?)`,
      [
        uid(),
        data.code.toUpperCase(),
        data.pctOff,
        Math.round(data.minTotalUsdt * 100),
        data.maxUses,
        expiresAt,
        data.isActive ? 1 : 0,
        now(),
      ],
    );
  }
  await audit(staff.id, "coupon.save", "coupon", data.couponId ?? data.code);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Catalog items (games / brands / services) + seller suggestions
// ---------------------------------------------------------------------------
export async function adminListItems() {
  await appContext();
  await requireStaff();
  const [items, maps, suggestions, categories] = await Promise.all([
    q<{
      id: string;
      name: string;
      slug: string;
      is_active: number;
      sort: number;
      created_at: number;
    }>(`select * from catalog_items order by sort, name`),
    q<{ item_id: string; category_id: string }>(
      `select item_id, category_id from catalog_item_categories`,
    ),
    q<Row>(
      `select s.*, u.username from item_suggestions s join users u on u.id = s.user_id
       order by case s.status when 'pending' then 0 else 1 end, s.created_at desc limit 100`,
    ),
    q<{ id: string; name: string; slug: string; icon: string; is_active: number }>(
      `select id, name, slug, icon, is_active from categories order by sort, name`,
    ),
  ]);
  const byItem: Record<string, string[]> = {};
  for (const m of maps) (byItem[m.item_id] ??= []).push(m.category_id);
  return {
    items: items.map((i) => ({ ...i, categoryIds: byItem[i.id] ?? [] })),
    suggestions,
    categories,
  };
}

export async function adminSaveItem(input: unknown) {
  const data = z
    .object({
      itemId: z.string().optional(),
      name: z.string().min(2).max(80),
      isActive: z.boolean().default(true),
      categoryIds: z.array(z.string()).default([]),
    })
    .parse(input);
  await appContext();
  const staff = await requireAdmin();
  const slug = data.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  let id = data.itemId;
  if (id) {
    await run(`update catalog_items set name = ?, is_active = ? where id = ?`, [
      data.name,
      data.isActive ? 1 : 0,
      id,
    ]);
    await run(`delete from catalog_item_categories where item_id = ?`, [id]);
  } else {
    if (await q1(`select 1 as x from catalog_items where slug = ?`, [slug]))
      fail("An item with that name already exists.");
    id = uid();
    await run(
      `insert into catalog_items (id, name, slug, is_active, sort, created_at)
       values (?,?,?,?, (select coalesce(max(sort),0)+1 from catalog_items), ?)`,
      [id, data.name, slug, data.isActive ? 1 : 0, now()],
    );
  }
  for (const catId of data.categoryIds) {
    await run(
      `insert into catalog_item_categories (item_id, category_id) values (?,?) on conflict (item_id, category_id) do nothing`,
      [id!, catId],
    );
  }
  await audit(staff.id, "catalog_item.save", "catalog_item", id);
  invalidateCache("catalog-items:v1"); // reflect taxonomy edits immediately
  invalidateCache("home:v1");
  return { itemId: id };
}

export async function reviewItemSuggestion(input: unknown) {
  const data = z
    .object({
      suggestionId: z.string(),
      approve: z.boolean(),
      note: z.string().max(500).optional(),
    })
    .parse(input);
  await appContext();
  const staff = await requireAdmin();
  const s = await q1<{ id: string; user_id: string; name: string; status: string }>(
    `select * from item_suggestions where id = ?`,
    [data.suggestionId],
  );
  if (!s || s.status !== "pending") fail("Suggestion not found or already reviewed.");
  const status = data.approve ? "approved" : "rejected";
  await run(
    `update item_suggestions set status = ?, admin_note = ?, reviewed_by = ?, reviewed_at = ? where id = ?`,
    [status, data.note ?? null, staff.id, now(), data.suggestionId],
  );
  if (data.approve) {
    const slug = s!.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    if (!(await q1(`select 1 as x from catalog_items where slug = ?`, [slug]))) {
      await run(
        `insert into catalog_items (id, name, slug, sort, created_at)
         values (?,?,?, (select coalesce(max(sort),0)+1 from catalog_items), ?)`,
        [uid(), s!.name, slug, now()],
      );
    }
  }
  await notify(
    s!.user_id,
    "item_suggestion",
    data.approve
      ? `"${s!.name}" was added to the catalog 🎉`
      : `Suggestion "${s!.name}" rejected`,
    data.note ?? (data.approve ? "You can now list products under it." : ""),
    "/seller/new-product",
  );
  await audit(staff.id, `item_suggestion.${status}`, "item_suggestion", data.suggestionId);
  if (data.approve) {
    invalidateCache("catalog-items:v1");
    invalidateCache("home:v1");
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Admin analytics — marketplace wide
// ---------------------------------------------------------------------------
export async function getAdminAnalytics(input: unknown) {
  const data = z.object({ range: z.enum(["7d", "30d", "90d"]).default("30d") }).parse(input);
  await appContext();
  await requireStaff();
  const days = RANGES[data.range as Range];
  const t = now();
  const since = t - days * DAY;
  const prevSince = since - days * DAY;

  const [
    paidRows,
    summary,
    prev,
    categoryPerf,
    topSellers,
    topProducts,
    newSignups,
    conversionRow,
    topSearches,
    zeroSearches,
    searchStats,
  ] = await Promise.all([
    q<{ paid_at: number; v: number; n: number }>(
      `select paid_at, total_cents as v, 1 as n from orders
       where paid_at > ? and status not in ('cancelled','expired','refunded')`,
      [since],
    ),
    q1<{ n: number; gmv: number; commission: number; buyers: number; sellers: number }>(
      `select count(*) n, coalesce(sum(total_cents),0) gmv, coalesce(sum(commission_cents),0) commission,
              count(distinct buyer_id) buyers, count(distinct seller_id) sellers
       from orders where paid_at > ? and status not in ('cancelled','expired','refunded')`,
      [since],
    ),
    q1<{ gmv: number; n: number }>(
      `select count(*) n, coalesce(sum(total_cents),0) gmv from orders
       where paid_at > ? and paid_at <= ? and status not in ('cancelled','expired','refunded')`,
      [prevSince, since],
    ),
    q<{ name: string; orders: number; gmv: number; sellers: number }>(
      `select c.name, count(o.id) orders, coalesce(sum(o.total_cents),0) gmv,
              count(distinct o.seller_id) sellers
       from orders o join products p on p.id = o.product_id join categories c on c.id = p.category_id
       where o.paid_at > ? and o.status not in ('cancelled','expired','refunded')
       group by c.id, c.name order by gmv desc limit 10`,
      [since],
    ),
    q<{ username: string; orders: number; gmv: number; net: number }>(
      `select u.username, count(o.id) orders, coalesce(sum(o.total_cents),0) gmv,
              coalesce(sum(o.seller_net_cents),0) net
       from orders o join users u on u.id = o.seller_id
       where o.paid_at > ? and o.status not in ('cancelled','expired','refunded')
       group by o.seller_id, u.username order by gmv desc limit 10`,
      [since],
    ),
    q<{ id: string; title: string; seller: string; orders: number; gmv: number }>(
      `select p.id, p.title, u.username as seller, count(o.id) orders,
              coalesce(sum(o.total_cents),0) gmv
       from orders o join products p on p.id = o.product_id join users u on u.id = p.seller_id
       where o.paid_at > ? and o.status not in ('cancelled','expired','refunded')
       group by p.id, p.title, u.username order by gmv desc limit 10`,
      [since],
    ),
    q1<{ buyers: number; sellers: number }>(
      `select
         sum(case when role = 'buyer' then 1 else 0 end) buyers,
         sum(case when role = 'seller' or seller_status = 'approved' then 1 else 0 end) sellers
       from users where created_at > ?`,
      [since],
    ),
    q1<{ views: number; sold: number }>(
      `select coalesce(sum(views),0) views, coalesce(sum(sold_count),0) sold from products`,
    ),
    // Top searches (with results) — opportunity to merchandise.
    q<{ query: string; uses: number; avg_results: number }>(
      `select query, count(*) as uses, avg(results) as avg_results
         from search_queries
        where created_at > ? and length(query) >= 2 and results > 0
        group by query order by uses desc limit 15`,
      [since],
    ),
    // Zero-result searches — demand gap (catalog hole, typo, or banned term).
    q<{ query: string; uses: number }>(
      `select query, count(*) as uses from search_queries
        where created_at > ? and length(query) >= 2 and results = 0
        group by query order by uses desc limit 15`,
      [since],
    ),
    q1<{ total: number; failed: number }>(
      `select count(*) total, sum(case when results = 0 then 1 else 0 end) failed
         from search_queries where created_at > ? and length(query) >= 2`,
      [since],
    ),
  ]);

  const daily = buildDaily(paidRows, days, t);
  const prevGmv = prev?.gmv ?? 0;
  const gmvGrowth = prevGmv > 0 ? ((summary!.gmv - prevGmv) / prevGmv) * 100 : null;
  const aov = summary!.n > 0 ? summary!.gmv / summary!.n / 100 : 0;
  const conv =
    conversionRow && conversionRow.views > 0
      ? (conversionRow.sold / conversionRow.views) * 100
      : 0;
  const totalSearches = Number(searchStats?.total ?? 0);
  const failedSearches = Number(searchStats?.failed ?? 0);
  const searchFailRate = totalSearches > 0 ? (failedSearches / totalSearches) * 100 : 0;

  return {
    range: data.range,
    daily,
    summary: {
      orders: summary!.n,
      gmv: summary!.gmv,
      commission: summary!.commission,
      uniqueBuyers: summary!.buyers,
      activeSellers: summary!.sellers,
      aov,
      gmvGrowth,
      marketplaceConversion: conv,
    },
    categoryPerf,
    topSellers,
    topProducts,
    newSignups: newSignups ?? { buyers: 0, sellers: 0 },
    search: {
      total: totalSearches,
      failed: failedSearches,
      failRate: searchFailRate,
      top: topSearches.map((r) => ({ ...r, avg_results: Number(r.avg_results ?? 0) })),
      zero: zeroSearches,
    },
  };
}

// ---------------------------------------------------------------------------
// Risk
// ---------------------------------------------------------------------------
export type RiskBand = "low" | "medium" | "high";

export interface RiskEventRow {
  id: number;
  user_id: string | null;
  seller_id: string | null;
  order_id: string | null;
  kind: string;
  score: number;
  band: RiskBand;
  reasons: string[];
  action: string;
  created_at: number;
  buyer_username: string | null;
  seller_username: string | null;
  order_no: string | null;
  order_total_cents: number | null;
  order_status: string | null;
  escrow_status: string | null;
}

export async function getRiskOverview() {
  await appContext();
  await requireStaff();
  const t = Date.now();
  const d1 = t - 86_400_000;
  const d7 = t - 7 * 86_400_000;
  const [held, last24, last7, highBand] = await Promise.all([
    q1<{ c: number; s: number }>(
      `select count(*) c, coalesce(sum(total_cents),0) s from orders where escrow_status = 'on_hold'`,
    ),
    q1<{ c: number }>(`select count(*) c from risk_events where created_at > ?`, [d1]),
    q1<{ c: number }>(`select count(*) c from risk_events where created_at > ?`, [d7]),
    q1<{ c: number }>(`select count(*) c from risk_events where band = 'high' and created_at > ?`, [
      d1,
    ]),
  ]);
  return {
    heldOrders: held?.c ?? 0,
    heldGmvCents: held?.s ?? 0,
    events24h: last24?.c ?? 0,
    events7d: last7?.c ?? 0,
    highBand24h: highBand?.c ?? 0,
  };
}

export async function listRiskEvents(input: unknown) {
  const data = z
    .object({
      band: z.enum(["all", "low", "medium", "high"]).default("all"),
      limit: z.number().int().min(1).max(200).default(50),
    })
    .parse(input);
  await appContext();
  await requireStaff();
  const where = data.band === "all" ? "" : `where r.band = ?`;
  const params: Array<string | number> = data.band === "all" ? [] : [data.band];
  params.push(data.limit);
  const rows = await q<RiskEventRow>(
    `select r.id, r.user_id, r.seller_id, r.order_id, r.kind, r.score, r.band,
            r.reasons as reasons, r.action, r.created_at,
            b.username as buyer_username, s.username as seller_username,
            o.order_no, o.total_cents as order_total_cents,
            o.status as order_status, o.escrow_status
       from risk_events r
       left join users b on b.id = r.user_id
       left join users s on s.id = r.seller_id
       left join orders o on o.id = r.order_id
       ${where}
       order by r.created_at desc
       limit ?`,
    params,
  );
  return {
    events: rows.map((r) => ({
      ...r,
      reasons: typeof r.reasons === "string" ? safeJson(r.reasons) : r.reasons,
    })),
  };
}

function safeJson(s: string): string[] {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v.map(String) : [String(v)];
  } catch {
    return [s];
  }
}

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------
export interface PaymentMethod {
  code: string;
  name: string;
  kind: string;
  enabled: number;
  is_default: number;
  sort: number;
}

export async function adminListPaymentMethods() {
  await appContext();
  await requireAdmin();
  const methods = await q<PaymentMethod & { config: string | null }>(
    `select code, name, kind, enabled, is_default, sort, config from payment_methods order by sort`,
  );
  return { methods };
}

export async function adminSetPaymentMethod(input: unknown) {
  const data = z.object({ code: z.string().min(2).max(40), enabled: z.boolean() }).parse(input);
  await appContext();
  const staff = await requireAdmin();
  await run(`update payment_methods set enabled = ? where code = ?`, [
    data.enabled ? 1 : 0,
    data.code,
  ]);
  await audit(staff.id, "payment_method.toggle", "payment_method", data.code, {
    enabled: data.enabled,
  });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Credits (admin)
// ---------------------------------------------------------------------------
export interface CreditLedgerRow {
  id: number;
  user_id: string;
  order_id: string | null;
  type: string;
  amount_cents: number;
  balance_after_cents: number;
  source: string | null;
  note: string | null;
  created_at: number;
}

export async function adminListCredits(input: unknown) {
  const data = z
    .object({
      q: z.string().max(60).optional(),
      withBalanceOnly: z.boolean().default(true),
    })
    .parse(input);
  await appContext();
  const user = await requireUser();
  if (!isStaff(user)) fail("Staff only.");
  const needle = `%${(data.q ?? "").toLowerCase()}%`;
  const rows = await q<{
    user_id: string;
    username: string;
    email: string;
    balance_cents: number;
    updated_at: number;
  }>(
    `select bc.user_id, u.username, u.email, bc.balance_cents, bc.updated_at
       from buyer_credits bc join users u on u.id = bc.user_id
      where (? = '%%' or lower(u.username) like ? or lower(u.email) like ?)
        and (? = 0 or bc.balance_cents > 0)
      order by bc.balance_cents desc, bc.updated_at desc limit 200`,
    [needle, needle, needle, data.withBalanceOnly ? 1 : 0],
  );
  return { rows };
}

export async function adminGetUserCredits(input: unknown) {
  const data = z.object({ userId: z.string() }).parse(input);
  await appContext();
  const user = await requireUser();
  if (!isStaff(user)) fail("Staff only.");
  const c = await getBuyerCredits(data.userId);
  const u = await q1<{ username: string; email: string }>(
    `select username, email from users where id = ?`,
    [data.userId],
  );
  const ledger = await q<CreditLedgerRow>(
    `select id, user_id, order_id, type, amount_cents, balance_after_cents, source, note, created_at
       from credit_ledger where user_id = ? order by created_at desc limit 200`,
    [data.userId],
  );
  return { user: u, balance: c.balance_cents, ledger };
}

export async function adminAdjustCredits(input: unknown) {
  const data = z
    .object({
      userId: z.string(),
      amountCents: z.number().int(),
      note: z.string().min(3).max(500),
    })
    .parse(input);
  await appContext();
  const user = await requireUser();
  if (!isStaff(user)) fail("Staff only.");
  if (data.amountCents === 0) fail("Amount cannot be zero.");
  if (data.amountCents > 0) {
    await txCreditGrant(
      data.userId,
      data.amountCents,
      "adjustment",
      `Admin grant: ${data.note}`,
      null,
      user.id,
    );
  } else {
    const c = await getBuyerCredits(data.userId);
    if (c.balance_cents + data.amountCents < 0)
      fail("Adjustment would make credit balance negative.");
    await tx(async () => {
      await run(
        `update buyer_credits set balance_cents = balance_cents + ?, updated_at = ? where user_id = ?`,
        [data.amountCents, now(), data.userId],
      );
      const updated = (await q1<{ balance_cents: number }>(
        `select balance_cents from buyer_credits where user_id = ?`,
        [data.userId],
      ))!;
      await run(
        `insert into credit_ledger (user_id, order_id, type, amount_cents, balance_after_cents, source, note, actor_id, created_at)
         values (?,?,?,?,?,?,?,?,?)`,
        [
          data.userId,
          null,
          "adjustment",
          data.amountCents,
          updated.balance_cents,
          "adjustment",
          `Admin revoke: ${data.note}`,
          user.id,
          now(),
        ],
      );
    });
  }
  await audit(user.id, "credits.adjust", "user", data.userId, {
    amountCents: data.amountCents,
    note: data.note,
  });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Admin: cross-platform chat monitor. Staff-only.
// ---------------------------------------------------------------------------
export async function adminListConversations(input: unknown) {
  const data = z
    .object({
      q: z.string().max(80).optional(),
      flaggedOnly: z.boolean().optional(),
      limit: z.number().int().min(10).max(200).default(50),
    })
    .parse(input);
  await appContext();
  const user = await requireUser();
  if (!isStaff(user)) fail("Staff access required.");
  const where: string[] = [];
  const params: Array<string | number> = [];
  if (data.q) {
    const like = `%${data.q.toLowerCase()}%`;
    where.push(
      `(lower(ub.username) like ? or lower(us.username) like ? or lower(coalesce(o.order_no,'')) like ?)`,
    );
    params.push(like, like, like);
  }
  if (data.flaggedOnly) {
    where.push(
      `exists (select 1 from messages m where m.conversation_id = cv.id and m.is_flagged = 1)`,
    );
  }
  const whereSql = where.length ? `where ${where.join(" and ")}` : "";
  params.push(data.limit);
  const rows = await q<Record<string, string | number | null>>(
    `select cv.id, cv.order_id, cv.product_id, cv.created_at, cv.last_message_at,
            ub.username as buyer_name, us.username as seller_name,
            o.order_no, o.status as order_status,
            (select count(*) from messages m where m.conversation_id = cv.id) as msg_count,
            (select count(*) from messages m where m.conversation_id = cv.id and m.is_flagged = 1) as flagged_count,
            (select body from messages m where m.conversation_id = cv.id order by m.created_at desc limit 1) as last_body
       from conversations cv
       join users ub on ub.id = cv.buyer_id
       join users us on us.id = cv.seller_id
       left join orders o on o.id = cv.order_id
       ${whereSql}
       order by coalesce(cv.last_message_at, cv.created_at) desc
       limit ?`,
    params,
  );
  return { conversations: rows };
}

// ---------------------------------------------------------------------------
// Trust / verifications
// ---------------------------------------------------------------------------
export interface SellerVerification {
  id: string;
  user_id: string;
  username?: string;
  tier_requested: "verified" | "business" | "premium";
  legal_name: string;
  country: string;
  business_name: string | null;
  business_registration: string | null;
  id_doc_ref: string | null;
  notes: string | null;
  contact_phone: string | null;
  contact_whatsapp: string | null;
  contact_telegram: string | null;
  status: "pending" | "approved" | "rejected";
  reviewed_by: string | null;
  admin_note: string | null;
  created_at: number;
  reviewed_at: number | null;
}

export async function listVerifications(input: unknown) {
  const data = z
    .object({
      status: z.enum(["pending", "approved", "rejected", "all"]).default("pending"),
    })
    .parse(input);
  await appContext();
  await requireStaff(["admin", "support"]);
  const rows = await q<Row>(
    `select v.*, u.username from seller_verifications v
       join users u on u.id = v.user_id
       ${data.status === "all" ? "" : "where v.status = ?"}
       order by v.created_at desc limit 200`,
    data.status === "all" ? [] : [data.status],
  );
  return { rows };
}

export async function reviewVerification(input: unknown) {
  const data = z
    .object({
      id: z.string(),
      decision: z.enum(["approved", "rejected"]),
      adminNote: z.string().trim().max(1000).optional(),
    })
    .parse(input);
  await appContext();
  const staff = await requireStaff(["admin", "support"]);
  const app = await q1<{
    id: string;
    user_id: string;
    tier_requested: string;
    status: string;
  }>(`select * from seller_verifications where id = ?`, [data.id]);
  if (!app) fail("Application not found.");
  if (app!.status !== "pending") fail("This application was already reviewed.");

  await run(
    `update seller_verifications set status = ?, reviewed_by = ?, admin_note = ?, reviewed_at = ? where id = ?`,
    [data.decision, staff.id, data.adminNote ?? null, now(), data.id],
  );

  const { TIER_META, recomputeSellerTrust } = await import("@/lib/server/trust.server");
  if (data.decision === "approved") {
    await run(`update users set verification_tier = ? where id = ?`, [
      app!.tier_requested,
      app!.user_id,
    ]);
    await recomputeSellerTrust(app!.user_id);
    await notify(
      app!.user_id,
      "verification_approved",
      "Verification approved",
      `You are now ${TIER_META[app!.tier_requested as keyof typeof TIER_META].label.toLowerCase()} on X-VAULT.`,
      `/seller/verification`,
    );
  } else {
    await notify(
      app!.user_id,
      "verification_rejected",
      "Verification not approved",
      data.adminNote ?? "Please review feedback and reapply.",
      `/seller/verification`,
    );
  }
  await audit(staff.id, `verification.${data.decision}`, "seller_verification", data.id);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// AI Support Assistant — classify dispute + suggest reply
// ---------------------------------------------------------------------------
export async function aiAssistDispute(input: unknown) {
  const data = z.object({ orderId: z.string() }).parse(input);
  await appContext();
  await requireStaff(["admin", "support"]);
  const dispute = await q1<{
    id: string;
    reason: string;
    description: string | null;
    seller_response: string | null;
    status: string;
    product_title: string;
    total_cents: number;
  }>(
    `select d.id, d.reason, d.description, d.seller_response, d.status,
            o.product_title, o.total_cents
       from disputes d join orders o on o.id = d.order_id
       where d.order_id = ?`,
    [data.orderId],
  );
  if (!dispute) fail("No dispute found.");
  const messages = await q<{ author_role: string; body: string }>(
    `select author_role, body from dispute_messages where dispute_id = ? and is_internal = 0
     order by created_at asc limit 30`,
    [dispute!.id],
  );
  const transcript =
    messages.map((m) => `[${m.author_role}] ${m.body}`).join("\n") || "(no messages)";

  type Out = {
    category: string;
    severity: "low" | "medium" | "high";
    summary: string;
    suggestedReply: string;
    suggestedResolution: "refund_buyer" | "release_seller" | "partial_refund" | "needs_info";
  };
  const out = await callAiJson<Out>({
    messages: [
      {
        role: "system",
        content:
          "You are X-VAULT's senior support assistant. Triage marketplace disputes. " +
          "Be neutral and concise. Return ONLY valid JSON.",
      },
      {
        role: "user",
        content: `Product: ${dispute!.product_title}
Order value: $${(dispute!.total_cents / 100).toFixed(2)}
Reason code: ${dispute!.reason}
Buyer description: ${dispute!.description ?? "(none)"}
Seller response: ${dispute!.seller_response ?? "(none)"}

Conversation:
${transcript}

Return JSON: {
  "category": one of ["non_delivery","wrong_item","account_recovered","quality","fraud_buyer","other"],
  "severity": "low" | "medium" | "high",
  "summary": 2-sentence neutral summary,
  "suggestedReply": professional reply staff can send to both parties,
  "suggestedResolution": "refund_buyer" | "release_seller" | "partial_refund" | "needs_info"
}`,
      },
    ],
    temperature: 0.3,
  });
  return out;
}

// ---------------------------------------------------------------------------
// i18n / FX
// ---------------------------------------------------------------------------
export interface FxRate {
  currency: string;
  rate_to_base: number;
  symbol: string | null;
  updated_at: number;
}

export const ISO_COUNTRIES: Array<{ code: string; name: string }> = [
  { code: "US", name: "United States" },
  { code: "GB", name: "United Kingdom" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "ES", name: "Spain" },
  { code: "IT", name: "Italy" },
  { code: "NL", name: "Netherlands" },
  { code: "PL", name: "Poland" },
  { code: "TR", name: "Türkiye" },
  { code: "RU", name: "Russia" },
  { code: "UA", name: "Ukraine" },
  { code: "BR", name: "Brazil" },
  { code: "AR", name: "Argentina" },
  { code: "MX", name: "Mexico" },
  { code: "CA", name: "Canada" },
  { code: "AU", name: "Australia" },
  { code: "JP", name: "Japan" },
  { code: "KR", name: "South Korea" },
  { code: "CN", name: "China" },
  { code: "IN", name: "India" },
  { code: "ID", name: "Indonesia" },
  { code: "PH", name: "Philippines" },
  { code: "VN", name: "Vietnam" },
  { code: "TH", name: "Thailand" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "SA", name: "Saudi Arabia" },
  { code: "EG", name: "Egypt" },
  { code: "NG", name: "Nigeria" },
  { code: "ZA", name: "South Africa" },
  { code: "KE", name: "Kenya" },
];

export const LOCALES: Array<{ code: string; label: string }> = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "pt", label: "Português" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "it", label: "Italiano" },
  { code: "ru", label: "Русский" },
  { code: "uk", label: "Українська" },
  { code: "tr", label: "Türkçe" },
  { code: "ar", label: "العربية" },
  { code: "hi", label: "हिन्दी" },
  { code: "id", label: "Bahasa Indonesia" },
  { code: "ja", label: "日本語" },
  { code: "ko", label: "한국어" },
  { code: "zh", label: "中文" },
];

export async function getI18nBootstrap() {
  await appContext();
  const [settings, rates] = await Promise.all([
    q1<{ base_currency: string }>(`select base_currency from site_settings where id = 1`),
    q<FxRate>(`select currency, rate_to_base, symbol, updated_at from fx_rates order by currency`),
  ]);
  return {
    baseCurrency: settings?.base_currency ?? "USD",
    rates,
    countries: ISO_COUNTRIES,
    locales: LOCALES,
  };
}

export async function adminUpsertFxRate(input: unknown) {
  const data = z
    .object({
      currency: z
        .string()
        .min(3)
        .max(4)
        .regex(/^[A-Z]+$/),
      rate_to_base: z.number().positive().max(10_000_000),
      symbol: z.string().max(4).optional(),
    })
    .parse(input);
  await appContext();
  const user = await requireStaff(["admin", "finance"]);
  const existing = await q1(`select 1 as x from fx_rates where currency = ?`, [data.currency]);
  if (existing) {
    await run(
      `update fx_rates set rate_to_base = ?, symbol = ?, updated_at = ? where currency = ?`,
      [data.rate_to_base, data.symbol ?? null, now(), data.currency],
    );
  } else {
    await run(
      `insert into fx_rates (currency, rate_to_base, symbol, updated_at) values (?,?,?,?)`,
      [data.currency, data.rate_to_base, data.symbol ?? null, now()],
    );
  }
  await audit(user.id, "fx.upsert", "fx_rate", data.currency);
  return { ok: true };
}

export async function adminDeleteFxRate(input: unknown) {
  const data = z.object({ currency: z.string() }).parse(input);
  await appContext();
  const user = await requireStaff(["admin", "finance"]);
  if (data.currency === "USD") fail("USD cannot be deleted.");
  await run(`delete from fx_rates where currency = ?`, [data.currency]);
  await audit(user.id, "fx.delete", "fx_rate", data.currency);
  return { ok: true };
}

export async function adminSetBaseCurrency(input: unknown) {
  const data = z.object({ currency: z.string().min(3).max(4) }).parse(input);
  await appContext();
  const user = await requireStaff(["admin"]);
  const row = await q1(`select 1 as x from fx_rates where currency = ?`, [data.currency]);
  if (!row) fail("Currency not in rate table.");
  await run(`update site_settings set base_currency = ? where id = 1`, [data.currency]);
  clearSettingsCache();
  await audit(user.id, "fx.set_base", "site_settings", data.currency);
  return { ok: true };
}
