/**
 * RSC-facing catalog read queries for the Next.js App Router migration.
 *
 * These are plain async functions called directly from Server Components — no
 * `createServerFn`, no client data layer, zero client JS for the data. They
 * import only the framework-agnostic server core (`db`, `cache`, `app`
 * context), never the legacy `src/lib/api/*` (which pull in the TanStack Start
 * runtime). Shared TYPES are imported type-only (erased at compile), so no
 * runtime coupling to the legacy layer.
 *
 * The SQL select + row mapper are kept byte-identical to the legacy
 * `src/lib/api/catalog.ts` so results match exactly during the transition;
 * the legacy file is retired at cutover (Phase 7).
 */
import { appContext } from "@/lib/server/app.server";
import { q, q1 } from "@/lib/server/db.server";
import { cached } from "@/lib/server/cache.server";
import type {
  PublicProduct,
  PublicSeller,
  CategorySubmissionSchema,
  StoreProfile,
  LeaderboardSeller,
} from "@/lib/api/catalog";

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

const PUBLIC_SELLER_COND = `u.vacation_mode = 0 and u.is_banned = 0`;

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
  > & { featured_until?: number | null };
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

export interface HomeCategory {
  id: string;
  name: string;
  slug: string;
  icon: string;
  default_warranty_hours: number;
  commission_pct: number;
  risk_tier: string;
  product_count: number;
}

export interface HomePageData {
  categories: HomeCategory[];
  trending: PublicProduct[];
  newest: PublicProduct[];
  topSellers: PublicSeller[];
  recentSales: Array<{
    product_title: string;
    total_cents: number;
    created_at: number;
    buyer: string;
  }>;
  stats: { sellers: number; products: number; orders: number; reviews: number };
  last24h: { orders24h: number; gmv24h: number };
  trendingSearches: Array<{ query: string; uses: number }>;
}

/** Homepage feed — identical for every visitor, served from the shared 20s cache. */
export async function getHomePageData(): Promise<HomePageData> {
  await appContext();
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
      q<HomeCategory>(
        `select c.id, c.name, c.slug, c.icon, c.default_warranty_hours, c.commission_pct, c.risk_tier,
              coalesce(pc.product_count, 0) as product_count
         from categories c
         left join (
           select p.category_id, count(*) as product_count
             from products p join users u on u.id = p.seller_id
            where p.status = 'active' and u.vacation_mode = 0 and u.is_banned = 0
            group by p.category_id
         ) pc on pc.category_id = c.id
        where c.is_active = 1 order by c.sort`,
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
    return {
      categories: categoryRows,
      trending: trendingRows.map(mapProduct),
      newest: newestRows.map(mapProduct),
      topSellers,
      recentSales,
      stats: stats ?? { sellers: 0, products: 0, orders: 0, reviews: 0 },
      last24h: last24h ?? { orders24h: 0, gmv24h: 0 },
      trendingSearches,
    };
  });
}

// ---------------------------------------------------------------------------
// Product detail (RSC). View-count increment is intentionally omitted here so
// the read stays pure/cacheable; view tracking moves to a client beacon later.
// ---------------------------------------------------------------------------
export interface ProductReview {
  rating: number;
  comment: string | null;
  seller_reply: string | null;
  created_at: number;
  buyer: string;
}
export interface ProductVariant {
  id: string;
  title: string;
  price_cents: number;
}

export async function getProductBySlug(slug: string): Promise<{
  product: PublicProduct | null;
  reviews: ProductReview[];
  variants: ProductVariant[];
}> {
  // Cache product detail pages for 60 seconds. View tracking is async (beacon-driven) and non-blocking.
  return cached(`product:slug:${slug}`, 60_000, async () => {
    await appContext();
    const row = await q1(`${productSelect} where p.slug = ?`, [slug]);
    if (!row) return { product: null, reviews: [], variants: [] };
    const product = mapProduct(row);
    if (product.status !== "active" && product.status !== "out_of_stock")
      return { product: null, reviews: [], variants: [] };
    const [reviews, variants] = await Promise.all([
      q<ProductReview>(
        `select r.rating, r.comment, r.seller_reply, r.created_at, u.username as buyer
         from reviews r join users u on u.id = r.buyer_id where r.product_id = ? order by r.created_at desc limit 30`,
        [product.id],
      ),
      q<ProductVariant>(
        `select id, title, price_cents from product_variants where product_id = ? order by sort`,
        [product.id],
      ),
    ]);
    return { product, reviews, variants };
  });
}

export async function getRelatedProductsData(
  productId: string,
  limit = 8,
): Promise<PublicProduct[]> {
  await appContext();
  // Single-query CTE: seed lookup + main select in one round-trip instead of two.
  // coalesce(item_id,'') means a NULL item_id never accidentally matches other products.
  const rows = await q(
    `with seed as (
       select coalesce(item_id, '') as item_id, category_id
       from products where id = ?
     )
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
     left join catalog_items ci on ci.id = p.item_id
     cross join seed
     where p.status = 'active' and ${PUBLIC_SELLER_COND} and p.id <> ?
       and (p.item_id = seed.item_id or p.category_id = seed.category_id)
     order by (case when seed.item_id != '' and p.item_id = seed.item_id then 0 else 1 end),
              p.sold_count desc, u.rating desc
     limit ?`,
    [productId, productId, limit],
  );
  return rows.map(mapProduct);
}

// ---------------------------------------------------------------------------
// Seller store (RSC)
// ---------------------------------------------------------------------------
export interface StoreReview extends ProductReview {
  product_title: string;
}

export async function getSellerStoreData(username: string): Promise<{
  seller: StoreProfile | null;
  products: PublicProduct[];
  reviews: StoreReview[];
}> {
  // Cache store pages (seller profile + products + reviews) for 2 minutes.
  // Store updates are infrequent (ratings accumulate, not instant); users tolerate brief staleness.
  return cached(`seller:store:${username.toLowerCase()}`, 2 * 60_000, async () => {
    await appContext();
    const sellerRow = await q1<StoreProfile & { store_socials: unknown }>(
      `select id, username, seller_level, rating, rating_count, total_sales, completion_rate, vacation_mode, created_at,
              verification_tier, trust_score, store_banner_url, store_logo_url, store_description,
              store_socials, store_announcement, avg_response_minutes, avg_delivery_minutes,
              refund_count, dispute_count
       from users where lower(username) = lower(?) and seller_status = 'approved' and is_banned = 0`,
      [username],
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
      q<StoreReview>(
        `select r.rating, r.comment, r.seller_reply, r.created_at, u.username as buyer, o.product_title
         from reviews r join users u on u.id = r.buyer_id join orders o on o.id = r.order_id
         where r.seller_id = ? order by r.created_at desc limit 50`,
        [seller.id],
      ),
    ]);
    return { seller, products: productRows.map(mapProduct), reviews };
  });
}

// ---------------------------------------------------------------------------
// Seller leaderboard (RSC)
// ---------------------------------------------------------------------------
export async function getSellerLeaderboardData(
  range: "30d" | "90d" | "all" = "30d",
  limit = 25,
): Promise<LeaderboardSeller[]> {
  // Cache leaderboard for 10 minutes per range. Rankings are stable; users tolerate brief staleness.
  return cached(`seller:leaderboard:${range}:${limit}`, 10 * 60_000, async () => {
    await appContext();
    const dayMs = 86_400_000;
    const since = range === "all" ? 0 : Date.now() - (range === "30d" ? 30 : 90) * dayMs;
    // Single query with LEFT JOINs replaces 3 correlated subqueries per seller row
    const rows = await q<Record<string, unknown>>(
      `select u.id, u.username, u.seller_level, u.rating, u.rating_count, u.total_sales,
              u.completion_rate, u.vacation_mode, u.created_at, u.verification_tier,
              u.trust_score, u.refund_count, u.dispute_count,
              coalesce(os.gmv_cents, 0) as gmv_cents,
              coalesce(os.recent_orders, 0) as recent_orders,
              pc.category_name
         from users u
         left join (
           select seller_id,
                  sum(total_cents) as gmv_cents,
                  count(*) as recent_orders
             from orders
            where paid_at > ?
              and status not in ('cancelled','expired','refunded')
            group by seller_id
         ) os on os.seller_id = u.id
         left join (
           select p.seller_id, c.name as category_name
             from products p
             join categories c on c.id = p.category_id
            where p.status = 'active'
            group by p.seller_id
            order by sum(p.sold_count) desc
         ) pc on pc.seller_id = u.id
        where u.seller_status = 'approved' and u.is_banned = 0 and u.vacation_mode = 0 and u.total_sales > 0
        order by (u.trust_score * 0.7 + (case when u.total_sales < 500 then u.total_sales else 500 end) * 0.3) desc, u.total_sales desc
        limit ?`,
      [since, limit],
    );
    return rows.map((r, i) => ({
      id: r.id as string,
      username: r.username as string,
      seller_level: r.seller_level as number,
      rating: r.rating as number,
      rating_count: r.rating_count as number,
      total_sales: r.total_sales as number,
      completion_rate: r.completion_rate as number,
      vacation_mode: r.vacation_mode as number,
      created_at: r.created_at as number,
      verification_tier: (r.verification_tier as PublicSeller["verification_tier"]) ?? "unverified",
      trust_score: Number(r.trust_score ?? 0),
      refund_count: Number(r.refund_count ?? 0),
      dispute_count: Number(r.dispute_count ?? 0),
      rank: i + 1,
      gmv_cents: Number(r.gmv_cents ?? 0),
      recent_orders: Number(r.recent_orders ?? 0),
      category_name: (r.category_name as string | null) ?? null,
    }));
  });
}

// ---------------------------------------------------------------------------
// Browse (RSC grid; filters are URL search params, no client data layer)
// ---------------------------------------------------------------------------
export interface BrowseParams {
  category?: string;
  item?: string;
  q?: string;
  delivery?: "auto" | "manual";
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  sort?: "popular" | "price_asc" | "price_desc" | "newest" | "rating";
  page?: number;
}

export async function browseProductsData(p: BrowseParams): Promise<{
  items: PublicProduct[];
  total: number;
  page: number;
  pageCount: number;
}> {
  // Cache the default browse (no filters, page 1, popular sort) for 30 seconds.
  // This is the highest-traffic path: every unauthenticated visitor lands here first.
  const isDefault =
    !p.category && !p.item && !p.q && !p.delivery && !p.minPrice && !p.maxPrice && !p.inStock &&
    (p.sort === "popular" || !p.sort) && (p.page === 1 || !p.page);
  if (isDefault) {
    return cached("browse:default:v1", 30_000, () => _browseProductsData(p));
  }
  return _browseProductsData(p);
}

async function _browseProductsData(p: BrowseParams): Promise<{
  items: PublicProduct[];
  total: number;
  page: number;
  pageCount: number;
}> {
  await appContext();
  const { sqliteFts5 } = await import("@/lib/server/db.server");
  const { tokenize, buildSearchClause } = await import("@/lib/server/search.server");
  const where: string[] = [`p.status = 'active'`, PUBLIC_SELLER_COND];
  const params: Array<string | number> = [];
  if (p.category) {
    where.push(`c.slug = ?`);
    params.push(p.category);
  }
  if (p.item) {
    where.push(`p.item_id = ?`);
    params.push(p.item);
  }
  if (p.q) {
    const tokens = tokenize(p.q);
    if (sqliteFts5 && tokens.length > 0) {
      // FTS5 index scan — orders of magnitude faster than LIKE on large catalogs
      const ftsQuery = tokens.map((t) => `"${t.replace(/"/g, '""')}"`).join(" ");
      where.push(`p.id in (select product_id from products_fts where products_fts match ?)`);
      params.push(ftsQuery);
    } else if (tokens.length > 0) {
      const cols = [
        "p.title",
        "p.description",
        "coalesce(p.platform,'')",
        "u.username",
        "c.name",
        "coalesce(ci.name,'')",
      ];
      const { sql, params: sp } = buildSearchClause(tokens, cols);
      where.push(`(${sql})`);
      params.push(...sp);
    } else {
      const like = `%${p.q.toLowerCase()}%`;
      where.push(`(lower(p.title) like ? or lower(p.description) like ?)`);
      params.push(like, like);
    }
  }
  if (p.delivery) {
    where.push(`p.delivery_type = ?`);
    params.push(p.delivery);
  }
  if (p.minPrice !== undefined) {
    where.push(`p.price_cents >= ?`);
    params.push(Math.round(p.minPrice * 100));
  }
  if (p.maxPrice !== undefined) {
    where.push(`p.price_cents <= ?`);
    params.push(Math.round(p.maxPrice * 100));
  }
  if (p.inStock) where.push(`(p.delivery_type = 'manual' or p.stock_count > 0)`);
  const order = {
    popular: `p.insurance_days desc, p.sold_count desc, p.views desc`,
    price_asc: `p.price_cents asc`,
    price_desc: `p.price_cents desc`,
    newest: `p.created_at desc`,
    rating: `u.rating desc, p.sold_count desc`,
  }[p.sort ?? "popular"];
  const PAGE = 24;
  const page = p.page ?? 1;
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
      `${productSelect} where ${whereSql} order by ${order} limit ${PAGE} offset ${(page - 1) * PAGE}`,
      params,
    ),
  ]);
  const total = totalRow!.c;
  return {
    items: itemRows.map(mapProduct),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / PAGE)),
  };
}
