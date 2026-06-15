"use server";

import { appContext } from "@/lib/server/app.server";
import { q, q1, run, tx } from "@/lib/server/db.server";
import {
  audit,
  encryptStock,
  fail,
  getSettings,
  now,
  sha256,
  slugify,
  uid,
} from "@/lib/server/core.server";
import { getWallet, txWithdrawalHold } from "@/lib/server/money.server";
import { requireSeller, requireUser } from "@/server/auth";
import { cached } from "@/lib/server/cache.server";

type Row = Record<string, string | number | null>;

// ---------------------------------------------------------------------------
// Seller overview
// ---------------------------------------------------------------------------
export async function getSellerOverviewAction() {
  await appContext();
  const user = await requireSeller();
  return cached(`seller:overview:${user.id}`, 2 * 60_000, async () => {
  const t = now();
  const dayMs = 86_400_000;
  const sales = (period: number) =>
    q1<{ c: number; s: number }>(
      `select count(*) c, coalesce(sum(seller_net_cents),0) s from orders
       where seller_id = ? and paid_at > ? and status not in ('refunded','cancelled','expired')`,
      [user.id, t - period],
    );
  const salesBetween = (from: number, to: number) =>
    q1<{ c: number; s: number }>(
      `select count(*) c, coalesce(sum(seller_net_cents),0) s from orders
       where seller_id = ? and paid_at > ? and paid_at <= ? and status not in ('refunded','cancelled','expired')`,
      [user.id, from, to],
    );
  const [
    today,
    week,
    month,
    prevWeek,
    wallet,
    needsDelivery,
    openDisputes,
    lowStock,
    paidOrders,
    topProducts,
    funnel,
  ] = await Promise.all([
    sales(dayMs),
    sales(7 * dayMs),
    sales(30 * dayMs),
    salesBetween(t - 14 * dayMs, t - 7 * dayMs),
    getWallet(user.id),
    q1<{ c: number }>(
      `select count(*) c from orders where seller_id = ? and status in ('paid','delivering')`,
      [user.id],
    ),
    q1<{ c: number }>(
      `select count(*) c from disputes dd join orders o on o.id = dd.order_id where o.seller_id = ? and dd.status != 'resolved'`,
      [user.id],
    ),
    q<{ id: string; title: string; stock_count: number }>(
      `select id, title, stock_count from products where seller_id = ? and delivery_type = 'auto'
       and status in ('active','out_of_stock') and stock_count <= 5 order by stock_count`,
      [user.id],
    ),
    q<{ paid_at: number; seller_net_cents: number }>(
      `select paid_at, seller_net_cents from orders
       where seller_id = ? and paid_at > ? and status not in ('refunded','cancelled','expired')`,
      [user.id, t - 13 * dayMs],
    ),
    q<{
      id: string;
      title: string;
      views: number;
      sold_count: number;
      price_cents: number;
      stock_count: number;
      status: string;
      delivery_type: string;
    }>(
      `select id, title, views, sold_count, price_cents, stock_count, status, delivery_type
         from products where seller_id = ? and status in ('active','out_of_stock','paused')
         order by sold_count desc limit 6`,
      [user.id],
    ),
    q1<{ views: number; sold: number }>(
      `select coalesce(sum(views),0) views, coalesce(sum(sold_count),0) sold
         from products where seller_id = ? and status in ('active','out_of_stock','paused')`,
      [user.id],
    ),
  ]);
  const daily: Array<{ day: string; sales: number; orders: number }> = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(t - i * dayMs);
    daily.push({ day: `${d.getMonth() + 1}/${d.getDate()}`, sales: 0, orders: 0 });
  }
  for (const o of paidOrders) {
    const idx = 13 - Math.min(13, Math.max(0, Math.floor((t - o.paid_at) / dayMs)));
    daily[idx].sales += o.seller_net_cents / 100;
    daily[idx].orders += 1;
  }
  const trailing14Total = daily.reduce((a, d) => a + d.sales, 0);
  const forecast7d = Math.round((trailing14Total / 14) * 7 * 100);
  const thisWeekCents = Number(week?.s ?? 0);
  const lastWeekCents = Number(prevWeek?.s ?? 0);
  const wowPct =
    lastWeekCents > 0
      ? Math.round(((thisWeekCents - lastWeekCents) / lastWeekCents) * 100)
      : thisWeekCents > 0
        ? 100
        : 0;
  const views = Number(funnel?.views ?? 0);
  const sold = Number(funnel?.sold ?? 0);
  const conversionPct = views > 0 ? Math.round((sold / views) * 1000) / 10 : 0;
  return {
    daily,
    topProducts,
    today: today!,
    week: week!,
    month: month!,
    wallet,
    needsDelivery: needsDelivery!.c,
    openDisputes: openDisputes!.c,
    lowStock,
    intelligence: {
      thisWeekCents,
      lastWeekCents,
      wowPct,
      forecast7dCents: forecast7d,
      avgDailyCents: Math.round((trailing14Total / 14) * 100),
      views,
      sold,
      conversionPct,
    },
    profile: {
      level: user.seller_level,
      rating: user.rating,
      ratingCount: user.rating_count,
      totalSales: user.total_sales,
      completionRate: user.completion_rate,
    },
  };
  }); // end cached
}

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------
export async function listMyProductsAction() {
  await appContext();
  const user = await requireSeller();
  const products = await q<Row>(
    `select p.*, c.name as category_name from products p join categories c on c.id = p.category_id
     where p.seller_id = ? order by p.created_at desc`,
    [user.id],
  );
  return { products };
}

export async function setProductPausedAction(productId: string, paused: boolean) {
  await appContext();
  const user = await requireSeller();
  const p = await q1<{
    seller_id: string;
    status: string;
    stock_count: number;
    delivery_type: string;
  }>(`select seller_id, status, stock_count, delivery_type from products where id = ?`, [
    productId,
  ]);
  if (!p || p.seller_id !== user.id) fail("Product not found.");
  if (paused) {
    if (p!.status !== "active" && p!.status !== "out_of_stock")
      fail("Only live products can be paused.");
    await run(`update products set status = 'paused' where id = ?`, [productId]);
  } else {
    if (p!.status !== "paused") fail("Product is not paused.");
    const next = p!.delivery_type === "auto" && p!.stock_count === 0 ? "out_of_stock" : "active";
    await run(`update products set status = ? where id = ?`, [next, productId]);
  }
  return { ok: true };
}

const MAX_ACTIVE_LISTINGS: Record<number, number> = { 1: 10, 2: 25, 3: 60, 4: 150, 5: 100_000 };

export async function saveProductAction(data: {
  productId?: string;
  categoryId: string;
  itemId?: string;
  title: string;
  description: string;
  imageIds: string[];
  deliveryType: "auto" | "manual";
  deliverySlaMinutes: number;
  warrantyHours: number | null;
  priceUsdt: number;
  minQty: number;
  maxQty: number;
  maxOrdersAtOnce: number;
  subscriptionDuration?: string | null;
  manualStock?: number | null;
  region?: string;
  platform?: string;
  requiredInfo?: string;
  categoryAttrs?: Record<string, string>;
  variants: Array<{ title: string; priceUsdt: number }>;
  expiresInDays: number;
  insuranceDays: number;
}) {
  await appContext();
  const user = await requireSeller();
  if (data.minQty > data.maxQty) fail("Min quantity can't exceed max quantity.");
  const cat = await q1<{ id: string; requires_subscription: number; allowed_durations: string }>(
    `select id, requires_subscription, allowed_durations from categories where id = ? and is_active = 1`,
    [data.categoryId],
  );
  if (!cat) fail("Invalid category.");
  if (cat!.requires_subscription) {
    const allowed = (cat!.allowed_durations || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (!data.subscriptionDuration)
      fail("This category requires you to pick a subscription duration.");
    if (allowed.length > 0 && !allowed.includes(data.subscriptionDuration as string))
      fail("Selected subscription duration is not allowed for this category.");
  }

  let itemId: string | null = null;
  if (data.itemId) {
    const item = await q1(`select id from catalog_items where id = ? and is_active = 1`, [
      data.itemId,
    ]);
    if (!item) fail("Invalid selling item.");
    const allowed = await q<{ category_id: string }>(
      `select category_id from catalog_item_categories where item_id = ?`,
      [data.itemId],
    );
    if (allowed.length > 0 && !allowed.some((a) => a.category_id === data.categoryId))
      fail("That sub-category is not enabled for this selling item.");
    itemId = data.itemId;
  }

  const priceCents = Math.round(data.priceUsdt * 100);

  if (data.productId) {
    const p = await q1<{ seller_id: string }>(`select seller_id from products where id = ?`, [
      data.productId,
    ]);
    if (!p || p.seller_id !== user.id) fail("Product not found.");
    await run(
      `update products set category_id = ?, item_id = ?, title = ?, description = ?,
         image_key = ?, delivery_sla_minutes = ?, warranty_hours = ?, price_cents = ?,
         min_qty = ?, max_qty = ?, region = ?, platform = ?, required_info = ?,
         status = 'pending_review', reject_reason = null
       where id = ?`,
      [
        data.categoryId,
        itemId,
        data.title,
        data.description,
        data.imageIds[0] ? `upload:${data.imageIds[0]}` : null,
        data.deliverySlaMinutes,
        data.warrantyHours,
        priceCents,
        data.minQty,
        data.maxQty,
        data.region ?? null,
        data.platform ?? null,
        data.requiredInfo ?? null,
        data.productId,
      ],
    );
    await run(
      `update products set expires_at = ?, insurance_days = ?,
         subscription_duration = ?, max_orders_at_once = ?, manual_stock = ?,
         category_attrs = ? where id = ?`,
      [
        data.expiresInDays > 0 ? now() + data.expiresInDays * 86_400_000 : null,
        data.insuranceDays,
        data.subscriptionDuration ?? null,
        data.maxOrdersAtOnce,
        data.manualStock ?? null,
        data.categoryAttrs && Object.keys(data.categoryAttrs).length > 0
          ? JSON.stringify(data.categoryAttrs)
          : null,
        data.productId,
      ],
    );
    await run(`delete from product_variants where product_id = ?`, [data.productId]);
    for (let i = 0; i < data.variants.length; i++) {
      const v = data.variants[i];
      await run(
        `insert into product_variants (id, product_id, title, price_cents, sort) values (?,?,?,?,?)`,
        [uid(), data.productId, v.title, Math.round(v.priceUsdt * 100), i],
      );
    }
    await attachImages(data.productId, user.id, data.imageIds);
    await audit(user.id, "product.update", "product", data.productId);
    return { productId: data.productId };
  }

  const activeCount = (await q1<{ c: number }>(
    `select count(*) c from products where seller_id = ? and status in ('active','pending_review','out_of_stock')`,
    [user.id],
  ))!.c;
  const cap = MAX_ACTIVE_LISTINGS[user.seller_level] ?? 10;
  if (activeCount >= cap) fail(`Seller level ${user.seller_level} allows at most ${cap} listings.`);

  const id = uid();
  await run(
    `insert into products (id, seller_id, category_id, item_id, title, slug, description, image_key,
       delivery_type, delivery_sla_minutes, warranty_hours, price_cents, min_qty, max_qty,
       region, platform, required_info, status, created_at)
     values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'pending_review',?)`,
    [
      id,
      user.id,
      data.categoryId,
      itemId,
      data.title,
      slugify(data.title),
      data.description,
      data.imageIds[0] ? `upload:${data.imageIds[0]}` : null,
      data.deliveryType,
      data.deliverySlaMinutes,
      data.warrantyHours,
      priceCents,
      data.minQty,
      data.maxQty,
      data.region ?? null,
      data.platform ?? null,
      data.requiredInfo ?? null,
      now(),
    ],
  );
  await run(
    `update products set expires_at = ?, insurance_days = ?,
       subscription_duration = ?, max_orders_at_once = ?, manual_stock = ?,
       category_attrs = ? where id = ?`,
    [
      data.expiresInDays > 0 ? now() + data.expiresInDays * 86_400_000 : null,
      data.insuranceDays,
      data.subscriptionDuration ?? null,
      data.maxOrdersAtOnce,
      data.manualStock ?? null,
      data.categoryAttrs && Object.keys(data.categoryAttrs).length > 0
        ? JSON.stringify(data.categoryAttrs)
        : null,
      id,
    ],
  );
  for (let i = 0; i < data.variants.length; i++) {
    const v = data.variants[i];
    await run(
      `insert into product_variants (id, product_id, title, price_cents, sort) values (?,?,?,?,?)`,
      [uid(), id, v.title, Math.round(v.priceUsdt * 100), i],
    );
  }
  await attachImages(id, user.id, data.imageIds);
  await audit(user.id, "product.create", "product", id);
  return { productId: id };
}

async function attachImages(productId: string, sellerId: string, imageIds: string[]) {
  const existing = await q<{ id: string }>(`select id from product_images where product_id = ?`, [
    productId,
  ]);
  for (const row of existing) {
    if (!imageIds.includes(row.id))
      await run(`delete from product_images where id = ? and seller_id = ?`, [row.id, sellerId]);
  }
  for (let i = 0; i < imageIds.length; i++) {
    await run(`update product_images set product_id = ?, sort = ? where id = ? and seller_id = ?`, [
      productId,
      i,
      imageIds[i],
      sellerId,
    ]);
  }
}

// ---------------------------------------------------------------------------
// Images
// ---------------------------------------------------------------------------
export async function uploadProductImageAction(mime: string, dataBase64: string) {
  await appContext();
  const user = await requireSeller();
  const ALLOWED = ["image/png", "image/jpeg", "image/webp", "image/gif"];
  if (!ALLOWED.includes(mime)) fail("Unsupported image format.");
  const approxBytes = Math.floor((dataBase64.length * 3) / 4);
  if (approxBytes > 2 * 1024 * 1024) fail("Image too large (2 MB max).");
  const recent = (await q1<{ c: number }>(
    `select count(*) c from product_images where seller_id = ? and created_at > ?`,
    [user.id, now() - 3_600_000],
  ))!.c;
  if (recent > 60) fail("Upload limit reached, try again later.");
  const id = uid();
  await run(
    `insert into product_images (id, product_id, seller_id, mime, data, sort, created_at)
     values (?, null, ?, ?, ?, 0, ?)`,
    [id, user.id, mime, dataBase64, now()],
  );
  return { id };
}

export async function deleteProductImageAction(id: string) {
  await appContext();
  const user = await requireSeller();
  await run(`delete from product_images where id = ? and seller_id = ?`, [id, user.id]);
  return { ok: true };
}

export async function listProductImagesAction(productId: string) {
  await appContext();
  const user = await requireSeller();
  const rows = await q<{ id: string; mime: string }>(
    `select id, mime from product_images where product_id = ? and seller_id = ? order by sort`,
    [productId, user.id],
  );
  return { images: rows };
}

// ---------------------------------------------------------------------------
// Stock
// ---------------------------------------------------------------------------
export async function getProductStockAction(productId: string) {
  await appContext();
  const user = await requireSeller();
  const p = await q1<{
    id: string;
    seller_id: string;
    title: string;
    delivery_type: string;
    stock_count: number;
    delivery_kind: string;
    manual_stock: number | null;
  }>(
    `select p.id, p.seller_id, p.title, p.delivery_type, p.stock_count,
            coalesce(c.delivery_kind, 'code') as delivery_kind, p.manual_stock
     from products p left join categories c on c.id = p.category_id where p.id = ?`,
    [productId],
  );
  if (!p || p.seller_id !== user.id) fail("Product not found.");
  const counts = await q<{ status: string; c: number }>(
    `select status, count(*) c from stock_items where product_id = ? group by status`,
    [productId],
  );
  const items = await q<{
    id: string;
    status: string;
    created_at: number;
    delivered_at: number | null;
  }>(
    `select id, status, created_at, delivered_at from stock_items where product_id = ? order by created_at desc limit 500`,
    [productId],
  );
  return { product: p!, counts, items };
}

export async function uploadStockAction(productId: string, codes: string) {
  await appContext();
  const user = await requireSeller();
  const p = await q1<{
    id: string;
    seller_id: string;
    delivery_type: string;
    delivery_kind: string;
  }>(
    `select p.id, p.seller_id, p.delivery_type, coalesce(c.delivery_kind, 'code') as delivery_kind
     from products p left join categories c on c.id = p.category_id where p.id = ?`,
    [productId],
  );
  if (!p || p.seller_id !== user.id) fail("Product not found.");
  if (p!.delivery_type !== "auto") fail("Stock codes only apply to auto-delivery products.");
  if (p!.delivery_kind === "invite" || p!.delivery_kind === "manual_text")
    fail("This category fulfils each order manually — no pre-uploaded stock.");

  const rawLines = codes
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const lines = [...new Set(rawLines)];
  const inPayloadDuplicates = rawLines.length - lines.length;
  if (lines.length === 0) fail("No codes found.");
  if (lines.length > 5000) fail("Max 5000 codes per upload.");
  if (p!.delivery_kind === "credentials") {
    const bad = lines.find((l) => !/^[^:\s]+:[^\s]+$/.test(l));
    if (bad) fail(`Credentials must be in "email:password" format. Invalid: ${bad.slice(0, 40)}`);
  }

  const existing = new Set(
    (
      await q<{ content_hash: string }>(
        `select s.content_hash from stock_items s join products pp on pp.id = s.product_id
         where pp.seller_id = ? and s.status in ('available','reserved','delivered')`,
        [user.id],
      )
    ).map((r) => r.content_hash),
  );
  let added = 0;
  let duplicates = inPayloadDuplicates;
  await tx(async () => {
    for (const code of lines) {
      const hash = sha256(code);
      if (existing.has(hash)) {
        duplicates++;
        continue;
      }
      existing.add(hash);
      await run(
        `insert into stock_items (id, product_id, content_encrypted, content_hash, created_at) values (?,?,?,?,?)`,
        [uid(), productId, encryptStock(code), hash, now()],
      );
      added++;
    }
    await run(
      `update products set stock_count = (select count(*) from stock_items where product_id = ? and status = 'available'),
         status = case when status = 'out_of_stock' then 'active' else status end
       where id = ?`,
      [productId, productId],
    );
  });
  await audit(user.id, "stock.upload", "product", productId, { added, duplicates });
  return { added, duplicates };
}

export async function removeStockItemAction(stockItemId: string) {
  await appContext();
  const user = await requireSeller();
  const s = await q1<{
    id: string;
    status: string;
    product_id: string;
    seller_id: string;
    locked_at: number | null;
  }>(
    `select s.id, s.status, s.product_id, p.seller_id, s.locked_at
     from stock_items s join products p on p.id = s.product_id where s.id = ?`,
    [stockItemId],
  );
  if (!s || s.seller_id !== user.id) fail("Stock item not found.");
  if (s!.locked_at) fail("This item was already delivered and cannot be modified.");
  if (s!.status !== "available") fail("Only unsold codes can be removed.");
  await run(`update stock_items set status = 'invalid' where id = ?`, [stockItemId]);
  await run(
    `update products set stock_count = (select count(*) from stock_items where product_id = ? and status = 'available') where id = ?`,
    [s!.product_id, s!.product_id],
  );
  return { ok: true };
}

export async function setManualStockAction(productId: string, manualStock: number) {
  await appContext();
  const user = await requireSeller();
  const p = await q1<{ seller_id: string; delivery_kind: string }>(
    `select p.seller_id, coalesce(c.delivery_kind, 'code') as delivery_kind
     from products p left join categories c on c.id = p.category_id where p.id = ?`,
    [productId],
  );
  if (!p || p.seller_id !== user.id) fail("Product not found.");
  if (p!.delivery_kind !== "invite" && p!.delivery_kind !== "manual_text")
    fail("Manual stock only applies to invite / manual-text delivery products.");
  await run(`update products set manual_stock = ?, stock_count = ? where id = ?`, [
    manualStock,
    manualStock,
    productId,
  ]);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Storefront
// ---------------------------------------------------------------------------
export async function getMyStorefrontAction() {
  await appContext();
  const user = await requireSeller();
  const row = await q1<{
    store_banner_url: string | null;
    store_logo_url: string | null;
    store_description: string | null;
    store_socials: unknown;
    store_announcement: string | null;
  }>(
    `select store_banner_url, store_logo_url, store_description, store_socials, store_announcement
     from users where id = ?`,
    [user.id],
  );
  const socials =
    typeof row?.store_socials === "string"
      ? (JSON.parse(row.store_socials) as Record<string, string>)
      : ((row?.store_socials as Record<string, string>) ?? {});
  return {
    bannerUrl: row?.store_banner_url ?? "",
    logoUrl: row?.store_logo_url ?? "",
    description: row?.store_description ?? "",
    announcement: row?.store_announcement ?? "",
    socials,
    username: user.username,
  };
}

export async function saveStorefrontAction(data: {
  bannerUrl?: string;
  logoUrl?: string;
  description?: string;
  announcement?: string;
  socials?: Record<string, string>;
}) {
  await appContext();
  const user = await requireSeller();
  const clean: Record<string, string> = {};
  for (const [k, v] of Object.entries(data.socials ?? {})) {
    if (typeof v === "string" && v.trim()) clean[k] = v.trim();
  }
  await run(
    `update users set store_banner_url = ?, store_logo_url = ?, store_description = ?,
                      store_announcement = ?, store_socials = ?
     where id = ?`,
    [
      data.bannerUrl?.trim() || null,
      data.logoUrl?.trim() || null,
      data.description?.trim() || null,
      data.announcement?.trim() || null,
      JSON.stringify(clean),
      user.id,
    ],
  );
  await audit(user.id, "storefront.update", "user", user.id);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------------
export async function listSellerReviewsAction() {
  await appContext();
  const user = await requireSeller();
  const reviews = await q<{
    id: string;
    rating: number;
    comment: string | null;
    seller_reply: string | null;
    created_at: number;
    buyer: string;
    product_title: string;
    order_no: string;
  }>(
    `select r.id, r.rating, r.comment, r.seller_reply, r.created_at, u.username as buyer, o.product_title, o.order_no
     from reviews r join users u on u.id = r.buyer_id join orders o on o.id = r.order_id
     where r.seller_id = ? order by r.created_at desc limit 100`,
    [user.id],
  );
  return { reviews };
}

export async function replyToReviewAction(reviewId: string, reply: string) {
  await appContext();
  const user = await requireSeller();
  if (reply.length < 2 || reply.length > 1000) fail("Reply must be 2-1000 characters.");
  const r = await q1<{ seller_id: string }>(`select seller_id from reviews where id = ?`, [
    reviewId,
  ]);
  if (!r || r.seller_id !== user.id) fail("Review not found.");
  await run(`update reviews set seller_reply = ? where id = ?`, [reply, reviewId]);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Orders (seller view)
// ---------------------------------------------------------------------------
export async function listSellerOrdersAction() {
  await appContext();
  const user = await requireSeller();
  const orders = await q<{
    id: string;
    order_no: string;
    product_title: string;
    image_key: string | null;
    qty: number;
    total_cents: number;
    seller_net_cents: number;
    status: string;
    delivery_type: string;
    delivery_sla_minutes: number;
    paid_at: number | null;
    created_at: number;
    counterparty: string;
  }>(
    `select o.id, o.order_no, o.product_title, o.image_key, o.qty, o.total_cents,
            o.seller_net_cents, o.status, o.delivery_type, o.delivery_sla_minutes,
            o.paid_at, o.created_at, u.username as counterparty
     from orders o join users u on u.id = o.buyer_id
     where o.seller_id = ? order by o.created_at desc limit 500`,
    [user.id],
  );
  return { orders };
}

// ---------------------------------------------------------------------------
// Wallet
// ---------------------------------------------------------------------------
export async function getWalletDataAction() {
  await appContext();
  const user = await requireUser();
  const [wallet, ledger, withdrawals, settings, app] = await Promise.all([
    getWallet(user.id),
    q<{
      id: number;
      order_id: string | null;
      type: string;
      amount_cents: number;
      balance_after_cents: number;
      note: string | null;
      created_at: number;
    }>(`select * from wallet_ledger where user_id = ? order by id desc limit 200`, [user.id]),
    q<{
      id: string;
      amount_cents: number;
      fee_cents: number;
      address: string;
      network: string;
      status: string;
      tx_hash: string | null;
      created_at: number;
    }>(`select * from withdrawals where user_id = ? order by created_at desc limit 50`, [user.id]),
    getSettings(),
    q1<{ usdt_payout_address: string; usdt_network: string }>(
      `select usdt_payout_address, usdt_network from seller_applications where user_id = ? and status = 'approved' order by created_at desc limit 1`,
      [user.id],
    ),
  ]);
  return {
    wallet,
    ledger,
    withdrawals,
    fees: {
      withdrawalFeeCents: settings.withdrawal_fee_cents,
      minWithdrawalCents: settings.min_withdrawal_cents,
    },
    payoutDefaults: app ?? null,
    walletFrozen: !!user.wallet_frozen,
  };
}

const WEEKLY_WITHDRAWAL_CAP_CENTS: Record<number, number> = {
  1: 50_000,
  2: 200_000,
  3: 1_000_000,
  4: 5_000_000,
  5: Number.MAX_SAFE_INTEGER,
};

export async function requestWithdrawalAction(
  amountUsdt: number,
  address: string,
  network: "TRC20" | "BEP20" | "ERC20",
) {
  await appContext();
  const user = await requireUser();
  if (user.wallet_frozen) fail("Your wallet is frozen. Contact support.");
  const settings = await getSettings();
  const amountCents = Math.round(amountUsdt * 100);
  if (amountCents < settings.min_withdrawal_cents)
    fail(`Minimum withdrawal is ${(settings.min_withdrawal_cents / 100).toFixed(2)} USDT.`);
  const weekly = (await q1<{ s: number }>(
    `select coalesce(sum(amount_cents),0) s from withdrawals where user_id = ? and created_at > ? and status != 'rejected'`,
    [user.id, now() - 7 * 86_400_000],
  ))!.s;
  const cap = WEEKLY_WITHDRAWAL_CAP_CENTS[user.seller_level] ?? WEEKLY_WITHDRAWAL_CAP_CENTS[1];
  if (weekly + amountCents > cap) fail(`Weekly withdrawal cap is ${(cap / 100).toFixed(0)} USDT.`);
  const id = uid();
  await txWithdrawalHold(user.id, amountCents, settings.withdrawal_fee_cents, id);
  await run(
    `insert into withdrawals (id, user_id, amount_cents, fee_cents, address, network, created_at) values (?,?,?,?,?,?,?)`,
    [id, user.id, amountCents, settings.withdrawal_fee_cents, address, network, now()],
  );
  await audit(user.id, "withdrawal.request", "withdrawal", id, { amountCents });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------
const DAY = 86_400_000;
const RANGES = { "7d": 7, "30d": 30, "90d": 90 } as const;
type Range = keyof typeof RANGES;

export async function getSellerAnalyticsAction(range: Range = "30d") {
  await appContext();
  const user = await requireSeller();
  return cached(`seller:analytics:${user.id}:${range}`, 5 * 60_000, async () => {
  const days = RANGES[range];
  const t = now();
  const since = t - days * DAY;
  const prevSince = since - days * DAY;

  const [
    paidRows,
    summary,
    prevSummary,
    topProducts,
    categoryMix,
    hourly,
    buyerStats,
    productCounts,
  ] = await Promise.all([
    q<{ paid_at: number; v: number; n: number }>(
      `select paid_at, seller_net_cents as v, 1 as n from orders
         where seller_id = ? and paid_at > ? and status not in ('cancelled','expired','refunded')`,
      [user.id, since],
    ),
    q1<{ n: number; gross: number; net: number; qty: number; buyers: number }>(
      `select count(*) n, coalesce(sum(total_cents),0) gross, coalesce(sum(seller_net_cents),0) net,
                coalesce(sum(qty),0) qty, count(distinct buyer_id) buyers
         from orders where seller_id = ? and paid_at > ? and status not in ('cancelled','expired','refunded')`,
      [user.id, since],
    ),
    q1<{ net: number }>(
      `select coalesce(sum(seller_net_cents),0) net from orders
         where seller_id = ? and paid_at > ? and paid_at <= ? and status not in ('cancelled','expired','refunded')`,
      [user.id, prevSince, since],
    ),
    q<{
      id: string;
      title: string;
      revenue: number;
      orders: number;
      views: number;
      sold_count: number;
    }>(
      `select p.id, p.title,
                coalesce(sum(o.seller_net_cents),0) as revenue,
                count(o.id) as orders,
                p.views, p.sold_count
         from products p left join orders o on o.product_id = p.id
           and o.paid_at > ? and o.status not in ('cancelled','expired','refunded')
         where p.seller_id = ? group by p.id order by revenue desc limit 10`,
      [since, user.id],
    ),
    q<{ name: string; revenue: number; orders: number }>(
      `select c.name, coalesce(sum(o.seller_net_cents),0) as revenue, count(*) as orders
         from orders o join products p on p.id = o.product_id join categories c on c.id = p.category_id
         where o.seller_id = ? and o.paid_at > ? and o.status not in ('cancelled','expired','refunded')
         group by c.id order by revenue desc`,
      [user.id, since],
    ),
    q<{ hour: number; n: number }>(
      `select cast(strftime('%H', datetime(paid_at/1000, 'unixepoch')) as integer) as hour, count(*) as n
         from orders where seller_id = ? and paid_at > ? and status not in ('cancelled','expired','refunded')
         group by hour order by hour`,
      [user.id, since],
    ),
    q1<{ buyers: number; repeat: number }>(
      `select count(distinct buyer_id) buyers,
                count(distinct case when cnt > 1 then buyer_id end) repeat
         from (select buyer_id, count(*) cnt from orders where seller_id = ? and paid_at > ? and status not in ('cancelled','expired','refunded') group by buyer_id)`,
      [user.id, since],
    ),
    q1<{ active: number; paused: number; oos: number }>(
      `select
           sum(case when status = 'active' then 1 else 0 end) as active,
           sum(case when status = 'paused' then 1 else 0 end) as paused,
           sum(case when status = 'out_of_stock' then 1 else 0 end) as oos
         from products where seller_id = ?`,
      [user.id],
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

  const hours24: Array<{ hour: string; n: number }> = Array.from({ length: 24 }, (_, i) => ({
    hour: String(i).padStart(2, "0"),
    n: 0,
  }));
  for (const r of hourly) hours24[r.hour].n += r.n;

  const net = Number(summary?.net ?? 0);
  const prevNet = Number(prevSummary?.net ?? 0);
  const growth = prevNet > 0 ? Math.round(((net - prevNet) / prevNet) * 1000) / 10 : null;
  const orders = Number(summary?.n ?? 0);
  const qty = Number(summary?.qty ?? 0);
  const uniqueBuyers = Number(buyerStats?.buyers ?? 0);
  const repeatBuyers = Number(buyerStats?.repeat ?? 0);
  const repeatRate = uniqueBuyers > 0 ? Math.round((repeatBuyers / uniqueBuyers) * 100) : 0;
  const aov = orders > 0 ? net / orders / 100 : 0;

  return {
    range,
    daily,
    hours: hours24,
    summary: {
      net,
      orders,
      qty,
      uniqueBuyers,
      repeatRate,
      aov: Math.round(aov * 100) / 100,
      growth,
    },
    topProducts,
    categoryMix,
    productCounts: {
      active: productCounts?.active ?? 0,
      paused: productCounts?.paused ?? 0,
      oos: productCounts?.oos ?? 0,
    },
  };
  }); // end cached
}

// ---------------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------------
export async function getMyVerificationAction() {
  await appContext();
  const user = await requireSeller();
  const application = await q1<{
    id: string;
    tier_requested: string;
    legal_name: string;
    country: string;
    status: string;
    admin_note: string | null;
    created_at: number;
  }>(
    `select id, tier_requested, legal_name, country, status, admin_note, created_at
     from seller_verifications where user_id = ? order by created_at desc limit 1`,
    [user.id],
  );
  return { application: application ?? null };
}

export async function applyForVerificationAction(data: {
  tierRequested: "verified" | "business" | "premium";
  legalName: string;
  country: string;
  businessName?: string;
  businessRegistration?: string;
  idDocRef?: string;
  notes?: string;
  contactPhone: string;
  contactWhatsapp?: string;
  contactTelegram?: string;
}) {
  await appContext();
  const user = await requireSeller();
  if (data.legalName.trim().length < 2) fail("Legal name is required.");
  if (data.country.trim().length < 2) fail("Country is required.");
  if (!data.contactPhone || data.contactPhone.trim().length < 5)
    fail("A contact phone number is required.");
  if ((data.tierRequested === "business" || data.tierRequested === "premium") && !data.businessName)
    fail("Business name is required for business / premium verification.");

  const open = await q1<{ id: string }>(
    `select id from seller_verifications where user_id = ? and status = 'pending'`,
    [user.id],
  );
  if (open) fail("You already have a pending verification application.");

  const id = uid();
  await run(
    `insert into seller_verifications
       (id, user_id, tier_requested, legal_name, country, business_name, business_registration,
        id_doc_ref, notes, contact_phone, contact_whatsapp, contact_telegram, created_at)
     values (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id,
      user.id,
      data.tierRequested,
      data.legalName.trim(),
      data.country.trim(),
      data.businessName?.trim() || null,
      data.businessRegistration?.trim() || null,
      data.idDocRef?.trim() || null,
      data.notes?.trim() || null,
      data.contactPhone.trim(),
      data.contactWhatsapp?.trim() || null,
      data.contactTelegram?.trim() || null,
      now(),
    ],
  );
  await audit(user.id, "verification.apply", "user", user.id);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Promotions (coupons + sales)
// ---------------------------------------------------------------------------
export async function listMyPromotionsAction() {
  await appContext();
  const user = await requireSeller();
  const [coupons, sales] = await Promise.all([
    q<{
      id: string;
      code: string;
      discount_type: string;
      discount_value: number;
      min_order_cents: number;
      max_uses: number | null;
      uses: number;
      expires_at: number | null;
      is_active: number;
    }>(
      `select id, code, discount_type, discount_value, min_order_cents, max_uses, uses, expires_at, is_active
       from coupons where seller_id = ? order by created_at desc`,
      [user.id],
    ),
    q<{
      id: string;
      title: string;
      sale_price_cents: number;
      price_cents: number;
      sale_ends_at: number | null;
    }>(
      `select id, title, sale_price_cents, price_cents, sale_ends_at
       from products where seller_id = ? and sale_price_cents is not null`,
      [user.id],
    ),
  ]);
  return { coupons, sales };
}

export async function saveMyCouponAction(data: {
  couponId?: string;
  code: string;
  discountType: "pct" | "fixed";
  discountValue: number;
  minOrderCents: number;
  maxUses?: number;
  expiresAt?: number;
}) {
  await appContext();
  const user = await requireSeller();
  if (data.couponId) {
    const c = await q1<{ seller_id: string }>(`select seller_id from coupons where id = ?`, [
      data.couponId,
    ]);
    if (!c || c.seller_id !== user.id) fail("Coupon not found.");
    await run(
      `update coupons set code = ?, discount_type = ?, discount_value = ?, min_order_cents = ?, max_uses = ?, expires_at = ?
       where id = ?`,
      [
        data.code.trim().toUpperCase(),
        data.discountType,
        data.discountValue,
        data.minOrderCents,
        data.maxUses ?? null,
        data.expiresAt ?? null,
        data.couponId,
      ],
    );
    return { ok: true };
  }
  const existing = await q1<{ id: string }>(
    `select id from coupons where seller_id = ? and code = ? and is_active = 1`,
    [user.id, data.code.trim().toUpperCase()],
  );
  if (existing) fail("You already have an active coupon with that code.");
  await run(
    `insert into coupons (id, seller_id, code, discount_type, discount_value, min_order_cents, max_uses, expires_at, is_active, uses, created_at)
     values (?,?,?,?,?,?,?,?,1,0,?)`,
    [
      uid(),
      user.id,
      data.code.trim().toUpperCase(),
      data.discountType,
      data.discountValue,
      data.minOrderCents,
      data.maxUses ?? null,
      data.expiresAt ?? null,
      now(),
    ],
  );
  return { ok: true };
}

export async function deleteMyCouponAction(couponId: string) {
  await appContext();
  const user = await requireSeller();
  const c = await q1<{ seller_id: string }>(`select seller_id from coupons where id = ?`, [
    couponId,
  ]);
  if (!c || c.seller_id !== user.id) fail("Coupon not found.");
  await run(`update coupons set is_active = 0 where id = ?`, [couponId]);
  return { ok: true };
}

export async function setProductSaleAction(
  productId: string,
  salePriceCents: number | null,
  saleEndsAt: number | null,
) {
  await appContext();
  const user = await requireSeller();
  const p = await q1<{ seller_id: string; price_cents: number }>(
    `select seller_id, price_cents from products where id = ?`,
    [productId],
  );
  if (!p || p.seller_id !== user.id) fail("Product not found.");
  if (salePriceCents !== null && salePriceCents >= p!.price_cents)
    fail("Sale price must be lower than the regular price.");
  await run(`update products set sale_price_cents = ?, sale_ends_at = ? where id = ?`, [
    salePriceCents,
    saleEndsAt,
    productId,
  ]);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Catalog data (for product form)
// ---------------------------------------------------------------------------
export async function getCatalogForFormAction() {
  await appContext();
  await requireSeller();
  const [categories, items] = await Promise.all([
    q<{
      id: string;
      name: string;
      icon: string;
      commission_pct: number;
      default_warranty_hours: number;
      risk_tier: string;
      requires_subscription: number;
      allowed_durations: string;
    }>(
      `select id, name, icon, commission_pct, default_warranty_hours, risk_tier, requires_subscription, allowed_durations
       from categories where is_active = 1 order by sort, name`,
    ),
    q<{ id: string; name: string; categoryIds: string[] }>(
      `select ci.id, ci.name from catalog_items ci where ci.is_active = 1 order by ci.name`,
    ),
  ]);
  // Load category associations for each item
  const catAssoc = await q<{ item_id: string; category_id: string }>(
    `select item_id, category_id from catalog_item_categories`,
  );
  const assocMap: Record<string, string[]> = {};
  for (const a of catAssoc) {
    if (!assocMap[a.item_id]) assocMap[a.item_id] = [];
    assocMap[a.item_id].push(a.category_id);
  }
  return {
    categories,
    items: items.map((i) => ({ ...i, categoryIds: assocMap[i.id] ?? [] })),
  };
}

export async function getCategorySchemaAction(categoryId: string) {
  await appContext();
  await requireSeller();
  const cat = await q1<{ schema: string | null; config: string | null }>(
    `select schema, config from categories where id = ?`,
    [categoryId],
  );
  if (!cat) return { schema: null, config: null };
  return {
    schema: cat.schema
      ? (JSON.parse(cat.schema as string) as {
          sellerFields?: Array<{ key: string; label: string; type: string }>;
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

export async function suggestItemAction(name: string) {
  await appContext();
  const user = await requireUser();
  const recent = (await q1<{ c: number }>(
    `select count(*) c from item_suggestions where user_id = ? and created_at > ?`,
    [user.id, now() - 86_400_000],
  ))!.c;
  if (recent >= 5) fail("You can submit up to 5 suggestions per day.");
  await run(
    `insert into item_suggestions (id, user_id, name, note, created_at) values (?,?,?,?,?)`,
    [uid(), user.id, name.trim(), null, now()],
  );
  return { ok: true };
}
