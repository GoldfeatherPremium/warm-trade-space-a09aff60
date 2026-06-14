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
import type { PublicProduct, PublicSeller, CategorySubmissionSchema } from "@/lib/api/catalog";

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
