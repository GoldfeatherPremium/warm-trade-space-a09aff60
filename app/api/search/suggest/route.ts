import { q } from "@/lib/server/db.server";
import { appContext } from "@/lib/server/app.server";

export const dynamic = "force-dynamic";

type SuggestProduct = {
  title: string;
  slug: string;
  price_cents: number;
  sold_count: number;
  image_key: string | null;
  delivery_type: string;
  category_name: string;
};
type SuggestSeller = {
  username: string;
  rating: number;
  total_sales: number;
  verification_tier: string;
};
type SuggestCategory = { name: string; slug: string; icon: string };

type SuggestResult = {
  products: SuggestProduct[];
  sellers: SuggestSeller[];
  categories: SuggestCategory[];
  popular: string[];
  suggestion: string | null;
};

const EMPTY: SuggestResult = {
  products: [],
  sellers: [],
  categories: [],
  popular: [],
  suggestion: null,
};

export async function GET(req: Request) {
  try {
    await appContext();
  } catch {
    return Response.json(EMPTY);
  }

  const url = new URL(req.url);
  const raw = (url.searchParams.get("q") ?? "").trim();
  const term = raw.toLowerCase();

  // ── Empty query: trending searches + top categories ──
  if (term.length === 0) {
    const since = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const [trendingRows, catRows] = await Promise.all([
      q<{ query: string }>(
        `select lower(query) as query
           from search_queries
          where created_at >= ? and length(query) >= 2 and results > 0
          group by lower(query)
          order by count(*) desc
          limit 8`,
        [since],
      ).catch(() => []),
      q<SuggestCategory>(
        `select name, slug, icon from categories where is_active = 1 order by sort limit 8`,
      ).catch(() => []),
    ]);
    return Response.json({
      ...EMPTY,
      popular: trendingRows.map((r) => r.query),
      categories: catRows,
    });
  }

  // ── Typed query: products + sellers + categories + popular ──
  const like = `%${term}%`;
  const prefix = `${term}%`;
  const [products, sellers, categories, popularRows] = await Promise.all([
    q<SuggestProduct>(
      `select p.title, p.slug, p.price_cents, p.sold_count, p.image_key,
              p.delivery_type, c.name as category_name
         from products p
         join categories c on c.id = p.category_id
         join users u on u.id = p.seller_id
        where p.status = 'active' and u.is_banned = 0 and u.vacation_mode = 0
          and (lower(p.title) like ? or lower(coalesce(p.platform,'')) like ?)
        order by p.sold_count desc, p.views desc
        limit 6`,
      [like, like],
    ).catch(() => []),
    q<SuggestSeller>(
      `select username, rating, total_sales, verification_tier
         from users
        where lower(username) like ? and is_banned = 0 and total_sales > 0
        order by total_sales desc
        limit 3`,
      [like],
    ).catch(() => []),
    q<SuggestCategory>(
      `select name, slug, icon from categories
        where is_active = 1 and lower(name) like ?
        order by sort
        limit 4`,
      [like],
    ).catch(() => []),
    q<{ query: string }>(
      `select lower(query) as query from search_queries
        where results > 0 and lower(query) like ?
        group by lower(query)
        order by count(*) desc
        limit 6`,
      [prefix],
    ).catch(() => []),
  ]);

  let suggestion: string | null = null;
  if (products.length === 0) {
    try {
      const { didYouMean } = await import("@/lib/server/search.server");
      suggestion = await didYouMean(raw);
    } catch {
      /* ignore */
    }
  }

  return Response.json({
    products,
    sellers,
    categories,
    popular: popularRows.map((r) => r.query),
    suggestion,
  } satisfies SuggestResult);
}
