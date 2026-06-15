import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Star, ShieldCheck, Package, Clock, Zap, Award, TrendingUp } from "lucide-react";
import { getSellerStoreData } from "@/server/queries/catalog";
import { LEVEL_META, type SellerLevel } from "@/lib/server/trust.server";
import { timeAgo } from "@/lib/format";
import { PublicShell } from "../../_components/site-shell";
import { ProductCard } from "../../_components/product-card";
import { SellerBadge } from "../../_components/seller-badge";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const revalidate = 60;

/** Compact "responds in ~X" formatter from minutes. */
function fmtMins(m: number): string {
  if (!m || m <= 0) return "—";
  if (m < 60) return `~${Math.round(m)} min`;
  if (m < 60 * 24) return `~${Math.round(m / 60)}h`;
  return `~${Math.round(m / 1440)}d`;
}

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
      {
        "@type": "ListItem",
        position: 3,
        name: seller.username,
        item: `${SITE_URL}/s/${seller.username}`,
      },
    ],
  };

  return (
    <PublicShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      <header className="rounded-2xl overflow-hidden border border-border mb-6 shadow-card">
        {/* Banner — seller-set URL via CSS bg (matches editor; avoids next/image
            domain config) with a gradient fallback. */}
        <div
          className="relative h-32 sm:h-44 bg-cover bg-center"
          style={
            seller.store_banner_url
              ? { backgroundImage: `url(${seller.store_banner_url})` }
              : { background: "var(--gradient-hero)" }
          }
        >
          <div className="absolute inset-0" style={{ background: "var(--gradient-aurora)" }} />
        </div>

        {/* Profile bar */}
        <div className="bg-card px-5 pb-5">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4 -mt-10">
            {/* Avatar */}
            <div className="size-20 rounded-2xl border-2 border-card bg-primary/15 grid place-items-center text-2xl font-bold text-primary uppercase shrink-0 overflow-hidden ring-1 ring-primary/30">
              {seller.store_logo_url ? (
                <img
                  src={seller.store_logo_url}
                  alt={seller.username}
                  className="size-full object-cover"
                />
              ) : (
                seller.username.slice(0, 2)
              )}
            </div>

            <div className="flex-1 min-w-0 sm:pb-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-2xl leading-none">{seller.username}</h1>
                <SellerBadge tier={seller.verification_tier} />
                <span
                  className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md ${LEVEL_META[seller.seller_level as SellerLevel]?.cls ?? ""}`}
                >
                  <Award className="size-2.5" />
                  {LEVEL_META[seller.seller_level as SellerLevel]?.label ??
                    `Lvl ${seller.seller_level}`}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="flex items-center gap-0.5 text-amber-400 font-bold">
                  <Star className="size-3 fill-current" />
                  {seller.rating > 0 ? seller.rating.toFixed(1) : "New"} ({seller.rating_count})
                </span>
                <span className="flex items-center gap-1">
                  <ShieldCheck className="size-3 text-primary" /> Buyer protected
                </span>
                <span>Member since {new Date(seller.created_at).getFullYear()}</span>
              </p>
            </div>
          </div>

          {seller.store_description && (
            <p className="text-sm text-foreground/80 mt-4 max-w-2xl leading-relaxed">
              {seller.store_description}
            </p>
          )}

          {/* Stat grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-4">
            {[
              {
                icon: TrendingUp,
                label: "Trust score",
                value: seller.trust_score > 0 ? Math.round(seller.trust_score).toString() : "—",
              },
              {
                icon: Package,
                label: "Total sales",
                value: seller.total_sales.toLocaleString(),
              },
              {
                icon: ShieldCheck,
                label: "Completion",
                value: `${Math.round(seller.completion_rate)}%`,
              },
              {
                icon: Clock,
                label: "Avg. response",
                value: fmtMins(seller.avg_response_minutes),
              },
            ].map((s) => (
              <div key={s.label} className="glass rounded-xl p-3 flex flex-col gap-1">
                <s.icon className="size-3.5 text-primary" />
                <span className="text-base font-bold leading-none">{s.value}</span>
                <span className="text-[10px] text-muted-foreground">{s.label}</span>
              </div>
            ))}
          </div>

          {seller.store_announcement && (
            <p className="mt-4 text-xs bg-primary/10 border border-primary/30 rounded-lg p-2.5 text-foreground/90 flex items-start gap-2">
              <Zap className="size-3.5 text-primary shrink-0 mt-0.5" />
              {seller.store_announcement}
            </p>
          )}
        </div>
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
                  <span className="flex items-center gap-0.5 text-amber-400 font-bold">
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
