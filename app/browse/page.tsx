import type { Metadata } from "next";
import Link from "next/link";
import { PackageSearch, X, SlidersHorizontal } from "lucide-react";
import { browseProductsData, type BrowseParams } from "@/server/queries/catalog";
import { q } from "@/lib/server/db.server";
import { appContext } from "@/lib/server/app.server";
import { PublicShell } from "../_components/site-shell";
import { ProductCard } from "../_components/product-card";
import { BrowseFilters } from "./browse-filters";

// Dynamic page but give CDN a 30-second window to coalesce concurrent requests.
export const revalidate = 30;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const sp = await searchParams;
  const category = Array.isArray(sp.category) ? sp.category[0] : sp.category;
  const activeFilters = [
    sp.category,
    sp.q,
    sp.delivery,
    sp.sort && sp.sort !== "popular" ? sp.sort : undefined,
    sp.item,
    sp.minPrice,
    sp.maxPrice,
    sp.inStock,
    sp.verified,
  ].filter(Boolean).length;
  // A lone category filter is its own indexable landing page; canonicalize to
  // itself rather than to /browse. Anything more (search, sort, multi-filter)
  // collapses back to /browse and is noindexed below.
  const canonical =
    activeFilters === 1 && category
      ? `/browse?category=${encodeURIComponent(category)}`
      : "/browse";
  return {
    title: "Browse listings",
    description:
      "Browse digital goods on X-VAULT — game top-ups, gift cards, subscriptions, software keys and accounts. Buyer-protected, USDT payments, instant delivery.",
    alternates: { canonical },
    openGraph: {
      title: "Browse digital goods — X-VAULT",
      description:
        "Browse digital goods on X-VAULT — game top-ups, gift cards, subscriptions, software keys and accounts. Buyer-protected, USDT payments, instant delivery.",
      url: `${SITE_URL}/browse`,
      images: [{ url: `${SITE_URL}/assets/og-default.jpg`, width: 1200, height: 630 }],
    },
    twitter: { card: "summary_large_image" },
    ...(activeFilters > 1 ? { robots: { index: false, follow: true } } : {}),
  };
}

const SORTS: Array<{ v: NonNullable<BrowseParams["sort"]>; label: string }> = [
  { v: "popular", label: "Most relevant" },
  { v: "newest", label: "Newest" },
  { v: "price_asc", label: "Price ↑" },
  { v: "price_desc", label: "Price ↓" },
  { v: "rating", label: "Top rated" },
];

function str(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;

  await appContext();
  const sidebarCats = await q<{ name: string; slug: string; icon: string }>(
    `select name, slug, icon from categories where is_active = 1 order by sort limit 12`,
  ).catch(() => []);

  const params: BrowseParams = {
    category: str(sp.category),
    item: str(sp.item),
    q: str(sp.q),
    delivery:
      str(sp.delivery) === "auto" || str(sp.delivery) === "manual"
        ? (str(sp.delivery) as "auto" | "manual")
        : undefined,
    sort: (str(sp.sort) as BrowseParams["sort"]) ?? "popular",
    page: Math.max(1, Number(str(sp.page) ?? 1) || 1),
    minPrice: str(sp.minPrice) ? Number(str(sp.minPrice)) : undefined,
    maxPrice: str(sp.maxPrice) ? Number(str(sp.maxPrice)) : undefined,
    inStock: str(sp.inStock) === "1",
    verified: str(sp.verified) === "1",
  };
  const { items, total, page, pageCount } = await browseProductsData(params);

  // Raw (string) params for client filter component + URL building
  const rawSp: Record<string, string> = {};
  for (const [k, v] of Object.entries(sp)) {
    const s = str(v);
    if (s) rawSp[k] = s;
  }

  const qs = (patch: Partial<Record<string, string | number>>) => {
    const merged: Record<string, string> = { ...rawSp };
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined || v === "") delete merged[k];
      else merged[k] = String(v);
    }
    const s = new URLSearchParams(merged).toString();
    return s ? `/browse?${s}` : "/browse";
  };

  const activeChips = [
    params.category && { label: `Category: ${params.category}`, patch: { category: undefined } },
    params.delivery && {
      label: params.delivery === "auto" ? "Instant delivery" : "Manual delivery",
      patch: { delivery: undefined },
    },
    params.inStock && { label: "In stock", patch: { inStock: undefined } },
    params.verified && { label: "Verified sellers", patch: { verified: undefined } },
    params.minPrice && { label: `Min $${params.minPrice}`, patch: { minPrice: undefined } },
    params.maxPrice && { label: `Max $${params.maxPrice}`, patch: { maxPrice: undefined } },
  ].filter(Boolean) as Array<{ label: string; patch: Record<string, undefined> }>;

  return (
    <PublicShell>
      <div className="flex gap-6">
        {/* Sidebar — desktop only */}
        <aside className="hidden lg:block w-52 shrink-0">
          <div className="sticky top-28">
            <BrowseFilters categories={sidebarCats} currentParams={rawSp} />
          </div>
        </aside>

        {/* Results */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="mb-4">
            <h1 className="font-display text-2xl mb-1">
              {params.q
                ? `Results for "${params.q}"`
                : params.category
                  ? `Category: ${params.category}`
                  : "All listings"}
            </h1>
            <p className="text-xs text-muted-foreground">
              {total.toLocaleString()} {total === 1 ? "listing" : "listings"} found
              {params.q ? ` for "${params.q}"` : ""}
            </p>
          </div>

          {/* Sort + mobile filter toggle */}
          <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
            <details className="lg:hidden">
              <summary className="inline-flex items-center gap-1.5 text-xs font-bold rounded-md px-3 py-1.5 bg-secondary/60 cursor-pointer list-none">
                <SlidersHorizontal className="size-3.5" /> Filters
              </summary>
              <div className="mt-3 p-4 rounded-xl border border-border bg-card">
                <BrowseFilters categories={sidebarCats} currentParams={rawSp} />
              </div>
            </details>
            <div className="flex gap-1.5 flex-wrap ml-auto">
              {SORTS.map((s) => (
                <Link
                  key={s.v}
                  href={qs({ sort: s.v, page: undefined })}
                  className={`text-[11px] font-semibold rounded-xl px-3 py-1.5 transition-all ${
                    (params.sort ?? "popular") === s.v
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary/60 text-muted-foreground hover:text-foreground hover:bg-secondary"
                  }`}
                >
                  {s.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Active filter chips */}
          {activeChips.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 mb-4">
              {activeChips.map((f) => (
                <Link
                  key={f.label}
                  href={qs({ ...f.patch, page: undefined })}
                  className="inline-flex items-center gap-1 text-[11px] bg-primary/10 text-primary border border-primary/25 rounded-full px-2.5 py-1 hover:bg-primary/20 transition-colors capitalize"
                >
                  {f.label} <X className="size-2.5" />
                </Link>
              ))}
              <Link
                href="/browse"
                className="text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2 ml-1"
              >
                Clear all
              </Link>
            </div>
          )}

          {/* Results grid */}
          {items.length === 0 ? (
            <div className="py-16 text-center">
              <PackageSearch className="size-10 text-muted-foreground mx-auto mb-3" />
              <p className="font-semibold mb-1">No listings match your search</p>
              <p className="text-sm text-muted-foreground mb-4">
                {params.q
                  ? `We couldn't find anything for "${params.q}"`
                  : "No listings with these filters"}
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                <Link
                  href="/browse"
                  className="text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground font-bold"
                >
                  Clear all filters
                </Link>
                {params.q && activeChips.length > 0 && (
                  <Link
                    href={`/browse?q=${encodeURIComponent(params.q)}`}
                    className="text-xs px-3 py-1.5 rounded-md bg-secondary text-foreground font-bold"
                  >
                    Remove filters, keep search
                  </Link>
                )}
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {items.map((p, i) => (
                  <ProductCard key={p.id} product={p} priority={i < 4} />
                ))}
              </div>
              {pageCount > 1 && (
                <div className="flex items-center justify-center gap-2 mt-8">
                  {page > 1 && (
                    <Link
                      href={qs({ page: page - 1 })}
                      className="text-xs font-semibold rounded-xl px-4 py-2 bg-secondary/70 hover:bg-secondary transition-colors border border-border/60"
                    >
                      ← Prev
                    </Link>
                  )}
                  <span className="text-xs text-muted-foreground">
                    Page {page} of {pageCount}
                  </span>
                  {page < pageCount && (
                    <Link
                      href={qs({ page: page + 1 })}
                      className="text-xs font-semibold rounded-xl px-4 py-2 bg-secondary/70 hover:bg-secondary transition-colors border border-border/60"
                    >
                      Next →
                    </Link>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </PublicShell>
  );
}
