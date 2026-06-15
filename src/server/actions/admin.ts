"use server";

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
import { requireAdmin, requireStaff, isStaff, requireUser } from "@/server/auth";
import {
  getOrderRow,
  refundOrder,
  releaseOrder,
  expireOrder,
  adminEscrowHold,
  adminEscrowUnhold,
  adminExtendWarranty,
} from "@/lib/server/lifecycle.server";
import {
  txAdjustment,
  txSetFreeze,
  txWithdrawalReversal,
  getBuyerCredits,
  txCreditGrant,
} from "@/lib/server/money.server";
import { invalidateCache } from "@/lib/server/cache.server";
import { recomputeSellerTrust } from "@/lib/server/trust.server";

// ---------------------------------------------------------------------------
// Row types (must match what admin client pages destructure)
// ---------------------------------------------------------------------------

type SellerApplicationRow = {
  id: string; user_id: string; username: string; email: string;
  status: string; admin_note: string | null; created_at: number;
  full_name: string | null; display_name: string | null; country: string | null;
  years_experience: number | null; monthly_volume: number | null;
  product_categories: string | null; source_of_goods: string | null;
  usdt_network: string | null; telegram: string | null; whatsapp: string | null;
  wechat: string | null; experience: string | null;
  usdt_payout_address: string | null; portfolio: string | null;
};
type ProductReviewRow = {
  id: string; title: string; status: string; slug: string; risk_tier: string;
  seller_name: string; category_name: string; price_cents: number; created_at: number;
};
type FlaggedMessageRow = {
  id: string; body: string; flag_reason: string; sender_name: string;
  conversation_id: string; created_at: number; moderated_at: number | null;
};
type DisputeRow = {
  id: string; order_no: string; product_title: string; total_cents: number;
  status: string; created_at: number; buyer_name: string; seller_name: string;
  reason: string; description: string | null; seller_response: string | null;
  resolution: string | null; resolution_cents: number | null; resolved_at: number | null;
};
type AdminOrderRow = {
  id: string; order_no: string; product_title: string; status: string;
  escrow_status: string | null; escrow_hold_reason: string | null;
  total_cents: number; buyer_name: string; seller_name: string;
  created_at: number; warranty_ends_at: number | null;
};
type CategoryRow = {
  id: string; name: string; slug: string; icon: string | null; sort: number;
  default_warranty_hours: number; commission_pct: number; risk_tier: string;
  is_active: number; submission_schema: string | null; requires_subscription: number;
  allowed_durations: string | null; product_count: number;
  admin_description: string | null; delivery_kind: string | null;
};

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export async function getAdminDashboardAction() {
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
    usersRow,
    topSellers,
    paidOrders,
  ] = await Promise.all([
    gmv(t - dayMs),
    gmv(t - 30 * dayMs),
    q1<{ s: number }>(
      `select coalesce(sum(commission_cents),0) s from orders where status = 'released'`,
    ),
    q<{ status: string; c: number }>(`select status, count(*) c from orders group by status`),
    q1<{ c: number }>(`select count(*) c from seller_applications where status = 'pending'`),
    q1<{ c: number }>(`select count(*) c from products where status = 'pending_review'`),
    q1<{ c: number }>(`select count(*) c from disputes where status != 'resolved'`),
    q1<{ c: number }>(`select count(*) c from withdrawals where status = 'pending'`),
    q1<{ c: number }>(
      `select count(*) c from messages where is_flagged = 1 and moderated_at is null`,
    ),
    q1<{ s: number }>(`select coalesce(sum(pending_cents),0) s from wallets`),
    q1<{ c: number }>(`select count(*) c from users`),
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

  // Build 14-day daily GMV array
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
    pending: {
      sellerApplications: sellerApplications!.c,
      productReviews: productReviews!.c,
      openDisputes: openDisputes!.c,
      withdrawals: withdrawals!.c,
      flaggedMessages: flaggedMessages!.c,
    },
    escrowHeld: escrowRow!.s,
    users: usersRow!.c,
    topSellers,
  };
}

// ---------------------------------------------------------------------------
// Realtime pulse — lightweight header metrics
// ---------------------------------------------------------------------------

export async function getAdminPulseAction() {
  await appContext();
  await requireStaff();
  const t = now();
  const dayMs = 86_400_000;
  const since = t - dayMs;

  const [
    orders24hRow,
    gmv24hRow,
    refunds24hRow,
    escrowOnHoldRow,
    newUsers24hRow,
    activeDisputesRow,
    pendingWithdrawalRow,
    avgTrustRow,
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
  ]);

  return {
    orders24h: { c: orders24hRow!.c },
    gmv24h: gmv24hRow!.s,
    refunds24h: { s: refunds24hRow!.s, c: refunds24hRow!.c },
    escrowOnHold: escrowOnHoldRow!.c,
    newUsers24h: newUsers24hRow!.c,
    activeDisputes: activeDisputesRow!.c,
    pendingWithdrawalAmt: pendingWithdrawalRow!.s,
    avgTrust: Math.round(avgTrustRow!.s),
    ts: t,
  };
}

// ---------------------------------------------------------------------------
// Seller approvals
// ---------------------------------------------------------------------------

export async function listSellerApplicationsAction() {
  await appContext();
  await requireStaff();
  return q<SellerApplicationRow>(
    `select a.*, u.username, u.email from seller_applications a join users u on u.id = a.user_id
     order by case a.status when 'pending' then 0 else 1 end, a.created_at desc limit 200`,
  );
}

export async function reviewSellerApplicationAction(input: {
  applicationId: string;
  approve: boolean;
  note?: string;
}) {
  await appContext();
  const staff = await requireAdmin();
  const app = await q1<{ id: string; user_id: string; status: string }>(
    `select * from seller_applications where id = ?`,
    [input.applicationId],
  );
  if (!app || app.status !== "pending") fail("Application not found or already reviewed.");
  const status = input.approve ? "approved" : "rejected";
  await run(
    `update seller_applications set status = ?, admin_note = ?, reviewed_by = ?, reviewed_at = ? where id = ?`,
    [status, input.note ?? null, staff.id, now(), input.applicationId],
  );
  if (input.approve) {
    await run(`update users set seller_status = 'approved', role = 'seller' where id = ?`, [
      app!.user_id,
    ]);
    await recomputeSellerTrust(app!.user_id);
  } else {
    await run(`update users set seller_status = 'rejected' where id = ?`, [app!.user_id]);
  }
  await notify(
    app!.user_id,
    "seller_application",
    input.approve ? "Seller application approved 🎉" : "Seller application rejected",
    input.note ?? (input.approve ? "You can now list products." : "See admin note."),
    input.approve ? "/seller" : "/sell",
  );
  await audit(staff.id, `seller_application.${status}`, "seller_application", input.applicationId, {
    note: input.note,
  });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Product approvals
// ---------------------------------------------------------------------------

export async function listProductReviewQueueAction() {
  await appContext();
  await requireStaff();
  return q<ProductReviewRow>(
    `select p.*, u.username as seller_name, c.name as category_name, c.risk_tier
     from products p join users u on u.id = p.seller_id join categories c on c.id = p.category_id
     order by case p.status when 'pending_review' then 0 else 1 end, p.created_at desc limit 300`,
  );
}

export async function reviewProductAction(input: {
  productId: string;
  approve: boolean;
  reason?: string;
}) {
  await appContext();
  const staff = await requireAdmin();
  const p = await q1<{
    id: string;
    seller_id: string;
    title: string;
    status: string;
    delivery_type: string;
    stock_count: number;
  }>(`select id, seller_id, title, status, delivery_type, stock_count from products where id = ?`, [
    input.productId,
  ]);
  if (!p) fail("Product not found.");
  if (p!.status !== "pending_review") fail("Product is not awaiting review.");
  if (input.approve) {
    const next = p!.delivery_type === "auto" && p!.stock_count === 0 ? "out_of_stock" : "active";
    await run(`update products set status = ?, reject_reason = null where id = ?`, [
      next,
      input.productId,
    ]);
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
        input.productId,
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
    if (!input.reason) fail("A rejection reason is required.");
    await run(`update products set status = 'rejected', reject_reason = ? where id = ?`, [
      input.reason!,
      input.productId,
    ]);
  }
  await notify(
    p!.seller_id,
    "product_review",
    input.approve ? "Product approved" : "Product rejected",
    `${p!.title}${input.reason ? ` — ${input.reason}` : ""}`,
    "/seller/products",
  );
  await audit(
    staff.id,
    `product.${input.approve ? "approve" : "reject"}`,
    "product",
    input.productId,
    { reason: input.reason },
  );
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Orders (global)
// ---------------------------------------------------------------------------

export async function adminListOrdersAction(input: { q?: string; status?: string } = {}) {
  await appContext();
  await requireStaff();
  const where: string[] = ["1=1"];
  const params: Array<string | number> = [];
  if (input.q) {
    const like = `%${input.q.toLowerCase()}%`;
    where.push(
      `(lower(o.order_no) like ? or lower(o.product_title) like ? or lower(ub.username) like ? or lower(us.username) like ?)`,
    );
    params.push(like, like, like, like);
  }
  if (input.status) {
    where.push(`o.status = ?`);
    params.push(input.status);
  }
  return q<AdminOrderRow>(
    `select o.*, ub.username as buyer_name, us.username as seller_name
     from orders o join users ub on ub.id = o.buyer_id join users us on us.id = o.seller_id
     where ${where.join(" and ")} order by o.created_at desc limit 200`,
    params,
  );
}

export async function adminForceOrderAction(input: {
  orderId: string;
  action: "refund" | "release" | "cancel";
  note: string;
}) {
  await appContext();
  const staff = await requireAdmin();
  const o = await getOrderRow(input.orderId);
  if (!o) fail("Order not found.");
  if (input.action === "cancel") {
    if (o!.status !== "awaiting_payment") fail("Only unpaid orders can be cancelled.");
    await expireOrder(input.orderId, `Admin: ${input.note}`, "cancelled");
  } else if (input.action === "refund") {
    if (!["paid", "delivering", "delivered", "completed", "disputed"].includes(o!.status))
      fail("This order can't be refunded.");
    await refundOrder(input.orderId, o!.total_cents, `Admin: ${input.note}`);
  } else {
    if (!["delivered", "completed", "disputed"].includes(o!.status))
      fail("This order can't be released.");
    await releaseOrder(input.orderId, `Released by staff: ${input.note}`);
  }
  await audit(staff.id, `order.force_${input.action}`, "order", input.orderId, {
    note: input.note,
  });
  return { ok: true };
}

export async function adminEscrowAction(input: {
  orderId: string;
  action: "hold" | "unhold" | "extend";
  hours?: number;
  reason: string;
}) {
  await appContext();
  const staff = await requireAdmin();
  const o = await getOrderRow(input.orderId);
  if (!o) fail("Order not found.");
  if (input.action === "hold") {
    await adminEscrowHold(input.orderId, staff.id, input.reason);
  } else if (input.action === "unhold") {
    await adminEscrowUnhold(input.orderId, staff.id);
  } else {
    if (!input.hours) fail("Hours required for warranty extension.");
    await adminExtendWarranty(input.orderId, input.hours!, input.reason);
  }
  await audit(staff.id, `escrow.${input.action}`, "order", input.orderId, {
    reason: input.reason,
    hours: input.hours,
  });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Disputes center
// ---------------------------------------------------------------------------

export async function listDisputesAction() {
  await appContext();
  await requireStaff();
  return q<DisputeRow>(
    `select dd.*, o.order_no, o.product_title, o.total_cents, o.status as order_status,
            ub.username as buyer_name, us.username as seller_name, o.buyer_id, o.seller_id
     from disputes dd join orders o on o.id = dd.order_id
     join users ub on ub.id = o.buyer_id join users us on us.id = o.seller_id
     order by case dd.status when 'resolved' then 1 else 0 end, dd.created_at desc limit 200`,
  );
}

export async function resolveDisputeAction(input: {
  disputeId: string;
  resolution: "refund_full" | "refund_partial" | "release_seller";
  partialRefundUsdt?: number;
  note: string;
}) {
  await appContext();
  const staff = await requireStaff(["support", "admin"]);
  const dd = await q1<{ id: string; order_id: string; status: string }>(
    `select * from disputes where id = ?`,
    [input.disputeId],
  );
  if (!dd || dd.status === "resolved") fail("Dispute not found or already resolved.");
  const o = (await getOrderRow(dd!.order_id))!;
  let resolutionCents = 0;
  if (input.resolution === "refund_full") {
    resolutionCents = o.total_cents;
    await refundOrder(o.id, o.total_cents, `Dispute resolved: full refund. ${input.note}`);
  } else if (input.resolution === "refund_partial") {
    resolutionCents = Math.round((input.partialRefundUsdt ?? 0) * 100);
    if (resolutionCents <= 0 || resolutionCents >= o.total_cents)
      fail("Partial refund must be between 0 and the order total.");
    await refundOrder(o.id, resolutionCents, `Dispute resolved: partial refund. ${input.note}`);
  } else {
    await releaseOrder(o.id, `Dispute resolved in seller's favour: ${input.note}`);
  }
  await run(
    `update disputes set status = 'resolved', resolution = ?, resolution_cents = ?, resolved_by = ?, resolved_at = ? where id = ?`,
    [input.resolution, resolutionCents, staff.id, now(), input.disputeId],
  );
  const convId = await getOrCreateOrderConversation(o.id);
  await systemMessage(
    convId,
    `Dispute resolved (${input.resolution.replaceAll("_", " ")}): ${input.note}`,
  );
  await notify(
    o.buyer_id,
    "dispute_resolved",
    "Dispute resolved",
    `${o.order_no}: ${input.resolution.replaceAll("_", " ")}`,
    `/orders/${o.id}`,
  );
  await notify(
    o.seller_id,
    "dispute_resolved",
    "Dispute resolved",
    `${o.order_no}: ${input.resolution.replaceAll("_", " ")}`,
    `/orders/${o.id}`,
  );
  await audit(staff.id, "dispute.resolve", "dispute", input.disputeId, {
    resolution: input.resolution,
    note: input.note,
  });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Finance: withdrawals + deposits + wallet adjustments
// ---------------------------------------------------------------------------

export async function listWithdrawalQueueAction() {
  await appContext();
  await requireStaff(["finance", "admin"]);
  return q<{
    id: string;
    user_id: string;
    username: string;
    email: string;
    seller_level: number;
    amount_cents: number;
    fee_cents: number;
    wallet_address: string;
    usdt_network: string;
    status: string;
    tx_hash: string | null;
    wallet_available: number;
    created_at: number;
  }>(
    `select w.id, w.user_id, u.username, u.email, u.seller_level,
            w.amount_cents, w.fee_cents,
            coalesce(w.address,'') as wallet_address,
            coalesce(w.network,'TRC20') as usdt_network,
            w.status, w.tx_hash,
            coalesce((select available_cents from wallets where user_id = w.user_id),0) as wallet_available,
            w.created_at
     from withdrawals w join users u on u.id = w.user_id
     order by case w.status when 'pending' then 0 else 1 end, w.created_at desc limit 200`,
  );
}

export async function reviewWithdrawalAction(input: {
  withdrawalId: string;
  action: "approve" | "reject" | "mark_sent";
  txHash?: string;
  note?: string;
}) {
  await appContext();
  const staff = await requireStaff(["finance", "admin"]);
  const w = await q1<{
    id: string;
    user_id: string;
    amount_cents: number;
    fee_cents: number;
    status: string;
  }>(`select * from withdrawals where id = ?`, [input.withdrawalId]);
  if (!w) fail("Withdrawal not found.");
  if (input.action === "approve") {
    if (w!.status !== "pending") fail("Only pending withdrawals can be approved.");
    await run(
      `update withdrawals set status = 'approved', reviewed_by = ?, reviewed_at = ? where id = ?`,
      [staff.id, now(), w!.id],
    );
    await notify(w!.user_id, "withdrawal", "Withdrawal approved", "Payout is being processed.", "/seller/wallet");
  } else if (input.action === "mark_sent") {
    if (!["pending", "approved"].includes(w!.status)) fail("Withdrawal is not awaiting payout.");
    if (!input.txHash) fail("Transaction hash is required.");
    await run(
      `update withdrawals set status = 'sent', tx_hash = ?, reviewed_by = ?, reviewed_at = ? where id = ?`,
      [input.txHash!, staff.id, now(), w!.id],
    );
    await notify(
      w!.user_id,
      "withdrawal",
      "Withdrawal sent",
      `${(w!.amount_cents / 100).toFixed(2)} USDT sent — tx ${input.txHash!.slice(0, 18)}…`,
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
      input.note ?? "Funds returned to your wallet.",
      "/seller/wallet",
    );
  }
  await audit(staff.id, `withdrawal.${input.action}`, "withdrawal", input.withdrawalId, {
    note: input.note,
    txHash: input.txHash,
  });
  return { ok: true };
}

export async function listDepositsAction() {
  await appContext();
  await requireStaff(["finance", "admin"]);
  return q<{
    id: string;
    user_id: string;
    username: string;
    order_no: string | null;
    amount_cents: number;
    status: string;
    created_at: number;
  }>(
    `select dp.id, dp.user_id, u.username, o.order_no,
            dp.amount_cents, dp.status, dp.created_at
     from deposits dp
     join users u on u.id = dp.user_id left join orders o on o.id = dp.order_id
     order by dp.created_at desc limit 200`,
  );
}

export async function adminAdjustWalletAction(input: {
  userId: string;
  cents: number;
  note: string;
}) {
  await appContext();
  const staff = await requireAdmin();
  await txAdjustment(input.userId, input.cents, `Admin adjustment: ${input.note}`);
  await audit(staff.id, "wallet.adjust", "user", input.userId, {
    cents: input.cents,
    note: input.note,
  });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export async function adminListUsersAction(input: { q?: string } = {}) {
  await appContext();
  await requireStaff();
  const where = input.q ? `where lower(u.username) like ? or lower(u.email) like ?` : "";
  const like = `%${(input.q ?? "").toLowerCase()}%`;
  return q<{
    id: string;
    email: string;
    username: string;
    role: string;
    seller_status: string;
    seller_level: number;
    rating: number;
    total_sales: number;
    is_banned: number;
    wallet_frozen: number;
    created_at: number;
    available_cents: number;
    pending_cents: number;
    frozen_cents: number;
  }>(
    `select u.id, u.email, u.username, u.role, u.seller_status, u.seller_level, u.rating, u.total_sales,
            u.is_banned, u.wallet_frozen, u.created_at,
            coalesce(w.available_cents,0) available_cents, coalesce(w.pending_cents,0) pending_cents,
            coalesce(w.frozen_cents,0) frozen_cents
     from users u left join wallets w on w.user_id = u.id ${where} order by u.created_at desc limit 200`,
    input.q ? [like, like] : [],
  );
}

export async function adminUserActionAction(input: {
  userId: string;
  action: "ban" | "unban" | "freeze_wallet" | "unfreeze_wallet";
}) {
  await appContext();
  const staff = await requireAdmin();
  if (input.userId === staff.id && input.action === "ban")
    fail("You can't ban your own account.");
  switch (input.action) {
    case "ban":
      await run(`update users set is_banned = 1 where id = ?`, [input.userId]);
      await run(`delete from sessions where user_id = ?`, [input.userId]);
      break;
    case "unban":
      await run(`update users set is_banned = 0 where id = ?`, [input.userId]);
      break;
    case "freeze_wallet":
      await txSetFreeze(input.userId, true);
      break;
    case "unfreeze_wallet":
      await txSetFreeze(input.userId, false);
      break;
  }
  await audit(staff.id, `user.${input.action}`, "user", input.userId);
  return { ok: true };
}

export async function adminSetUserRoleAction(input: {
  userId: string;
  role: "buyer" | "seller" | "support" | "finance" | "admin";
}) {
  await appContext();
  const staff = await requireAdmin();
  if (input.userId === staff.id) fail("You can't change your own role.");
  await run(`update users set role = ? where id = ?`, [input.role, input.userId]);
  await audit(staff.id, "user.set_role", "user", input.userId, { role: input.role });
  return { ok: true };
}

export async function adminSetSellerLevelAction(input: { userId: string; level: number }) {
  await appContext();
  const staff = await requireAdmin();
  await run(`update users set seller_level = ? where id = ?`, [input.level, input.userId]);
  await audit(staff.id, "user.set_seller_level", "user", input.userId, { level: input.level });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export async function adminListCategoriesAction() {
  await appContext();
  await requireStaff();
  return q<CategoryRow>(
    `select c.*, (select count(*) from products p where p.category_id = c.id and p.status = 'active') product_count
     from categories c order by c.sort`,
  );
}

export async function adminSaveCategoryAction(input: {
  categoryId?: string;
  name: string;
  slug: string;
  icon?: string;
  sort?: number;
  defaultWarrantyHours: number;
  commissionPct: number;
  riskTier: "normal" | "high";
  isActive: boolean;
  submissionSchema?: string;
  requiresSubscription?: boolean;
  allowedDurations?: string[];
  adminDescription?: string;
  deliveryKind?: string;
}) {
  await appContext();
  const staff = await requireAdmin();
  let schema: string | null = null;
  if (input.submissionSchema?.trim()) {
    try {
      const parsed = JSON.parse(input.submissionSchema);
      if (typeof parsed !== "object" || parsed === null) throw new Error();
      schema = JSON.stringify(parsed);
    } catch {
      fail("Submission schema must be valid JSON.");
    }
  }
  const allowedCsv = (input.allowedDurations ?? []).join(",");
  const adminDesc = input.adminDescription?.trim() || null;
  const deliveryKind = input.deliveryKind ?? "code";
  if (input.categoryId) {
    await run(
      `update categories set name = ?, slug = ?, icon = ?, sort = coalesce(?, sort),
         default_warranty_hours = ?, commission_pct = ?, risk_tier = ?, is_active = ?,
         submission_schema = ?, requires_subscription = ?, allowed_durations = ?,
         admin_description = ?, delivery_kind = ?
       where id = ?`,
      [
        input.name,
        input.slug,
        input.icon ?? null,
        input.sort ?? null,
        input.defaultWarrantyHours,
        input.commissionPct,
        input.riskTier,
        input.isActive ? 1 : 0,
        schema,
        input.requiresSubscription ? 1 : 0,
        allowedCsv,
        adminDesc,
        deliveryKind,
        input.categoryId,
      ],
    );
  } else {
    if (await q1(`select 1 as x from categories where slug = ?`, [input.slug]))
      fail("Slug already exists.");
    await run(
      `insert into categories (id, name, slug, icon, sort, default_warranty_hours, commission_pct,
         risk_tier, is_active, submission_schema, requires_subscription, allowed_durations,
         admin_description, delivery_kind)
       values (?,?,?,?, (select coalesce(max(sort),0)+1 from categories), ?,?,?,?,?,?,?,?,?)`,
      [
        uid(),
        input.name,
        input.slug,
        input.icon ?? null,
        input.defaultWarrantyHours,
        input.commissionPct,
        input.riskTier,
        input.isActive ? 1 : 0,
        schema,
        input.requiresSubscription ? 1 : 0,
        allowedCsv,
        adminDesc,
        deliveryKind,
      ],
    );
  }
  await audit(staff.id, "category.save", "category", input.categoryId ?? input.slug);
  invalidateCache("home:v1");
  invalidateCache("catalog-items:v1");
  return { ok: true };
}

export async function adminEnsureBaseCategoriesAction() {
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

// ---------------------------------------------------------------------------
// Settings + audit + moderation
// ---------------------------------------------------------------------------

export async function getAdminSettingsAction() {
  await appContext();
  await requireStaff();
  return (await q1<Record<string, unknown>>(`select * from site_settings where id = 1`))!;
}

export async function updateAdminSettingsAction(input: {
  defaultCommissionPct: number;
  withdrawalFeeUsdt: number;
  minWithdrawalUsdt: number;
  autoConfirmHours: number;
  paymentWindowMinutes: number;
  maintenanceMode: boolean;
  announcement?: string;
  creditWithdrawalFeePct: number;
  creditWithdrawalMinFeeUsdt: number;
  attachmentMaxMb: number;
  presencePingSeconds: number;
  lowStockThreshold: number;
  disputeSlaHours: number;
  chatRateLimitPerMin: number;
  automodSeverity: "block" | "flag";
}) {
  await appContext();
  const staff = await requireAdmin();
  await run(
    `update site_settings set default_commission_pct = ?, withdrawal_fee_cents = ?,
       min_withdrawal_cents = ?, auto_confirm_hours = ?, payment_window_minutes = ?,
       maintenance_mode = ?, announcement = ?, credit_withdrawal_fee_pct = ?,
       credit_withdrawal_min_fee_cents = ?, attachment_max_mb = ?, presence_ping_seconds = ?,
       low_stock_threshold = ?, dispute_sla_hours = ?, chat_rate_limit_per_min = ?,
       automod_severity = ? where id = 1`,
    [
      input.defaultCommissionPct,
      Math.round(input.withdrawalFeeUsdt * 100),
      Math.round(input.minWithdrawalUsdt * 100),
      input.autoConfirmHours,
      input.paymentWindowMinutes,
      input.maintenanceMode ? 1 : 0,
      input.announcement?.trim() || null,
      input.creditWithdrawalFeePct,
      Math.round(input.creditWithdrawalMinFeeUsdt * 100),
      input.attachmentMaxMb,
      input.presencePingSeconds,
      input.lowStockThreshold,
      input.disputeSlaHours,
      input.chatRateLimitPerMin,
      input.automodSeverity,
    ],
  );
  await audit(staff.id, "settings.update", "site_settings", "1");
  clearSettingsCache();
  return { ok: true };
}

export async function listAuditLogsAction() {
  await appContext();
  await requireAdmin();
  return q<Record<string, unknown>>(
    `select a.*, u.username as actor_name from audit_logs a left join users u on u.id = a.actor_id
     order by a.id desc limit 300`,
  );
}

export async function listFlaggedMessagesAction() {
  await appContext();
  await requireStaff();
  return q<FlaggedMessageRow>(
    `select m.id, m.body, m.flag_reason, m.created_at, m.moderated_at,
            u.username as sender_name, m.conversation_id
     from messages m left join users u on u.id = m.sender_id
     where m.is_flagged = 1
     order by case when m.moderated_at is null then 0 else 1 end, m.created_at desc limit 200`,
  );
}

export async function moderateMessageAction(input: {
  messageId: string;
  action: "dismiss" | "remove";
}) {
  await appContext();
  const staff = await requireStaff();
  if (input.action === "remove") {
    await run(
      `update messages set body = '[removed by moderator]', moderated_at = ?, moderated_by = ? where id = ?`,
      [now(), staff.id, input.messageId],
    );
  } else {
    await run(
      `update messages set is_flagged = 0, moderated_at = ?, moderated_by = ? where id = ?`,
      [now(), staff.id, input.messageId],
    );
  }
  await audit(staff.id, `message.${input.action}`, "message", input.messageId);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Coupons
// ---------------------------------------------------------------------------

export async function adminListCouponsAction() {
  await appContext();
  await requireStaff();
  return q<Record<string, unknown>>(`select * from coupons order by created_at desc limit 200`);
}

export async function adminSaveCouponAction(input: {
  couponId?: string;
  code: string;
  pctOff: number;
  minTotalUsdt: number;
  maxUses: number;
  expiresInDays: number;
  isActive: boolean;
}) {
  await appContext();
  const staff = await requireAdmin();
  const expiresAt = input.expiresInDays > 0 ? now() + input.expiresInDays * 86_400_000 : null;
  if (input.couponId) {
    await run(
      `update coupons set code = ?, pct_off = ?, min_total_cents = ?, max_uses = ?, expires_at = ?, is_active = ? where id = ?`,
      [
        input.code.toUpperCase(),
        input.pctOff,
        Math.round(input.minTotalUsdt * 100),
        input.maxUses,
        expiresAt,
        input.isActive ? 1 : 0,
        input.couponId,
      ],
    );
  } else {
    if (await q1(`select 1 as x from coupons where lower(code) = lower(?)`, [input.code]))
      fail("A coupon with that code already exists.");
    await run(
      `insert into coupons (id, code, pct_off, min_total_cents, max_uses, expires_at, is_active, created_at)
       values (?,?,?,?,?,?,?,?)`,
      [
        uid(),
        input.code.toUpperCase(),
        input.pctOff,
        Math.round(input.minTotalUsdt * 100),
        input.maxUses,
        expiresAt,
        input.isActive ? 1 : 0,
        now(),
      ],
    );
  }
  await audit(staff.id, "coupon.save", "coupon", input.couponId ?? input.code);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Catalog items (games / brands / services) + seller suggestions
// ---------------------------------------------------------------------------

export async function adminListItemsAction() {
  await appContext();
  await requireStaff();
  const [items, maps, suggestions, categories] = await Promise.all([
    q<{ id: string; name: string; slug: string; is_active: number; sort: number; created_at: number }>(
      `select * from catalog_items order by sort, name`,
    ),
    q<{ item_id: string; category_id: string }>(
      `select item_id, category_id from catalog_item_categories`,
    ),
    q<Record<string, unknown>>(
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

export async function adminSaveItemAction(input: {
  itemId?: string;
  name: string;
  isActive: boolean;
  categoryIds: string[];
}) {
  await appContext();
  const staff = await requireAdmin();
  const slug = input.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  let id = input.itemId;
  if (id) {
    await run(`update catalog_items set name = ?, is_active = ? where id = ?`, [
      input.name,
      input.isActive ? 1 : 0,
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
      [id, input.name, slug, input.isActive ? 1 : 0, now()],
    );
  }
  for (const catId of input.categoryIds) {
    await run(
      `insert into catalog_item_categories (item_id, category_id) values (?,?) on conflict (item_id, category_id) do nothing`,
      [id!, catId],
    );
  }
  await audit(staff.id, "catalog_item.save", "catalog_item", id);
  invalidateCache("catalog-items:v1");
  invalidateCache("home:v1");
  return { itemId: id };
}

export async function reviewItemSuggestionAction(input: {
  suggestionId: string;
  approve: boolean;
  note?: string;
}) {
  await appContext();
  const staff = await requireAdmin();
  const s = await q1<{ id: string; user_id: string; name: string; status: string }>(
    `select * from item_suggestions where id = ?`,
    [input.suggestionId],
  );
  if (!s || s.status !== "pending") fail("Suggestion not found or already reviewed.");
  const status = input.approve ? "approved" : "rejected";
  await run(
    `update item_suggestions set status = ?, admin_note = ?, reviewed_by = ?, reviewed_at = ? where id = ?`,
    [status, input.note ?? null, staff.id, now(), input.suggestionId],
  );
  if (input.approve) {
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
    input.approve ? `"${s!.name}" was added to the catalog 🎉` : `Suggestion "${s!.name}" rejected`,
    input.note ?? (input.approve ? "You can now list products under it." : ""),
    "/seller/new-product",
  );
  await audit(staff.id, `item_suggestion.${status}`, "item_suggestion", input.suggestionId);
  if (input.approve) {
    invalidateCache("catalog-items:v1");
    invalidateCache("home:v1");
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Risk & fraud
// ---------------------------------------------------------------------------

export async function getRiskOverviewAction() {
  await appContext();
  await requireStaff();
  const t = now();
  const d1 = t - 86_400_000;
  const d7 = t - 7 * 86_400_000;
  const [held, last24, last7, highBand] = await Promise.all([
    q1<{ c: number; s: number }>(
      `select count(*) c, coalesce(sum(total_cents),0) s from orders where escrow_status = 'on_hold'`,
    ),
    q1<{ c: number }>(`select count(*) c from risk_events where created_at > ?`, [d1]),
    q1<{ c: number }>(`select count(*) c from risk_events where created_at > ?`, [d7]),
    q1<{ c: number }>(
      `select count(*) c from risk_events where band = 'high' and created_at > ?`,
      [d1],
    ),
  ]);
  return {
    heldOrders: held?.c ?? 0,
    heldGmvCents: held?.s ?? 0,
    events24h: last24?.c ?? 0,
    events7d: last7?.c ?? 0,
    highBand24h: highBand?.c ?? 0,
  };
}

export async function listRiskEventsAction(input: {
  band?: "all" | "low" | "medium" | "high";
  limit?: number;
} = {}) {
  await appContext();
  await requireStaff();
  const band = input.band ?? "all";
  const limit = input.limit ?? 50;
  const where = band === "all" ? "" : `where r.band = ?`;
  const params: Array<string | number> = band === "all" ? [] : [band];
  params.push(limit);
  const rows = await q<{
    id: number;
    order_id: string | null;
    order_no: string | null;
    order_total_cents: number | null;
    order_status: string | null;
    escrow_status: string | null;
    score: number;
    band: string;
    reasons: string | string[];
    created_at: number;
    buyer_username: string | null;
    seller_username: string | null;
  }>(
    `select r.id, r.order_id, r.score, r.band, r.reasons, r.created_at,
            b.username as buyer_username, s.username as seller_username,
            o.order_no, o.total_cents as order_total_cents,
            o.status as order_status, o.escrow_status
     from risk_events r
     left join users b on b.id = r.user_id
     left join users s on s.id = r.seller_id
     left join orders o on o.id = r.order_id
     ${where}
     order by r.created_at desc limit ?`,
    params,
  );
  return rows.map((r) => ({
    ...r,
    reasons: typeof r.reasons === "string" ? safeJsonArr(r.reasons) : r.reasons,
  }));
}

function safeJsonArr(s: string): string[] {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v.map(String) : [String(v)];
  } catch {
    return [s];
  }
}

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

export async function getAdminAnalyticsAction(input: { range?: "7d" | "30d" | "90d" } = {}) {
  await appContext();
  await requireStaff();
  const DAY = 86_400_000;
  const RANGES = { "7d": 7, "30d": 30, "90d": 90 } as const;
  const range = input.range ?? "30d";
  const days = RANGES[range];
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
    q<{ username: string; orders: number; gmv: number }>(
      `select u.username, count(o.id) orders, coalesce(sum(o.total_cents),0) gmv
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
      `select sum(case when role = 'buyer' then 1 else 0 end) buyers,
              sum(case when role = 'seller' or seller_status = 'approved' then 1 else 0 end) sellers
       from users where created_at > ?`,
      [since],
    ),
    q1<{ views: number; sold: number }>(
      `select coalesce(sum(views),0) views, coalesce(sum(sold_count),0) sold from products`,
    ),
    q<{ query: string; uses: number; avg_results: number }>(
      `select query, count(*) as uses, avg(results) as avg_results
       from search_queries
       where created_at > ? and length(query) >= 2 and results > 0
       group by query order by uses desc limit 15`,
      [since],
    ),
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

  const daily: Array<{ day: string; v: number; n: number }> = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(t - i * DAY);
    daily.push({ day: `${d.getMonth() + 1}/${d.getDate()}`, v: 0, n: 0 });
  }
  for (const r of paidRows) {
    const idx = days - 1 - Math.min(days - 1, Math.max(0, Math.floor((t - r.paid_at) / DAY)));
    daily[idx].v += r.v;
    daily[idx].n += r.n;
  }

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
    range,
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
// Verifications
// ---------------------------------------------------------------------------

export async function listVerificationsAction(input: {
  status: "pending" | "approved" | "rejected" | "all";
}) {
  await appContext();
  await requireStaff(["admin", "support"]);
  return q<{
    id: string;
    user_id: string;
    username: string;
    tier_requested: string;
    legal_name: string;
    country: string;
    business_name: string | null;
    notes: string | null;
    contact_phone: string | null;
    status: "pending" | "approved" | "rejected";
    admin_note: string | null;
    created_at: number;
    reviewed_at: number | null;
    evidence?: string | null;
  }>(
    `select v.*, u.username from seller_verifications v
     join users u on u.id = v.user_id
     ${input.status === "all" ? "" : "where v.status = ?"}
     order by v.created_at desc limit 200`,
    input.status === "all" ? [] : [input.status],
  );
}

export async function reviewVerificationAction(input: {
  id: string;
  decision: "approved" | "rejected";
  adminNote?: string;
}) {
  await appContext();
  const staff = await requireStaff(["admin", "support"]);
  const app = await q1<{
    id: string;
    user_id: string;
    tier_requested: string;
    status: string;
  }>(`select * from seller_verifications where id = ?`, [input.id]);
  if (!app) fail("Application not found.");
  if (app!.status !== "pending") fail("This application was already reviewed.");
  await run(
    `update seller_verifications set status = ?, reviewed_by = ?, admin_note = ?, reviewed_at = ? where id = ?`,
    [input.decision, staff.id, input.adminNote ?? null, now(), input.id],
  );
  if (input.decision === "approved") {
    await run(`update users set verification_tier = ? where id = ?`, [
      app!.tier_requested,
      app!.user_id,
    ]);
    await recomputeSellerTrust(app!.user_id);
    await notify(
      app!.user_id,
      "verification_approved",
      "Verification approved",
      `You are now ${app!.tier_requested} verified on X-VAULT.`,
      `/seller/verification`,
    );
  } else {
    await notify(
      app!.user_id,
      "verification_rejected",
      "Verification not approved",
      input.adminNote ?? "Please review feedback and reapply.",
      `/seller/verification`,
    );
  }
  await audit(staff.id, `verification.${input.decision}`, "seller_verification", input.id);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Buyer credits (admin)
// ---------------------------------------------------------------------------

export async function adminListCreditsAction(input: {
  q?: string;
  withBalanceOnly?: boolean;
}) {
  await appContext();
  const user = await requireUser();
  if (!isStaff(user)) fail("Staff only.");
  const needle = `%${(input.q ?? "").toLowerCase()}%`;
  return q<{
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
    [needle, needle, needle, input.withBalanceOnly ? 1 : 0],
  );
}

export async function adminGetUserCreditsAction(input: { userId: string }) {
  await appContext();
  const user = await requireUser();
  if (!isStaff(user)) fail("Staff only.");
  const c = await getBuyerCredits(input.userId);
  const u = await q1<{ username: string; email: string }>(
    `select username, email from users where id = ?`,
    [input.userId],
  );
  const ledger = await q<{
    id: number;
    type: string;
    amount_cents: number;
    balance_after_cents: number;
    source: string | null;
    note: string | null;
    created_at: number;
  }>(
    `select id, type, amount_cents, balance_after_cents, source, note, created_at
     from credit_ledger where user_id = ? order by created_at desc limit 200`,
    [input.userId],
  );
  return { username: u?.username, email: u?.email, balance_cents: c.balance_cents, ledger };
}

export async function adminAdjustCreditsAction(input: {
  userId: string;
  amountCents: number;
  note: string;
}) {
  await appContext();
  const user = await requireUser();
  if (!isStaff(user)) fail("Staff only.");
  if (input.amountCents === 0) fail("Amount cannot be zero.");
  if (input.amountCents > 0) {
    await txCreditGrant(
      input.userId,
      input.amountCents,
      "adjustment",
      `Admin grant: ${input.note}`,
      null,
      user.id,
    );
  } else {
    const c = await getBuyerCredits(input.userId);
    if (c.balance_cents + input.amountCents < 0)
      fail("Adjustment would make credit balance negative.");
    await tx(async () => {
      await run(
        `update buyer_credits set balance_cents = balance_cents + ?, updated_at = ? where user_id = ?`,
        [input.amountCents, now(), input.userId],
      );
      const updated = (await q1<{ balance_cents: number }>(
        `select balance_cents from buyer_credits where user_id = ?`,
        [input.userId],
      ))!;
      await run(
        `insert into credit_ledger (user_id, order_id, type, amount_cents, balance_after_cents, source, note, actor_id, created_at)
         values (?,?,?,?,?,?,?,?,?)`,
        [
          input.userId,
          null,
          "adjustment",
          input.amountCents,
          updated.balance_cents,
          "adjustment",
          `Admin revoke: ${input.note}`,
          user.id,
          now(),
        ],
      );
    });
  }
  await audit(user.id, "credits.adjust", "user", input.userId, {
    amountCents: input.amountCents,
    note: input.note,
  });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// FX & currency
// ---------------------------------------------------------------------------

export async function getI18nBootstrapAction() {
  await appContext();
  const [settings, rates] = await Promise.all([
    q1<{ base_currency: string }>(`select base_currency from site_settings where id = 1`),
    q<{ currency: string; rate_to_base: number; symbol: string | null; updated_at: number }>(
      `select currency, rate_to_base, symbol, updated_at from fx_rates order by currency`,
    ),
  ]);
  return {
    baseCurrency: settings?.base_currency ?? "USD",
    rates,
  };
}

export async function adminUpsertFxRateAction(input: {
  currency: string;
  rate_to_base: number;
  symbol?: string;
}) {
  await appContext();
  const user = await requireStaff(["admin", "finance"]);
  const existing = await q1(`select 1 as x from fx_rates where currency = ?`, [input.currency]);
  if (existing) {
    await run(
      `update fx_rates set rate_to_base = ?, symbol = ?, updated_at = ? where currency = ?`,
      [input.rate_to_base, input.symbol ?? null, now(), input.currency],
    );
  } else {
    await run(
      `insert into fx_rates (currency, rate_to_base, symbol, updated_at) values (?,?,?,?)`,
      [input.currency, input.rate_to_base, input.symbol ?? null, now()],
    );
  }
  await audit(user.id, "fx.upsert", "fx_rate", input.currency);
  return { ok: true };
}

export async function adminDeleteFxRateAction(input: { currency: string }) {
  await appContext();
  const user = await requireStaff(["admin", "finance"]);
  if (input.currency === "USD") fail("USD cannot be deleted.");
  await run(`delete from fx_rates where currency = ?`, [input.currency]);
  await audit(user.id, "fx.delete", "fx_rate", input.currency);
  return { ok: true };
}

export async function adminSetBaseCurrencyAction(input: { currency: string }) {
  await appContext();
  const user = await requireStaff(["admin"]);
  const row = await q1(`select 1 as x from fx_rates where currency = ?`, [input.currency]);
  if (!row) fail("Currency not in rate table.");
  await run(`update site_settings set base_currency = ? where id = 1`, [input.currency]);
  clearSettingsCache();
  await audit(user.id, "fx.set_base", "site_settings", input.currency);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Payment methods
// ---------------------------------------------------------------------------

export async function adminListPaymentMethodsAction() {
  await appContext();
  await requireAdmin();
  return q<{
    code: string;
    name: string;
    kind: string;
    enabled: number;
    is_default: number;
    sort: number;
  }>(`select code, name, kind, enabled, is_default, sort from payment_methods order by sort`);
}

export async function adminSetPaymentMethodAction(input: { code: string; enabled: boolean }) {
  await appContext();
  const staff = await requireAdmin();
  await run(`update payment_methods set enabled = ? where code = ?`, [
    input.enabled ? 1 : 0,
    input.code,
  ]);
  await audit(staff.id, "payment_method.toggle", "payment_method", input.code, {
    enabled: input.enabled,
  });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Conversations (admin monitor)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Admin chat viewer (read-only)
// ---------------------------------------------------------------------------

export async function adminGetConversationMessagesAction(conversationId: string) {
  await appContext();
  const user = await requireUser();
  if (!isStaff(user)) fail("Staff access required.");
  const conv = await q1<{
    id: string; buyer_id: string; seller_id: string; order_id: string | null;
  }>(`select * from conversations where id = ?`, [conversationId]);
  if (!conv) fail("Conversation not found.");
  const messages = await q<{
    id: string; sender_id: string | null; sender_name: string | null;
    body: string; is_system: number; is_flagged: number; created_at: number;
  }>(
    `select m.id, m.sender_id, u.username as sender_name, m.body,
            m.is_system, m.is_flagged, m.created_at
     from messages m left join users u on u.id = m.sender_id
     where m.conversation_id = ? order by m.created_at limit 500`,
    [conversationId],
  );
  const [buyer, seller] = await Promise.all([
    q1<{ username: string }>(`select username from users where id = ?`, [conv!.buyer_id]),
    q1<{ username: string }>(`select username from users where id = ?`, [conv!.seller_id]),
  ]);
  const order = conv!.order_id
    ? await q1<{ order_no: string; status: string; total_cents: number }>(
        `select order_no, status, total_cents from orders where id = ?`,
        [conv!.order_id],
      )
    : null;
  return {
    messages,
    buyerId: conv!.buyer_id,
    sellerId: conv!.seller_id,
    buyerName: buyer?.username ?? "buyer",
    sellerName: seller?.username ?? "seller",
    order,
  };
}

// ---------------------------------------------------------------------------
// Admin product edit
// ---------------------------------------------------------------------------

export async function adminGetProductAction(productId: string) {
  await appContext();
  await requireStaff();
  const product = await q1<Record<string, unknown>>(
    `select p.*, u.username as seller_name, c.name as category_name
     from products p join users u on u.id = p.seller_id join categories c on c.id = p.category_id
     where p.id = ?`,
    [productId],
  );
  if (!product) fail("Product not found.");
  const categories = await q<{
    id: string; name: string; commission_pct: number; default_warranty_hours: number;
  }>(`select id, name, commission_pct, default_warranty_hours from categories where is_active = 1 order by sort`);
  const items = await q<{ id: string; name: string }>(
    `select id, name from catalog_items where is_active = 1 order by sort, name`,
  );
  const itemCategories = await q<{ item_id: string; category_id: string }>(
    `select item_id, category_id from catalog_item_categories`,
  );
  return { product: product!, categories, items, itemCategories };
}

export async function adminUpdateProductAction(input: {
  productId: string;
  title: string;
  description: string;
  categoryId: string;
  itemId?: string | null;
  priceUsdt: number;
  warrantyHours?: number | null;
  minQty: number;
  maxQty: number;
  maxOrdersAtOnce?: number;
  region?: string;
  platform?: string;
  requiredInfo?: string;
  adminSeoDescription?: string;
  categoryAttrs?: Record<string, string>;
  status?: "active" | "paused" | "rejected" | "out_of_stock" | "pending_review";
  subscriptionDuration?: "7d" | "14d" | "1m" | "3m" | "6m" | "12m" | "lifetime" | null;
}) {
  await appContext();
  const staff = await requireAdmin();
  if (input.minQty > input.maxQty) fail("Min qty exceeds max qty.");
  if (input.itemId) {
    const allowed = await q<{ category_id: string }>(
      `select category_id from catalog_item_categories where item_id = ?`,
      [input.itemId],
    );
    if (allowed.length > 0 && !allowed.some((r) => r.category_id === input.categoryId))
      fail("That sub-category is not enabled for this category.");
  }
  await run(
    `update products set title = ?, description = ?, category_id = ?, item_id = ?,
       price_cents = ?, warranty_hours = ?, min_qty = ?, max_qty = ?,
       region = ?, platform = ?, required_info = ?, admin_seo_description = ?,
       category_attrs = ?, subscription_duration = ?, max_orders_at_once = ?
       ${input.status ? ", status = ?" : ""}
     where id = ?`,
    [
      input.title,
      input.description,
      input.categoryId,
      input.itemId ?? null,
      Math.round(input.priceUsdt * 100),
      input.warrantyHours ?? null,
      input.minQty,
      input.maxQty,
      input.region ?? null,
      input.platform ?? null,
      input.requiredInfo ?? null,
      input.adminSeoDescription?.trim() || null,
      input.categoryAttrs && Object.keys(input.categoryAttrs).length
        ? JSON.stringify(input.categoryAttrs)
        : null,
      input.subscriptionDuration ?? null,
      input.maxOrdersAtOnce ?? 10,
      ...(input.status ? [input.status] : []),
      input.productId,
    ],
  );
  await audit(staff.id, "product.admin_edit", "product", input.productId);
  invalidateCache("home:v1");
  invalidateCache("catalog-items:v1");
  return { ok: true };
}

export async function adminGetCategorySchemaAction(categoryId: string) {
  await appContext();
  await requireStaff();
  const cat = await q1<{ schema: string | null; config: string | null }>(
    `select schema, config from categories where id = ?`,
    [categoryId],
  );
  if (!cat) return { schema: null, config: null };
  return {
    schema: cat.schema
      ? (JSON.parse(cat.schema as string) as {
          sellerFields?: Array<{ key: string; label: string; type: string; required?: boolean; help?: string; options?: string[] }>;
        })
      : null,
    config: cat.config
      ? (JSON.parse(cat.config as string) as {
          requiresSubscription?: boolean;
          allowedDurations?: string[];
        })
      : null,
  };
}

export async function adminListConversationsAction(
  input: { q?: string; flaggedOnly?: boolean; limit?: number } = {},
) {
  await appContext();
  const user = await requireUser();
  if (!isStaff(user)) fail("Staff access required.");
  const where: string[] = [];
  const params: Array<string | number> = [];
  if (input.q) {
    const like = `%${input.q.toLowerCase()}%`;
    where.push(
      `(lower(ub.username) like ? or lower(us.username) like ? or lower(coalesce(o.order_no,'')) like ?)`,
    );
    params.push(like, like, like);
  }
  if (input.flaggedOnly) {
    where.push(
      `exists (select 1 from messages m where m.conversation_id = cv.id and m.is_flagged = 1)`,
    );
  }
  const whereSql = where.length ? `where ${where.join(" and ")}` : "";
  params.push(input.limit ?? 80);
  return q<{
    id: string;
    order_id: string | null;
    buyer_name: string;
    seller_name: string;
    order_no: string | null;
    msg_count: number;
    flagged_count: number;
    last_body: string | null;
    last_message_at: number | null;
    created_at: number;
  }>(
    `select cv.id, cv.order_id, cv.created_at, cv.last_message_at,
            ub.username as buyer_name, us.username as seller_name,
            o.order_no,
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
}
