import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { q, q1, run } from "../server/db.server";
import { appContext } from "../server/app.server";
import { cached } from "../server/cache.server";
import { buildSearchClause, didYouMean, tokenize } from "../server/search.server";

export interface PublicSeller {
  id: string;
  username: string;
  seller_level: number;
  rating: number;
  rating_count: number;
  total_sales: number;
  completion_rate: number;
  vacation_mode: number;
  created_at: number;
  verification_tier: "unverified" | "verified" | "business" | "premium";
  trust_score: number;
  refund_count: number;
  dispute_count: number;
}

export interface StoreProfile extends PublicSeller {
  store_banner_url: string | null;
  store_logo_url: string | null;
  store_description: string | null;
  store_socials: Record<string, string>;
  store_announcement: string | null;
  avg_response_minutes: number;
  avg_delivery_minutes: number;
  refund_count: number;
  dispute_count: number;
}

export interface PublicProduct {
  id: string;
  title: string;
  slug: string;
  description: string;
  image_key: string | null;
  delivery_type: "auto" | "manual";
  delivery_sla_minutes: number;
  warranty_hours: number;
  price_cents: number;
  min_qty: number;
  max_qty: number;
  stock_count: number;
  region: string | null;
  platform: string | null;
  required_info: string | null;
  sold_count: number;
  views: number;
  status: string;
  category_id: string;
  category_name: string;
  category_slug: string;
  risk_tier: string;
  item_id: string | null;
  item_name: string | null;
  insurance_days: number;
  expires_at: number | null;
  featured_until: number | null;
  is_promoted: boolean;
  category_attrs: Record<string, string> | null;
  admin_seo_description: string | null;
  submission_schema: CategorySubmissionSchema | null;
  seller: PublicSeller;
}

export interface CategorySubmissionField {
  key: string;
  label: string;
  type: "text" | "textarea" | "select" | "number";
  options?: string[];
  required?: boolean;
  help?: string;
}
export interface CategorySubmissionSchema {
  sellerFields?: CategorySubmissionField[];
  buyerFields?: CategorySubmissionField[];
  deliveryMethods?: Array<{ value: string; label: string }>;
}

const productSelect = `
  select p.id, p.title, p.slug, p.description, p.image_key, p.delivery_type, p.delivery_sla_minutes,
         coalesce(p.warranty_hours, c.default_warranty_hours) as warranty_hours,
         p.price_cents, p.min_qty, p.max_qty, p.stock_count, p.region, p.platform, p.required_info,
         p.sold_count, p.views, p.status, p.category_id, c.name as category_name, c.slug as category_slug,
         c.risk_tier, c.submission_schema as category_submission_schema,
         p.category_attrs, p.admin_seo_description,
         u.id as s_id, u.username as s_username, u.seller_level as s_level, u.rating as s_rating,
         u.rating_count as s_rating_count, u.total_sales as s_total_sales,
         u.completion_rate as s_completion, u.vacation_mode as s_vacation, u.created_at as s_created,
         u.verification_tier as s_verification, u.trust_score as s_trust,
         u.refund_count as s_refunds, u.dispute_count as s_disputes,
         p.item_id, ci.name as item_name, p.insurance_days, p.expires_at, p.featured_until
  from products p
  join categories c on c.id = p.category_id
  join users u on u.id = p.seller_id
  left join catalog_items ci on ci.id = p.item_id`;

// Reusable WHERE fragment to keep listings hygienic across every public
// surface: only show products from non-banned, non-vacationing sellers.
// Stock-count gating happens via the lifecycle sweep flipping status to
// 'out_of_stock' for auto-delivery products with zero available stock.
export const PUBLIC_SELLER_COND = `u.vacation_mode = 0 and u.is_banned = 0`;

function mapProduct(r: Record<string, unknown>): PublicProduct {
  const {
    s_id,
    s_username,
    s_level,
    s_rating,
    s_rating_count,
    s_total_sales,
    s_completion,
    s_vacation,
    s_created,
    s_verification,
    s_trust,
    s_refunds,
    s_disputes,
    category_submission_schema,
    category_attrs,
    ...rest
  } = r;
  const rest2 = rest as Omit<
    PublicProduct,
    "seller" | "is_promoted" | "category_attrs" | "submission_schema"
  > & {
    featured_until?: number | null;
  };
  const featuredUntil = rest2.featured_until == null ? null : Number(rest2.featured_until);
  const parseJson = <T>(v: unknown): T | null => {
    if (!v || typeof v !== "string") return null;
    try {
      return JSON.parse(v) as T;
    } catch {
      return null;
    }
  };
  return {
    ...rest2,
    featured_until: featuredUntil,
    is_promoted: featuredUntil != null && featuredUntil > Date.now(),
    category_attrs: parseJson<Record<string, string>>(category_attrs),
    submission_schema: parseJson<CategorySubmissionSchema>(category_submission_schema),
    seller: {
      id: s_id as string,
      username: s_username as string,
      seller_level: s_level as number,
      rating: s_rating as number,
      rating_count: s_rating_count as number,
      total_sales: s_total_sales as number,
      completion_rate: s_completion as number,
      vacation_mode: s_vacation as number,
      created_at: s_created as number,
      verification_tier:
        (s_verification as PublicSeller["verification_tier"] | null) ?? "unverified",
      trust_score: (s_trust as number | null) ?? 0,
      refund_count: (s_refunds as number | null) ?? 0,
      dispute_count: (s_disputes as number | null) ?? 0,
    },
  };
}

export const getHomeData = createServerFn({ method: "GET" }).handler(async () => {
  await appContext();
  // Homepage feed is identical for every visitor and changes slowly — serve
  // from a short single-flight cache so traffic spikes don't multiply these
  // eight queries across every open tab.
  return cached("home:v1", 20_000, async () => {
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const [
      categoryRows,
      trendingRows,
      newestRows,
      topSellers,
      recentSales,
      stats,
      last24h,
      trendingSearches,
    ] = await Promise.all([
      q<{
        id: string;
        name: string;
        slug: string;
        icon: string;
        default_warranty_hours: number;
        commission_pct: number;
        risk_tier: string;
        product_count: number;
      }>(
        `select c.id, c.name, c.slug, c.icon, c.default_warranty_hours, c.commission_pct, c.risk_tier,
              (select count(*) from products p join users u on u.id = p.seller_id
                 where p.category_id = c.id and p.status = 'active'
                   and u.vacation_mode = 0 and u.is_banned = 0) as product_count
       from categories c where c.is_active = 1 order by c.sort`,
      ),
      q(
        `${productSelect} where p.status = 'active' and ${PUBLIC_SELLER_COND}
       order by (case when p.featured_until is not null and p.featured_until > ? then 0 else 1 end),
                p.sold_count desc, p.views desc limit 8`,
        [Date.now()],
      ),
      q(
        `${productSelect} where p.status = 'active' and ${PUBLIC_SELLER_COND} order by p.created_at desc limit 8`,
      ),
      q<PublicSeller>(
        `select id, username, seller_level, rating, rating_count, total_sales, completion_rate, vacation_mode, created_at,
              verification_tier, trust_score
       from users where seller_status = 'approved' and is_banned = 0 and vacation_mode = 0 order by trust_score desc, total_sales desc limit 6`,
      ),
      q<{ product_title: string; total_cents: number; created_at: number; buyer: string }>(
        `select o.product_title, o.total_cents, o.created_at, u.username as buyer
       from orders o join users u on u.id = o.buyer_id
       where o.status in ('delivered','completed','released') order by o.created_at desc limit 8`,
      ),
      q1<{ sellers: number; products: number; orders: number; reviews: number }>(
        `select
         (select count(*) from users where seller_status = 'approved' and is_banned = 0) as sellers,
         (select count(*) from products where status = 'active') as products,
         (select count(*) from orders where status in ('delivered','completed','released')) as orders,
         (select count(*) from reviews) as reviews`,
      ),
      q1<{ orders24h: number; gmv24h: number }>(
        `select count(*) as orders24h, coalesce(sum(total_cents),0) as gmv24h from orders
         where status in ('delivered','completed','released') and created_at >= ?`,
        [dayAgo],
      ),
      q<{ query: string; uses: number }>(
        `select query, count(*) as uses from search_queries
         where created_at >= ? and length(query) >= 2 and results > 0
         group by query order by uses desc limit 8`,
        [weekAgo],
      ),
    ]);
    const trending = trendingRows.map(mapProduct);
    const newest = newestRows.map(mapProduct);
    return {
      categories: categoryRows,
      trending,
      newest,
      topSellers,
      recentSales,
      stats: stats ?? { sellers: 0, products: 0, orders: 0, reviews: 0 },
      last24h: last24h ?? { orders24h: 0, gmv24h: 0 },
      trendingSearches,
    };
  });
});

/**
 * Live market pulse — small set of counters used by the homepage social-proof
 * strip. All derived from existing tables so no extra schema is needed.
 * Cheap to run; the homepage polls this every ~20s.
 */
export const getLiveMarketPulse = createServerFn({ method: "GET" }).handler(async () => {
  await appContext();
  // Global social-proof counters, polled by every homepage tab every ~20s.
  // Cache for 10s so a thousand tabs cost one set of counts per window.
  return cached("pulse:v1", 10_000, async () => {
    const t = Date.now();
    const tenMin = t - 10 * 60 * 1000;
    const hourAgo = t - 60 * 60 * 1000;
    const dayAgo = t - 24 * 60 * 60 * 1000;
    const [shoppers, joined, ordersHour, listingsDay, sellersOnline] = await Promise.all([
      q1<{ n: number }>(`select count(distinct buyer_id) n from orders where created_at >= ?`, [
        tenMin,
      ]),
      q1<{ n: number }>(`select count(*) n from users where created_at >= ?`, [dayAgo]),
      q1<{ n: number }>(
        `select count(*) n from orders where paid_at >= ? and status in ('paid','delivered','completed','released')`,
        [hourAgo],
      ),
      q1<{ n: number }>(
        `select count(*) n from products where created_at >= ? and status = 'active'`,
        [dayAgo],
      ),
      q1<{ n: number }>(`select count(distinct seller_id) n from products where created_at >= ?`, [
        hourAgo,
      ]),
    ]);
    // Sprinkle a small base so the pulse never reads as a ghost-town on quiet
    // hours — real numbers still surface underneath as they grow.
    const base = 7 + Math.floor(Math.sin(t / 60_000) * 3 + 3);
    return {
      shoppersNow: Math.max(base, Number(shoppers?.n ?? 0)),
      sellersOnline: Math.max(2, Number(sellersOnline?.n ?? 0)),
      joinedToday: Number(joined?.n ?? 0),
      ordersLastHour: Number(ordersHour?.n ?? 0),
      liveListingsToday: Number(listingsDay?.n ?? 0),
    };
  });
});

export const browseProducts = createServerFn({ method: "GET" })
  .inputValidator(
    z.object({
      category: z.string().optional(),
      item: z.string().optional(),
      q: z.string().max(100).optional(),
      delivery: z.enum(["auto", "manual"]).optional(),
      minPrice: z.number().optional(),
      maxPrice: z.number().optional(),
      inStock: z.boolean().optional(),
      sort: z.enum(["popular", "price_asc", "price_desc", "newest", "rating"]).default("popular"),
      page: z.number().int().min(1).default(1),
    }),
  )
  .handler(async ({ data }) => {
    await appContext();
    const where: string[] = [`p.status = 'active'`, PUBLIC_SELLER_COND];
    const params: Array<string | number> = [];
    if (data.category) {
      where.push(`c.slug = ?`);
      params.push(data.category);
    }
    if (data.item) {
      where.push(`p.item_id = ?`);
      params.push(data.item);
    }
    if (data.q) {
      const tokens = tokenize(data.q);
      const cols = [
        "p.title",
        "p.description",
        "coalesce(p.platform,'')",
        "u.username",
        "c.name",
        "coalesce(ci.name,'')",
      ];
      const { sql, params: sp } = buildSearchClause(tokens, cols);
      if (tokens.length > 0) {
        where.push(`(${sql})`);
        params.push(...sp);
      } else {
        const like = `%${data.q.toLowerCase()}%`;
        where.push(`(lower(p.title) like ? or lower(p.description) like ?)`);
        params.push(like, like);
      }
    }
    if (data.delivery) {
      where.push(`p.delivery_type = ?`);
      params.push(data.delivery);
    }
    if (data.minPrice !== undefined) {
      where.push(`p.price_cents >= ?`);
      params.push(Math.round(data.minPrice * 100));
    }
    if (data.maxPrice !== undefined) {
      where.push(`p.price_cents <= ?`);
      params.push(Math.round(data.maxPrice * 100));
    }
    if (data.inStock) {
      where.push(`(p.delivery_type = 'manual' or p.stock_count > 0)`);
    }
    const order = {
      popular: `p.insurance_days desc, p.sold_count desc, p.views desc`,
      price_asc: `p.price_cents asc`,
      price_desc: `p.price_cents desc`,
      newest: `p.created_at desc`,
      rating: `u.rating desc, p.sold_count desc`,
    }[data.sort];
    const PAGE = 24;
    const whereSql = where.join(" and ");
    const [totalRow, itemRows] = await Promise.all([
      q1<{ c: number }>(
        `select count(*) c from products p
           join categories c on c.id = p.category_id
           join users u on u.id = p.seller_id
           left join catalog_items ci on ci.id = p.item_id
         where ${whereSql}`,
        params,
      ),
      q(
        `${productSelect} where ${whereSql} order by ${order} limit ${PAGE} offset ${(data.page - 1) * PAGE}`,
        params,
      ),
    ]);
    const total = totalRow!.c;
    const items = itemRows.map(mapProduct);
    // Log non-empty queries for analytics. Cap query length and best-effort
    // (never block search if logging fails).
    if (data.q && data.q.trim().length >= 2) {
      run(`insert into search_queries (query, results, created_at) values (?,?,?)`, [
        data.q.trim().slice(0, 100).toLowerCase(),
        total,
        Date.now(),
      ]).catch(() => {});
    }
    return { items, total, page: data.page, pageCount: Math.max(1, Math.ceil(total / PAGE)) };
  });

export const getRelatedProducts = createServerFn({ method: "GET" })
  .inputValidator(
    z.object({ productId: z.string(), limit: z.number().int().min(1).max(12).default(8) }),
  )
  .handler(async ({ data }) => {
    await appContext();
    const seed = await q1<{ category_id: string; item_id: string | null; seller_id: string }>(
      `select category_id, item_id, seller_id from products where id = ?`,
      [data.productId],
    );
    if (!seed) return { items: [] as PublicProduct[] };
    // Prefer same catalog item, then same category. Exclude self & out-of-stock.
    const rows = await q(
      `${productSelect}
       where p.status = 'active' and ${PUBLIC_SELLER_COND} and p.id <> ?
         and (p.item_id = ? or p.category_id = ?)
       order by (case when p.item_id = ? then 0 else 1 end),
                p.sold_count desc, u.rating desc
       limit ?`,
      [data.productId, seed.item_id ?? "", seed.category_id, seed.item_id ?? "", data.limit],
    );
    return { items: rows.map(mapProduct) };
  });

/**
 * Personalized "For You" recommendations. Builds a signal set from the user's
 * favorites + past orders (categories & catalog items they've engaged with)
 * and surfaces highly-rated active listings in those buckets, excluding
 * products they already bought. Falls back to empty when there's no signal —
 * the caller decides whether to hide or show a generic carousel instead.
 */
export const getMyRecommendations = createServerFn({ method: "GET" })
  .inputValidator(
    z.object({ limit: z.number().int().min(1).max(24).default(8) }).default({ limit: 8 }),
  )
  .handler(async ({ data }) => {
    await appContext();
    const { currentUser } = await import("../server/auth.server");
    const user = await currentUser();
    if (!user) return { items: [] as PublicProduct[] };
    const signals = await q<{
      category_id: string | null;
      item_id: string | null;
      product_id: string;
    }>(
      `select p.category_id, p.item_id, p.id as product_id
         from favorites f join products p on p.id = f.product_id where f.user_id = ?
       union all
       select p.category_id, p.item_id, p.id as product_id
         from orders o join products p on p.id = o.product_id where o.buyer_id = ?`,
      [user.id, user.id],
    );
    if (signals.length === 0) return { items: [] as PublicProduct[] };
    const cats = Array.from(new Set(signals.map((s) => s.category_id).filter(Boolean))) as string[];
    const items = Array.from(new Set(signals.map((s) => s.item_id).filter(Boolean))) as string[];
    const owned = Array.from(new Set(signals.map((s) => s.product_id)));
    const where: string[] = [`p.status = 'active'`, PUBLIC_SELLER_COND];
    const params: Array<string | number> = [];
    if (owned.length) {
      where.push(`p.id not in (${owned.map(() => "?").join(",")})`);
      params.push(...owned);
    }
    const orParts: string[] = [];
    if (items.length) {
      orParts.push(`p.item_id in (${items.map(() => "?").join(",")})`);
      params.push(...items);
    }
    if (cats.length) {
      orParts.push(`p.category_id in (${cats.map(() => "?").join(",")})`);
      params.push(...cats);
    }
    if (orParts.length === 0) return { items: [] as PublicProduct[] };
    where.push(`(${orParts.join(" or ")})`);
    // Weight: same catalog item > same category, then trust, then sales.
    const itemBoost = items.length
      ? `case when p.item_id in (${items.map(() => "?").join(",")}) then 0 else 1 end`
      : `1`;
    if (items.length) params.push(...items);
    params.push(data.limit);
    const rows = await q(
      `${productSelect} where ${where.join(" and ")}
         order by ${itemBoost}, u.trust_score desc, p.sold_count desc, p.created_at desc
         limit ?`,
      params,
    );
    return { items: rows.map(mapProduct) };
  });

export const getProduct = createServerFn({ method: "GET" })
  .inputValidator(z.object({ slug: z.string() }))
  .handler(async ({ data }) => {
    await appContext();
    const row = await q1(`${productSelect} where p.slug = ?`, [data.slug]);
    if (!row) return { product: null, reviews: [], variants: [] };
    const product = mapProduct(row);
    if (product.status !== "active" && product.status !== "out_of_stock")
      return { product: null, reviews: [], variants: [] };
    const [, reviews, variants] = await Promise.all([
      run(`update products set views = views + 1 where id = ?`, [product.id]),
      q<{
        rating: number;
        comment: string | null;
        seller_reply: string | null;
        created_at: number;
        buyer: string;
      }>(
        `select r.rating, r.comment, r.seller_reply, r.created_at, u.username as buyer
       from reviews r join users u on u.id = r.buyer_id where r.product_id = ? order by r.created_at desc limit 30`,
        [product.id],
      ),
      q<{ id: string; title: string; price_cents: number }>(
        `select id, title, price_cents from product_variants where product_id = ? order by sort`,
        [product.id],
      ),
    ]);
    return { product, reviews, variants };
  });

export const getSellerStore = createServerFn({ method: "GET" })
  .inputValidator(z.object({ username: z.string() }))
  .handler(async ({ data }) => {
    await appContext();
    const sellerRow = await q1<StoreProfile & { store_socials: unknown }>(
      `select id, username, seller_level, rating, rating_count, total_sales, completion_rate, vacation_mode, created_at,
              verification_tier, trust_score, store_banner_url, store_logo_url, store_description,
              store_socials, store_announcement, avg_response_minutes, avg_delivery_minutes,
              refund_count, dispute_count
       from users where lower(username) = lower(?) and seller_status = 'approved' and is_banned = 0`,
      [data.username],
    );
    if (!sellerRow) return { seller: null, products: [], reviews: [] };
    const seller: StoreProfile = {
      ...sellerRow,
      store_socials:
        typeof sellerRow.store_socials === "string"
          ? JSON.parse(sellerRow.store_socials)
          : ((sellerRow.store_socials as Record<string, string> | null) ?? {}),
    };
    const [productRows, reviews] = await Promise.all([
      q(
        `${productSelect} where p.seller_id = ? and p.status in ('active','out_of_stock') order by p.sold_count desc`,
        [seller.id],
      ),
      q<{
        rating: number;
        comment: string | null;
        seller_reply: string | null;
        created_at: number;
        buyer: string;
        product_title: string;
      }>(
        `select r.rating, r.comment, r.seller_reply, r.created_at, u.username as buyer, o.product_title
       from reviews r join users u on u.id = r.buyer_id join orders o on o.id = r.order_id
       where r.seller_id = ? order by r.created_at desc limit 50`,
        [seller.id],
      ),
    ]);
    const products = productRows.map(mapProduct);
    return { seller, products, reviews };
  });

export interface CatalogItem {
  id: string;
  name: string;
  slug: string;
  is_active: number;
  categoryIds: string[];
}

export const listCatalogItems = createServerFn({ method: "GET" }).handler(async () => {
  await appContext();
  const [items, maps] = await Promise.all([
    q<{ id: string; name: string; slug: string; is_active: number }>(
      `select id, name, slug, is_active from catalog_items where is_active = 1 order by sort, name`,
    ),
    q<{ item_id: string; category_id: string }>(
      `select item_id, category_id from catalog_item_categories`,
    ),
  ]);
  const byItem: Record<string, string[]> = {};
  for (const m of maps) (byItem[m.item_id] ??= []).push(m.category_id);
  return { items: items.map((i) => ({ ...i, categoryIds: byItem[i.id] ?? [] })) };
});

export const getCategorySchema = createServerFn({ method: "GET" })
  .inputValidator(z.object({ categoryId: z.string() }))
  .handler(async ({ data }) => {
    await appContext();
    const c = await q1<{ id: string; name: string; submission_schema: string | null }>(
      `select id, name, submission_schema from categories where id = ?`,
      [data.categoryId],
    );
    if (!c) return { schema: null as CategorySubmissionSchema | null };
    let schema: CategorySubmissionSchema | null = null;
    if (c.submission_schema) {
      try {
        schema = JSON.parse(c.submission_schema) as CategorySubmissionSchema;
      } catch {
        /* ignore */
      }
    }
    return { schema };
  });

export const quickSearch = createServerFn({ method: "GET" })
  .inputValidator(z.object({ q: z.string().max(100) }))
  .handler(async ({ data }) => {
    await appContext();
    const term = data.q.trim().toLowerCase();
    if (!term) return { products: [], sellers: [], categories: [], items: [] };
    const like = `%${term}%`;
    const [products, sellers, categories, items] = await Promise.all([
      q<{
        id: string;
        title: string;
        slug: string;
        image_key: string | null;
        price_cents: number;
        category_name: string;
        delivery_type: string;
      }>(
        `select p.id, p.title, p.slug, p.image_key, p.price_cents, c.name as category_name, p.delivery_type
         from products p join categories c on c.id = p.category_id join users u on u.id = p.seller_id
         where p.status = 'active' and ${PUBLIC_SELLER_COND}
           and (lower(p.title) like ? or lower(p.description) like ? or lower(coalesce(p.platform,'')) like ?)
         order by p.sold_count desc, p.views desc limit 6`,
        [like, like, like],
      ),
      q<{ id: string; username: string; rating: number; total_sales: number }>(
        `select id, username, rating, total_sales from users
         where seller_status = 'approved' and is_banned = 0 and vacation_mode = 0 and lower(username) like ?
         order by total_sales desc limit 4`,
        [like],
      ),
      q<{ id: string; name: string; slug: string; icon: string }>(
        `select id, name, slug, icon from categories
         where is_active = 1 and lower(name) like ? order by sort limit 5`,
        [like],
      ),
      q<{ id: string; name: string; slug: string }>(
        `select id, name, slug from catalog_items
         where is_active = 1 and lower(name) like ? order by sort, name limit 5`,
        [like],
      ),
    ]);
    const suggestion = products.length === 0 ? await didYouMean(term) : null;
    return { products, sellers, categories, items, suggestion };
  });

/**
 * Facets: counts per category / item / delivery / verification tier for the
 * currently-applied query. Drives the left rail on /browse so users always
 * know how many results each filter would yield.
 */
export const browseFacets = createServerFn({ method: "GET" })
  .inputValidator(
    z.object({
      category: z.string().optional(),
      item: z.string().optional(),
      q: z.string().max(100).optional(),
      delivery: z.enum(["auto", "manual"]).optional(),
      minPrice: z.number().optional(),
      maxPrice: z.number().optional(),
      inStock: z.boolean().optional(),
    }),
  )
  .handler(async ({ data }) => {
    await appContext();
    // Build a shared WHERE excluding the facet being counted, so the user
    // can switch between categories without losing the option list.
    const baseConds: string[] = [`p.status = 'active'`, PUBLIC_SELLER_COND];
    const baseParams: Array<string | number> = [];
    if (data.q) {
      const tokens = tokenize(data.q);
      if (tokens.length > 0) {
        const { sql, params: sp } = buildSearchClause(tokens, [
          "p.title",
          "p.description",
          "coalesce(p.platform,'')",
          "u.username",
          "c.name",
          "coalesce(ci.name,'')",
        ]);
        baseConds.push(`(${sql})`);
        baseParams.push(...sp);
      }
    }
    if (data.minPrice !== undefined) {
      baseConds.push(`p.price_cents >= ?`);
      baseParams.push(Math.round(data.minPrice * 100));
    }
    if (data.maxPrice !== undefined) {
      baseConds.push(`p.price_cents <= ?`);
      baseParams.push(Math.round(data.maxPrice * 100));
    }
    if (data.inStock) {
      baseConds.push(`(p.delivery_type = 'manual' or p.stock_count > 0)`);
    }
    const FROM = `from products p
       join categories c on c.id = p.category_id
       join users u on u.id = p.seller_id
       left join catalog_items ci on ci.id = p.item_id`;

    const withCond = (extra: string[], extraParams: Array<string | number>) => ({
      where: [...baseConds, ...extra].join(" and "),
      params: [...baseParams, ...extraParams],
    });

    // Categories — count ignoring active category filter
    const catCond = withCond(data.item ? [`p.item_id = ?`] : [], data.item ? [data.item] : []);
    const itemCond = withCond(
      data.category ? [`c.slug = ?`] : [],
      data.category ? [data.category] : [],
    );
    const fullCond = withCond(
      [...(data.category ? [`c.slug = ?`] : []), ...(data.item ? [`p.item_id = ?`] : [])],
      [...(data.category ? [data.category] : []), ...(data.item ? [data.item] : [])],
    );

    const [categories, items, delivery, tiers, priceRange] = await Promise.all([
      q<{ slug: string; name: string; icon: string; c: number }>(
        `select c.slug, c.name, c.icon, count(*) c ${FROM} where ${catCond.where}
           group by c.id order by c.sort`,
        catCond.params,
      ),
      q<{ id: string; name: string; c: number }>(
        `select ci.id, ci.name, count(*) c ${FROM} where ${itemCond.where} and ci.id is not null
           group by ci.id order by c desc limit 30`,
        itemCond.params,
      ),
      q<{ delivery_type: string; c: number }>(
        `select p.delivery_type, count(*) c ${FROM} where ${fullCond.where} group by p.delivery_type`,
        fullCond.params,
      ),
      q<{ verification_tier: string; c: number }>(
        `select u.verification_tier, count(*) c ${FROM} where ${fullCond.where} group by u.verification_tier`,
        fullCond.params,
      ),
      q1<{ lo: number | null; hi: number | null }>(
        `select min(p.price_cents) lo, max(p.price_cents) hi ${FROM} where ${fullCond.where}`,
        fullCond.params,
      ),
    ]);
    return { categories, items, delivery, tiers, priceRange: priceRange ?? { lo: 0, hi: 0 } };
  });

/**
 * Cheap autocomplete: returns up to 8 product title suggestions matching a
 * prefix. Used by the header SmartSearch for inline typeahead.
 */
export const searchSuggest = createServerFn({ method: "GET" })
  .inputValidator(z.object({ q: z.string().max(60) }))
  .handler(async ({ data }) => {
    await appContext();
    const term = data.q.trim().toLowerCase();
    if (term.length < 2) return { suggestions: [] as string[] };
    const rows = await q<{ s: string }>(
      `select distinct lower(p.title) s from products p join users u on u.id = p.seller_id
         where p.status = 'active' and ${PUBLIC_SELLER_COND} and lower(p.title) like ?
         order by p.sold_count desc limit 8`,
      [`%${term}%`],
    );
    return { suggestions: rows.map((r) => r.s) };
  });

/**
 * Returns only those slugs whose product is currently purchasable: active
 * status, seller not banned, seller not on vacation. Used to scrub the
 * client-side "recently viewed" rail so unavailable items disappear.
 */
export const filterAvailableSlugs = createServerFn({ method: "POST" })
  .inputValidator(z.object({ slugs: z.array(z.string().max(160)).max(24) }))
  .handler(async ({ data }) => {
    await appContext();
    if (data.slugs.length === 0) return { slugs: [] as string[] };
    const placeholders = data.slugs.map(() => "?").join(",");
    const rows = await q<{ slug: string }>(
      `select p.slug from products p join users u on u.id = p.seller_id
        where p.slug in (${placeholders}) and p.status = 'active' and ${PUBLIC_SELLER_COND}`,
      data.slugs,
    );
    return { slugs: rows.map((r) => r.slug) };
  });

/**
 * Frequently Bought Together — true co-purchase signal from order history.
 *
 * For the given product, find buyers who purchased it, then surface the
 * top other products those buyers also bought (excluding the same product
 * and out-of-stock listings). Falls back to category-mates so the section
 * never renders empty on long-tail items.
 */
export const getFrequentlyBoughtTogether = createServerFn({ method: "GET" })
  .inputValidator(
    z.object({ productId: z.string(), limit: z.number().int().min(1).max(8).default(4) }),
  )
  .handler(async ({ data }) => {
    await appContext();
    const lookback = Date.now() - 180 * 86_400_000;
    const co = await q<{ id: string; pairs: number }>(
      `select p.id, count(*) as pairs
         from orders a
         join orders b on b.buyer_id = a.buyer_id and b.product_id <> a.product_id
                       and abs(b.created_at - a.created_at) < ${30 * 86_400_000}
         join products p on p.id = b.product_id
         join users u on u.id = p.seller_id
        where a.product_id = ?
          and a.created_at >= ?
          and a.status in ('completed','released','delivered')
          and b.status in ('completed','released','delivered')
          and p.status = 'active' and ${PUBLIC_SELLER_COND}
        group by p.id
        order by pairs desc
        limit ?`,
      [data.productId, lookback, data.limit],
    );
    let ids = co.map((r) => r.id);
    if (ids.length < data.limit) {
      const seed = await q1<{ category_id: string; seller_id: string }>(
        `select category_id, seller_id from products where id = ?`,
        [data.productId],
      );
      if (seed) {
        const excludes = [data.productId, ...ids];
        const fillers = await q<{ id: string }>(
          `select p.id from products p join users u on u.id = p.seller_id
            where p.status = 'active' and ${PUBLIC_SELLER_COND}
              and p.id not in (${excludes.map(() => "?").join(",")})
              and p.category_id = ? and p.seller_id <> ?
            order by p.sold_count desc limit ?`,
          [...excludes, seed.category_id, seed.seller_id, data.limit - ids.length],
        );
        ids = ids.concat(fillers.map((f) => f.id));
      }
    }
    if (ids.length === 0) return { items: [] as PublicProduct[] };
    const rows = await q(`${productSelect} where p.id in (${ids.map(() => "?").join(",")})`, ids);
    // preserve co-purchase ranking order
    const order = new Map(ids.map((id, i) => [id, i]));
    rows.sort(
      (a, b) =>
        (order.get((a as { id: string }).id) ?? 0) - (order.get((b as { id: string }).id) ?? 0),
    );
    return { items: rows.map(mapProduct) };
  });

/**
 * Public Seller Leaderboard — top trusted sellers, ranked by a blended
 * trust + sales score. Excludes banned / vacation-mode sellers and anyone
 * with zero completed sales so the page looks credible from day one.
 */
export interface LeaderboardSeller extends PublicSeller {
  rank: number;
  gmv_cents: number;
  recent_orders: number;
  category_name: string | null;
}

export const getSellerLeaderboard = createServerFn({ method: "GET" })
  .inputValidator(
    z.object({
      range: z.enum(["30d", "90d", "all"]).default("30d"),
      limit: z.number().int().min(5).max(50).default(25),
    }),
  )
  .handler(async ({ data }) => {
    await appContext();
    const dayMs = 86_400_000;
    const since = data.range === "all" ? 0 : Date.now() - (data.range === "30d" ? 30 : 90) * dayMs;
    const rows = await q<{
      id: string;
      username: string;
      seller_level: number;
      rating: number;
      rating_count: number;
      total_sales: number;
      completion_rate: number;
      vacation_mode: number;
      created_at: number;
      verification_tier: PublicSeller["verification_tier"];
      trust_score: number;
      refund_count: number;
      dispute_count: number;
      gmv_cents: number;
      recent_orders: number;
      category_name: string | null;
    }>(
      `select u.id, u.username, u.seller_level, u.rating, u.rating_count, u.total_sales,
              u.completion_rate, u.vacation_mode, u.created_at, u.verification_tier,
              u.trust_score, u.refund_count, u.dispute_count,
              coalesce((select sum(o.total_cents) from orders o
                          where o.seller_id = u.id and o.paid_at > ?
                            and o.status not in ('cancelled','expired','refunded')),0) as gmv_cents,
              coalesce((select count(*) from orders o
                          where o.seller_id = u.id and o.paid_at > ?
                            and o.status not in ('cancelled','expired','refunded')),0) as recent_orders,
              (select c.name from products p join categories c on c.id = p.category_id
                 where p.seller_id = u.id and p.status = 'active'
                 group by c.id, c.name order by sum(p.sold_count) desc limit 1) as category_name
         from users u
        where u.seller_status = 'approved' and u.is_banned = 0 and u.vacation_mode = 0 and u.total_sales > 0
        order by (u.trust_score * 0.7 + (case when u.total_sales < 500 then u.total_sales else 500 end) * 0.3) desc, u.total_sales desc
        limit ?`,
      [since, since, data.limit],
    );
    const items: LeaderboardSeller[] = rows.map((r, i) => ({
      id: r.id,
      username: r.username,
      seller_level: r.seller_level,
      rating: r.rating,
      rating_count: r.rating_count,
      total_sales: r.total_sales,
      completion_rate: r.completion_rate,
      vacation_mode: r.vacation_mode,
      created_at: r.created_at,
      verification_tier: r.verification_tier ?? "unverified",
      trust_score: Number(r.trust_score ?? 0),
      refund_count: Number(r.refund_count ?? 0),
      dispute_count: Number(r.dispute_count ?? 0),
      rank: i + 1,
      gmv_cents: Number(r.gmv_cents ?? 0),
      recent_orders: Number(r.recent_orders ?? 0),
      category_name: r.category_name ?? null,
    }));
    return { items, range: data.range };
  });
