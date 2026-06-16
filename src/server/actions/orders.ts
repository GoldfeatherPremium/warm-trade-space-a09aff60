"use server";

import { z } from "zod";
import { q, q1, run, tx } from "@/lib/server/db.server";
import { appContext } from "@/lib/server/app.server";
import {
  audit,
  getOrCreateOrderConversation,
  getSettings,
  makeOrderNo,
  makePayAddress,
  notify,
  now,
  systemMessage,
  uid,
} from "@/lib/server/core.server";
import { rateLimit } from "@/lib/server/rate-limit.server";
import { recomputeSellerTrust } from "@/lib/server/trust.server";
import { validateCoupon } from "@/lib/server/coupons.server";
import {
  completeOrder,
  confirmPayment,
  expireOrder,
  getOrderRow,
  refundOrder,
} from "@/lib/server/lifecycle.server";
import { getBuyerCredits, getWallet, txCreditSpend } from "@/lib/server/money.server";
import { requireUser } from "../auth";

export type OrderResult = { ok: true; orderId?: string } | { ok: false; error: string };

/** Wrap an action body so AppError/validation throws become {ok:false,error}. */
async function guard(fn: () => Promise<OrderResult>): Promise<OrderResult> {
  try {
    return await fn();
  } catch (e) {
    return { ok: false, error: (e as Error)?.message ?? "Something went wrong." };
  }
}

// ---------------------------------------------------------------------------
// Checkout — ports createOrder verbatim (atomic stock reservation + coupon
// redemption guards preserved exactly).
// ---------------------------------------------------------------------------
const createSchema = z.object({
  productId: z.string(),
  qty: z.number().int().min(1).max(1000),
  buyerInfo: z.string().max(2000).optional(),
  network: z.enum(["TRC20", "BEP20"]).default("TRC20"),
  couponCode: z.string().max(40).optional(),
  variantId: z.string().optional(),
});

export async function createOrderAction(input: z.infer<typeof createSchema>): Promise<OrderResult> {
  return guard(async () => {
    await appContext();
    const user = await requireUser();
    const data = createSchema.parse(input);
    rateLimit({ key: `order:${user.id}`, limit: 10, windowMs: 60_000 });
    const settings = await getSettings();

    const p = await q1<{
      id: string;
      seller_id: string;
      title: string;
      image_key: string | null;
      status: string;
      delivery_type: "auto" | "manual";
      delivery_sla_minutes: number;
      price_cents: number;
      min_qty: number;
      max_qty: number;
      stock_count: number;
      warranty_hours: number | null;
      cat_commission: number;
      default_warranty_hours: number;
      required_info: string | null;
      sale_price_cents: number | null;
      sale_ends_at: number | null;
    }>(
      `select p.*, c.commission_pct as cat_commission, c.default_warranty_hours, c.risk_tier
       from products p join categories c on c.id = p.category_id where p.id = ?`,
      [data.productId],
    );
    if (!p || p.status !== "active") return { ok: false, error: "This product is not available." };
    if (p.seller_id === user.id) return { ok: false, error: "You can't buy your own product." };
    if (data.qty < p.min_qty || data.qty > p.max_qty)
      return { ok: false, error: `Quantity must be between ${p.min_qty} and ${p.max_qty}.` };
    if (p.delivery_type === "manual" && p.required_info && !data.buyerInfo?.trim())
      return { ok: false, error: "This product requires delivery information at checkout." };

    const seller = (await q1<{ vacation_mode: number; is_banned: number }>(
      `select vacation_mode, is_banned from users where id = ?`,
      [p.seller_id],
    ))!;
    if (seller.vacation_mode || seller.is_banned)
      return { ok: false, error: "This seller is currently not accepting orders." };

    const region = await q1<{ allowed_countries: string | null; blocked_countries: string | null }>(
      `select allowed_countries, blocked_countries from products where id = ?`,
      [p.id],
    );
    const parseList = (s: string | null) => {
      if (!s) return [] as string[];
      try {
        const v = JSON.parse(s);
        return Array.isArray(v) ? v.map((x) => String(x).toUpperCase()) : [];
      } catch {
        return [];
      }
    };
    const allowed = parseList(region?.allowed_countries ?? null);
    const blocked = parseList(region?.blocked_countries ?? null);
    if (allowed.length || blocked.length) {
      const buyerCountry = (user as unknown as { country?: string | null }).country?.toUpperCase();
      if (!buyerCountry)
        return {
          ok: false,
          error: "Please set your country in Account settings before buying this product.",
        };
      if (allowed.length && !allowed.includes(buyerCountry))
        return { ok: false, error: "This product is not available in your country." };
      if (blocked.includes(buyerCountry))
        return { ok: false, error: "This product is not available in your country." };
    }

    const openUnpaid = (await q1<{ c: number }>(
      `select count(*) c from orders where buyer_id = ? and status = 'awaiting_payment'`,
      [user.id],
    ))?.c ?? 0;
    if (openUnpaid >= 5)
      return { ok: false, error: "You have too many unpaid orders. Pay or cancel them first." };

    const saleActive =
      p.sale_price_cents != null &&
      p.sale_price_cents > 0 &&
      (!p.sale_ends_at || p.sale_ends_at > now());
    let unitPrice = saleActive ? p.sale_price_cents! : p.price_cents;
    let titleSnapshot = p.title;
    let variantTitle: string | null = null;
    if (data.variantId) {
      const v = await q1<{ title: string; price_cents: number }>(
        `select title, price_cents from product_variants where id = ? and product_id = ?`,
        [data.variantId, p.id],
      );
      if (!v) return { ok: false, error: "Invalid option selected." };
      unitPrice = v.price_cents;
      variantTitle = v.title;
      titleSnapshot = `${p.title} — ${v.title}`;
    }
    const insuranceDays = (p as unknown as { insurance_days?: number }).insurance_days ?? 0;
    const warrantyHours = (p.warranty_hours ?? p.default_warranty_hours) + insuranceDays * 24;

    const orderId = uid();
    const t = now();
    let stockError: string | null = null;
    await tx(async () => {
      if (p.delivery_type === "auto") {
        const reserved = await q<{ id: string }>(
          `update stock_items set status = 'reserved', order_id = ?
             where status = 'available'
               and id in (
                 select id from stock_items
                  where product_id = ? and status = 'available'
                  order by id limit ?
               )
           returning id`,
          [orderId, p.id, data.qty],
        );
        if (reserved.length < data.qty) {
          stockError = `Only ${reserved.length} in stock.`;
          throw new Error(stockError);
        }
        await run(
          `update products set stock_count = (select count(*) from stock_items where product_id = ? and status = 'available') where id = ?`,
          [p.id, p.id],
        );
      }
      const grossTotal = unitPrice * data.qty;
      let discount = 0;
      let couponCode: string | null = null;
      if (data.couponCode?.trim()) {
        const coupon = await validateCoupon(data.couponCode, grossTotal, {
          sellerId: p.seller_id,
          productId: p.id,
        });
        discount = Math.round((grossTotal * coupon.pct_off) / 100);
        couponCode = coupon.code;
        const claimed = await q<{ id: string }>(
          `update coupons set used_count = used_count + 1
             where id = ? and (max_uses = 0 or used_count < max_uses) returning id`,
          [coupon.id],
        );
        if (claimed.length === 0) {
          stockError = "This coupon has been fully redeemed.";
          throw new Error(stockError);
        }
      }
      const total = grossTotal - discount;
      const commissionPct = p.cat_commission;
      const commission = Math.round((total * commissionPct) / 100);
      const expiresAt = t + settings.payment_window_minutes * 60_000;
      const snapshot = JSON.stringify({
        product_id: p.id,
        title: titleSnapshot,
        image_key: p.image_key,
        delivery_type: p.delivery_type,
        delivery_sla_minutes: p.delivery_sla_minutes,
        warranty_hours: warrantyHours,
        region: (p as unknown as { region?: string | null }).region ?? null,
        platform: (p as unknown as { platform?: string | null }).platform ?? null,
        required_info: p.required_info ?? null,
        unit_price_cents: unitPrice,
        variant_title: variantTitle,
        captured_at: t,
      });
      await run(
        `insert into orders (id, order_no, buyer_id, seller_id, product_id, product_title, image_key, qty,
          unit_price_cents, total_cents, commission_pct, commission_cents, seller_net_cents, status,
          delivery_type, delivery_sla_minutes, warranty_hours, buyer_info, expires_at, created_at,
          discount_cents, coupon_code, variant_title, product_snapshot)
         values (?,?,?,?,?,?,?,?,?,?,?,?,?, 'awaiting_payment', ?,?,?,?,?,?,?,?,?,?)`,
        [
          orderId,
          makeOrderNo(),
          user.id,
          p.seller_id,
          p.id,
          titleSnapshot,
          p.image_key,
          data.qty,
          unitPrice,
          total,
          commissionPct,
          commission,
          total - commission,
          p.delivery_type,
          p.delivery_sla_minutes,
          warrantyHours,
          data.buyerInfo ?? null,
          expiresAt,
          t,
          discount,
          couponCode,
          variantTitle,
          snapshot,
        ],
      );
      await run(
        `insert into deposits (id, order_id, user_id, amount_cents, network, pay_address, status, expires_at, created_at)
         values (?,?,?,?,?,?, 'pending', ?, ?)`,
        [uid(), orderId, user.id, total, data.network, makePayAddress(data.network), expiresAt, t],
      );
    });
    if (stockError) return { ok: false, error: stockError };
    await audit(user.id, "order.create", "order", orderId, { qty: data.qty, productId: p.id });
    return { ok: true, orderId };
  });
}

// ---------------------------------------------------------------------------
// Payment
// ---------------------------------------------------------------------------
const orderIdSchema = z.object({ orderId: z.string() });

export async function simulatePaymentSentAction(orderId: string): Promise<OrderResult> {
  return guard(async () => {
    await appContext();
    const user = await requireUser();
    const { orderId: id } = orderIdSchema.parse({ orderId });
    const o = await getOrderRow(id);
    if (!o || o.buyer_id !== user.id) return { ok: false, error: "Order not found." };
    if (o.status !== "awaiting_payment")
      return { ok: false, error: "This order is not awaiting payment." };
    if (o.expires_at && o.expires_at < now()) {
      await expireOrder(o.id, "Payment window expired", "expired");
      return { ok: false, error: "The payment window for this order has expired." };
    }
    await run(`update deposits set status = 'confirming', tx_hash = ? where order_id = ?`, [
      `0x${uid().replaceAll("-", "")}`,
      id,
    ]);
    await confirmPayment(id);
    return { ok: true };
  });
}

export async function payWithCreditsAction(orderId: string): Promise<OrderResult> {
  return guard(async () => {
    await appContext();
    const user = await requireUser();
    const { orderId: id } = orderIdSchema.parse({ orderId });
    rateLimit({ key: `creditpay:${user.id}`, limit: 10, windowMs: 60_000 });
    const o = await getOrderRow(id);
    if (!o || o.buyer_id !== user.id) return { ok: false, error: "Order not found." };
    if (o.status !== "awaiting_payment")
      return { ok: false, error: "This order is not awaiting payment." };
    if (o.expires_at && o.expires_at < now())
      return { ok: false, error: "The payment window for this order has expired." };
    const c = await getBuyerCredits(user.id);
    if (c.balance_cents < o.total_cents)
      return {
        ok: false,
        error: `Insufficient credits: ${(c.balance_cents / 100).toFixed(2)} available, ${(o.total_cents / 100).toFixed(2)} needed.`,
      };
    await tx(async () => {
      await txCreditSpend(user.id, o.total_cents, o.id, `Credits applied to ${o.order_no}`);
      await run(`update orders set credits_applied_cents = ? where id = ?`, [o.total_cents, o.id]);
      await run(`update deposits set status = 'confirmed', tx_hash = ? where order_id = ?`, [
        `credits:${uid().slice(0, 18)}`,
        o.id,
      ]);
    });
    await confirmPayment(o.id);
    await audit(user.id, "order.credit_pay", "order", o.id);
    return { ok: true };
  });
}

export async function payWithWalletAction(orderId: string): Promise<OrderResult> {
  return guard(async () => {
    await appContext();
    const user = await requireUser();
    const { orderId: id } = orderIdSchema.parse({ orderId });
    rateLimit({ key: `walletpay:${user.id}`, limit: 10, windowMs: 60_000 });
    if (user.wallet_frozen) return { ok: false, error: "Your wallet is frozen. Contact support." };
    const o = await getOrderRow(id);
    if (!o || o.buyer_id !== user.id) return { ok: false, error: "Order not found." };
    if (o.status !== "awaiting_payment")
      return { ok: false, error: "This order is not awaiting payment." };
    if (o.expires_at && o.expires_at < now())
      return { ok: false, error: "The payment window for this order has expired." };
    let balErr: string | null = null;
    await tx(async () => {
      const w = await getWallet(user.id);
      if (w.available_cents < o.total_cents) {
        balErr = `Insufficient balance: ${(w.available_cents / 100).toFixed(2)} USDT available, ${(o.total_cents / 100).toFixed(2)} needed.`;
        throw new Error(balErr);
      }
      await run(`update wallets set available_cents = available_cents - ? where user_id = ?`, [
        o.total_cents,
        user.id,
      ]);
      const after = await getWallet(user.id);
      await run(
        `insert into wallet_ledger (user_id, order_id, type, amount_cents, balance_after_cents, note, created_at)
         values (?,?,?,?,?,?,?)`,
        [
          user.id,
          o.id,
          "purchase",
          -o.total_cents,
          after.available_cents + after.pending_cents,
          `Wallet payment for ${o.order_no}`,
          now(),
        ],
      );
      await run(`update deposits set status = 'confirmed', tx_hash = ? where order_id = ?`, [
        `wallet:${uid().slice(0, 18)}`,
        id,
      ]);
    });
    if (balErr) return { ok: false, error: balErr };
    await confirmPayment(id);
    await audit(user.id, "order.wallet_pay", "order", id);
    return { ok: true };
  });
}

export async function cancelUnpaidOrderAction(orderId: string): Promise<OrderResult> {
  return guard(async () => {
    await appContext();
    const user = await requireUser();
    const { orderId: id } = orderIdSchema.parse({ orderId });
    const o = await getOrderRow(id);
    if (!o || o.buyer_id !== user.id) return { ok: false, error: "Order not found." };
    if (o.status !== "awaiting_payment")
      return { ok: false, error: "Only unpaid orders can be cancelled." };
    await expireOrder(o.id, "Cancelled by buyer", "cancelled");
    return { ok: true };
  });
}

// ---------------------------------------------------------------------------
// Post-delivery buyer actions
// ---------------------------------------------------------------------------
export async function buyerConfirmReceivedAction(orderId: string): Promise<OrderResult> {
  return guard(async () => {
    await appContext();
    const user = await requireUser();
    const { orderId: id } = orderIdSchema.parse({ orderId });
    const o = await getOrderRow(id);
    if (!o || o.buyer_id !== user.id) return { ok: false, error: "Order not found." };
    if (o.status !== "delivered")
      return { ok: false, error: "This order is not awaiting confirmation." };
    await completeOrder(id, false);
    await audit(user.id, "order.confirm_received", "order", id);
    return { ok: true };
  });
}

export async function buyerCancelSlaBreachAction(orderId: string): Promise<OrderResult> {
  return guard(async () => {
    await appContext();
    const user = await requireUser();
    const { orderId: id } = orderIdSchema.parse({ orderId });
    const o = await getOrderRow(id);
    if (!o || o.buyer_id !== user.id) return { ok: false, error: "Order not found." };
    if (o.status !== "delivering" && o.status !== "paid")
      return { ok: false, error: "This order can't be cancelled." };
    const slaDeadline = (o.paid_at ?? o.created_at) + o.delivery_sla_minutes * 60_000;
    if (now() < slaDeadline)
      return { ok: false, error: "The seller's delivery window hasn't expired yet." };
    await refundOrder(id, o.total_cents, "Seller missed the delivery SLA — cancelled by buyer.");
    await run(
      `update users set completion_rate = case when completion_rate - 1 < 0 then 0 else completion_rate - 1 end where id = ?`,
      [o.seller_id],
    );
    await recomputeSellerTrust(o.seller_id);
    await audit(user.id, "order.cancel_sla", "order", id);
    return { ok: true };
  });
}

const disputeSchema = z.object({
  orderId: z.string(),
  reason: z.enum(["not_delivered", "invalid_code", "not_as_described", "stopped_working", "other"]),
  description: z.string().min(10).max(3000),
});

export async function openDisputeAction(
  input: z.infer<typeof disputeSchema>,
): Promise<OrderResult> {
  return guard(async () => {
    await appContext();
    const user = await requireUser();
    const data = disputeSchema.parse(input);
    rateLimit({ key: `dispute:${user.id}`, limit: 5, windowMs: 60_000 });
    const o = await getOrderRow(data.orderId);
    if (!o || o.buyer_id !== user.id) return { ok: false, error: "Order not found." };
    if (!["delivered", "completed", "delivering", "paid"].includes(o.status))
      return { ok: false, error: "A dispute can't be opened for this order status." };
    if (o.warranty_ends_at && now() > o.warranty_ends_at)
      return { ok: false, error: "The warranty period for this order has ended." };
    if (await q1(`select 1 as x from disputes where order_id = ?`, [data.orderId]))
      return { ok: false, error: "A dispute already exists for this order." };
    const recent = (await q1<{ c: number }>(
      `select count(*) c from disputes where opened_by = ? and created_at > ?`,
      [user.id, now() - 30 * 86_400_000],
    ))?.c ?? 0;
    if (recent >= 5)
      return { ok: false, error: "Dispute limit reached — contact support directly." };

    const t = now();
    await run(
      `insert into disputes (id, order_id, opened_by, reason, description, created_at, last_activity_at) values (?,?,?,?,?,?,?)`,
      [uid(), data.orderId, user.id, data.reason, data.description, t, t],
    );
    await run(
      `update orders set status = 'disputed', escrow_status = case when escrow_status = 'held' then 'on_hold' else escrow_status end, escrow_hold_reason = coalesce(escrow_hold_reason, ?), escrow_hold_at = coalesce(escrow_hold_at, ?) where id = ?`,
      [`Dispute opened by buyer: ${data.reason}`, t, data.orderId],
    );
    const convId = await getOrCreateOrderConversation(data.orderId);
    await systemMessage(
      convId,
      `Dispute opened: ${data.reason.replaceAll("_", " ")}. Escrow is frozen until staff resolve it.`,
    );
    await notify(
      o.seller_id,
      "dispute_opened",
      "Dispute opened",
      `${o.order_no} — respond with your evidence.`,
      `/orders/${data.orderId}`,
    );
    await audit(user.id, "dispute.open", "order", data.orderId, { reason: data.reason });
    return { ok: true };
  });
}

const reviewSchema = z.object({
  orderId: z.string(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(2000).optional(),
});

export async function leaveReviewAction(input: z.infer<typeof reviewSchema>): Promise<OrderResult> {
  return guard(async () => {
    await appContext();
    const user = await requireUser();
    const data = reviewSchema.parse(input);
    rateLimit({ key: `review:${user.id}`, limit: 6, windowMs: 60_000 });
    const o = await q1<{
      id: string;
      order_no: string;
      buyer_id: string;
      seller_id: string;
      product_id: string;
      status: string;
    }>(`select id, order_no, buyer_id, seller_id, product_id, status from orders where id = ?`, [
      data.orderId,
    ]);
    if (!o || o.buyer_id !== user.id) return { ok: false, error: "Order not found." };
    if (!["completed", "released"].includes(o.status))
      return { ok: false, error: "You can review an order after confirming delivery." };
    if (await q1(`select 1 as x from reviews where order_id = ?`, [data.orderId]))
      return { ok: false, error: "You already reviewed this order." };

    await tx(async () => {
      await run(
        `insert into reviews (id, order_id, buyer_id, seller_id, product_id, rating, comment, created_at) values (?,?,?,?,?,?,?,?)`,
        [
          uid(),
          data.orderId,
          user.id,
          o.seller_id,
          o.product_id,
          data.rating,
          data.comment ?? null,
          now(),
        ],
      );
      const agg = (await q1<{ a: number; c: number }>(
        `select avg(rating) a, count(*) c from reviews where seller_id = ?`,
        [o.seller_id],
      ))!;
      await run(`update users set rating = ?, rating_count = ? where id = ?`, [
        Math.round(Number(agg.a) * 100) / 100,
        agg.c,
        o.seller_id,
      ]);
    });
    await recomputeSellerTrust(o.seller_id);
    await notify(
      o.seller_id,
      "review",
      "New review received",
      `${data.rating}★ on ${o.order_no}`,
      `/seller/reviews`,
    );
    return { ok: true };
  });
}

// ---------------------------------------------------------------------------
// Data fetcher for client-side polling (pay page, order detail)
// ---------------------------------------------------------------------------

export async function getPaymentDataAction(orderId: string) {
  await appContext();
  const user = await requireUser();
  const { getPaymentData } = await import("../queries/orders");
  const [d, walletRow, creditsRow] = await Promise.all([
    getPaymentData(orderId, user),
    getWallet(user.id).catch(() => ({ available_cents: 0 })),
    getBuyerCredits(user.id).catch(() => ({ balance_cents: 0 })),
  ]);
  if (!d) return null;
  return {
    ...d,
    walletAvailable: walletRow.available_cents,
    creditsAvailable: creditsRow.balance_cents,
  };
}

export async function sellerMarkDeliveredAction(
  orderId: string,
  proofNote: string,
  payload?: string,
): Promise<OrderResult> {
  return guard(async () => {
    await appContext();
    const user = await requireUser();
    const o = await getOrderRow(orderId);
    if (!o || o.seller_id !== user.id) return { ok: false, error: "Order not found." };
    if (!["paid", "delivering"].includes(o.status))
      return { ok: false, error: "Order cannot be marked as delivered in its current state." };
    const { markManualDelivered } = await import("@/lib/server/lifecycle.server");
    await markManualDelivered(orderId, user.id, proofNote, payload);
    return { ok: true };
  });
}

export async function sellerRespondDisputeAction(
  orderId: string,
  response: string,
): Promise<OrderResult> {
  return guard(async () => {
    await appContext();
    const user = await requireUser();
    const o = await getOrderRow(orderId);
    if (!o || o.seller_id !== user.id) return { ok: false, error: "Order not found." };
    const d = await q1<{ id: string; status: string }>(
      `select id, status from disputes where order_id = ?`,
      [orderId],
    );
    if (!d) return { ok: false, error: "No dispute on this order." };
    if (d.status === "resolved") return { ok: false, error: "Dispute already resolved." };
    await run(
      `update disputes set seller_response = ?, status = 'seller_responded', last_activity_at = ? where id = ?`,
      [response, now(), d.id],
    );
    await notify(
      o.buyer_id,
      "dispute_update",
      "Seller responded to dispute",
      o.order_no,
      `/disputes/${orderId}`,
    );
    return { ok: true };
  });
}

export async function getOrderDataAction(orderId: string) {
  await appContext();
  const user = await requireUser();
  const { getOrderData } = await import("../queries/orders");
  return getOrderData(orderId, user);
}
