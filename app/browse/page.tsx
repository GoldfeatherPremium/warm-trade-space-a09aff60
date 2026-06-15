import type { Metadata } from "next";
import Link from "next/link";
import { PackageSearch } from "lucide-react";
import { browseProductsData, type BrowseParams } from "@/server/queries/catalog";
import { PublicShell } from "../_components/site-shell";
import { SearchBox } from "../_components/search-box";
import { ProductCard } from "../_components/product-card";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const sp = await searchParams;
  const activeFilters = [sp.category, sp.q, sp.delivery, sp.sort && sp.sort !== "popular" ? sp.sort : undefined, sp.item].filter(Boolean).length;
  return {
    title: "Browse listings",
    description:
      "Browse digital goods on X-VAULT — game top-ups, gift cards, subscriptions, software keys and accounts. Buyer-protected, USDT payments, instant delivery.",
    alternates: { canonical: "/browse" },
    ...(activeFilters > 1 ? { robots: { index: false, follow: true } } : {}),
  };
}

const SORTS: Array<{ v: NonNullable<BrowseParams["sort"]>; label: string }> = [
  { v: "popular", label: "Popular" },
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
  };
  const { items, total, page, pageCount } = await browseProductsData(params);

  const qs = (patch: Partial<Record<string, string | number>>) => {
    const merged: Record<string, string> = {};
    for (const [k, v] of Object.entries(sp)) {
      const s = str(v);
      if (s) merged[k] = s;
    }
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined || v === "") delete merged[k];
      else merged[k] = String(v);
    }
    const s = new URLSearchParams(merged).toString();
    return s ? `/browse?${s}` : "/browse";
  };

  return (
    <PublicShell>
      <div className="max-w-xl mb-5">
        <SearchBox variant="hero" />
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <h1 className="font-display text-2xl">
          {params.q
            ? `Results for “${params.q}”`
            : params.category
              ? `Category: ${params.category}`
              : "All listings"}
          <span className="text-sm text-muted-foreground font-body ml-2">{total} items</span>
        </h1>
        <div className="flex gap-1.5 flex-wrap">
          {SORTS.map((s) => (
            <Link
              key={s.v}
              href={qs({ sort: s.v, page: undefined })}
              className={`text-[11px] font-bold rounded-md px-2.5 py-1.5 ${
                (params.sort ?? "popular") === s.v
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary/50 text-muted-foreground hover:bg-secondary"
              }`}
            >
              {s.label}
            </Link>
          ))}
        </div>
      </div>

      {items.length === 0 ? (
        <div className="py-20 text-center space-y-2">
          <PackageSearch className="size-8 text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">No listings match your search.</p>
          <Link href="/browse" className="text-primary text-xs font-bold">
            Clear filters
          </Link>
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
                  className="text-xs font-bold rounded-md px-3 py-2 bg-secondary hover:bg-secondary/70"
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
                  className="text-xs font-bold rounded-md px-3 py-2 bg-secondary hover:bg-secondary/70"
                >
                  Next →
                </Link>
              )}
            </div>
          )}
        </>
      )}
    </PublicShell>
  );
}
