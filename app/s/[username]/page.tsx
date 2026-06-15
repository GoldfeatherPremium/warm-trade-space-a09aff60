import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Star, ShieldCheck, Store } from "lucide-react";
import { getSellerStoreData } from "@/server/queries/catalog";
import { timeAgo } from "@/lib/format";
import { PublicShell } from "../../_components/site-shell";
import { ProductCard } from "../../_components/product-card";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  const { seller } = await getSellerStoreData(username);
  if (!seller) return { title: "Store not found" };
  const title = `${seller.username} — Seller store`;
  const description = `${seller.username} on X-VAULT: ${seller.total_sales.toLocaleString()} sales, ${seller.rating > 0 ? seller.rating.toFixed(1) + "★" : "new seller"}, buyer protected. Browse listings & buy with USDT.`;
  return {
    title,
    description,
    alternates: { canonical: `/s/${seller.username}` },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/s/${seller.username}`,
      images: [{ url: `${SITE_URL}/assets/og-default.jpg`, width: 1200, height: 630 }],
    },
    twitter: { card: "summary_large_image" },
  };
}

export default async function StorePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const { seller, products, reviews } = await getSellerStoreData(username);
  if (!seller) notFound();

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Sellers", item: `${SITE_URL}/sellers` },
      { "@type": "ListItem", position: 3, name: seller.username, item: `${SITE_URL}/s/${seller.username}` },
    ],
  };

  return (
    <PublicShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      <header className="bg-card border border-border rounded-2xl p-5 mb-6">
        <div className="flex items-center gap-4">
          <div className="size-16 rounded-2xl bg-primary/15 border border-primary/40 grid place-items-center text-xl font-bold text-primary uppercase">
            {seller.username.slice(0, 2)}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-2xl flex items-center gap-2">
              <Store className="size-5 text-muted-foreground" /> {seller.username}
            </h1>
            <p className="text-[11px] text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="flex items-center gap-0.5 text-yellow-400 font-bold">
                <Star className="size-3 fill-current" />
                {seller.rating > 0 ? seller.rating.toFixed(1) : "new"} ({seller.rating_count})
              </span>
              <span>Level {seller.seller_level}</span>
              <span>{seller.total_sales.toLocaleString()} sales</span>
              <span className="flex items-center gap-0.5">
                <ShieldCheck className="size-3 text-accent" /> Buyer protected
              </span>
            </p>
            {seller.store_description && (
              <p className="text-sm text-foreground/80 mt-2">{seller.store_description}</p>
            )}
          </div>
        </div>
        {seller.store_announcement && (
          <p className="mt-3 text-xs bg-primary/10 border border-primary/30 rounded-md p-2 text-foreground/90">
            📢 {seller.store_announcement}
          </p>
        )}
      </header>

      <section className="mb-8">
        <h2 className="font-display text-xl mb-3">Listings ({products.length})</h2>
        {products.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            This seller has no active listings right now.
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {products.map((p, i) => (
              <ProductCard key={p.id} product={p} priority={i < 4} />
            ))}
          </div>
        )}
      </section>

      {reviews.length > 0 && (
        <section>
          <h2 className="font-display text-xl mb-3">Recent reviews</h2>
          <div className="space-y-3">
            {reviews.slice(0, 20).map((r, i) => (
              <div key={i} className="bg-card border border-border rounded-xl p-3">
                <div className="flex items-center gap-2 text-xs">
                  <span className="flex items-center gap-0.5 text-yellow-400 font-bold">
                    <Star className="size-3 fill-current" />
                    {r.rating}
                  </span>
                  <span className="font-bold">{r.buyer}</span>
                  <span className="text-muted-foreground truncate">on {r.product_title}</span>
                  <span className="text-muted-foreground ml-auto shrink-0">
                    {timeAgo(r.created_at)}
                  </span>
                </div>
                {r.comment && <p className="text-sm text-foreground/80 mt-1">{r.comment}</p>}
              </div>
            ))}
          </div>
        </section>
      )}
    </PublicShell>
  );
}
