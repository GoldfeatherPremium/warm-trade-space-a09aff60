import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck, Zap, Headphones, Star, ArrowUpRight } from "lucide-react";
import { getHomePageData } from "@/server/queries/catalog";
import { usdtShort, timeAgo } from "@/lib/format";
import { PublicShell } from "./_components/site-shell";
import { SearchBox } from "./_components/search-box";
import { ProductCard } from "./_components/product-card";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  title: "X-VAULT — Buy & Sell Digital Goods with USDT",
  description:
    "The trusted digital goods marketplace. Game currency, gift cards, keys, accounts and boosting — buyer-protected, paid in USDT, instant delivery.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "X-VAULT — Buy & Sell Digital Goods with USDT",
    description: "Buyer-protected digital marketplace. Pay in USDT, instant delivery.",
    url: SITE_URL + "/",
  },
};

const FAQ_JSONLD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "How does X-VAULT protect my purchase?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Your USDT is held securely when you pay. Funds are only released to the seller after you confirm the digital goods were delivered as described. If anything goes wrong you can open a dispute and our team reviews it within 24 hours.",
      },
    },
    {
      "@type": "Question",
      name: "How fast is delivery?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Stocked listings deliver instantly — codes, accounts and keys are released the moment payment is confirmed. Manual delivery items show an expected delivery window on the listing.",
      },
    },
  ],
};

// Homepage data changes slowly and is shared by all visitors; revalidate on the
// server every 30s. Public content renders as RSC — zero client JS for the data.
export const revalidate = 30;

export default async function HomePage() {
  const data = await getHomePageData();

  return (
    <PublicShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_JSONLD) }}
      />

      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl border border-border bg-card p-6 sm:p-10 mb-8">
        <div className="relative space-y-5 max-w-2xl">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold tracking-widest text-primary bg-primary/10 border border-primary/30 rounded-full px-2.5 py-1">
            <ShieldCheck className="size-3" /> BUYER PROTECTED · USDT
          </span>
          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl leading-[0.95]">
            Buy &amp; sell digital goods, safely
          </h1>
          <p className="text-sm text-muted-foreground max-w-md">
            Game currency, gift cards, keys, accounts &amp; subscriptions — released to sellers only
            after your warranty clears.
          </p>
          <div className="pt-1 max-w-xl">
            <SearchBox variant="hero" />
          </div>
          {data.trendingSearches.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
              <span className="text-muted-foreground tracking-widest font-bold">TRENDING:</span>
              {data.trendingSearches.slice(0, 6).map((s) => (
                <Link
                  key={s.query}
                  href={`/browse?q=${encodeURIComponent(s.query)}`}
                  className="px-2 py-1 rounded-full bg-secondary/70 border border-border capitalize hover:border-primary/40 hover:text-primary"
                >
                  {s.query}
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Categories */}
      {data.categories.length > 0 && (
        <section className="mb-10">
          <SectionHeader label="EXPLORE" title="Categories" />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {data.categories.map((c) => (
              <Link
                key={c.id}
                href={`/browse?category=${c.slug}`}
                className="group rounded-xl border border-border bg-card p-4 hover:border-primary/50 transition-colors min-h-[110px] flex flex-col justify-between"
              >
                <span className="text-3xl">{c.icon}</span>
                <div>
                  <p className="text-sm font-bold leading-tight">{c.name}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-0.5">
                    {c.product_count > 0
                      ? `${c.product_count.toLocaleString()} listings`
                      : "Browse"}
                    <ArrowUpRight className="size-2.5" />
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Trending */}
      {data.trending.length > 0 && (
        <section className="mb-10">
          <SectionHeader
            label="HOT RIGHT NOW"
            title="Trending offers"
            href="/browse"
            hrefLabel="View all"
          />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {data.trending.map((p, i) => (
              <ProductCard key={p.id} product={p} priority={i < 4} />
            ))}
          </div>
        </section>
      )}

      {/* Fresh listings */}
      {data.newest.length > 0 && (
        <section className="mb-10">
          <SectionHeader label="JUST DROPPED" title="Fresh listings" />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {data.newest.slice(0, 4).map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      {/* Top sellers + recent sales */}
      <section className="mb-10 grid lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 bg-card border border-border rounded-2xl p-5">
          <SectionHeader label="LEADERBOARD" title="Top sellers" />
          <div className="space-y-1.5 mt-3">
            {data.topSellers.map((s, i) => (
              <Link
                key={s.id}
                href={`/s/${s.username}`}
                className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-secondary/60 transition-colors"
              >
                <span className="font-display text-xl w-7 text-center text-muted-foreground">
                  {i + 1}
                </span>
                <div className="size-10 rounded-xl bg-primary/15 border border-primary/40 grid place-items-center text-xs font-bold text-primary uppercase">
                  {s.username.slice(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate">{s.username}</p>
                  <p className="text-[11px] text-muted-foreground">
                    Lvl {s.seller_level} · {s.total_sales.toLocaleString()} sales
                  </p>
                </div>
                <span className="text-[11px] text-yellow-400 flex items-center gap-0.5 font-bold">
                  <Star className="size-3 fill-current" />
                  {s.rating > 0 ? s.rating.toFixed(1) : "—"}
                </span>
              </Link>
            ))}
            {data.topSellers.length === 0 && (
              <p className="text-xs text-muted-foreground">No sellers yet — be the first.</p>
            )}
          </div>
        </div>
        <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-5">
          <SectionHeader label="LIVE" title="Recent sales" />
          <div className="space-y-2.5 mt-3">
            {data.recentSales.length === 0 && (
              <p className="text-xs text-muted-foreground">No sales yet — be the first!</p>
            )}
            {data.recentSales.slice(0, 6).map((s, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <span className="size-1.5 rounded-full bg-accent mt-1.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="leading-tight truncate">
                    <b>{s.buyer}</b> <span className="text-muted-foreground">bought</span>{" "}
                    {s.product_title}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {timeAgo(s.created_at)} ·{" "}
                    <span className="text-accent font-mono">{usdtShort(s.total_cents)}</span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust */}
      <section className="mb-10">
        <SectionHeader label="WHY X-VAULT" title="Built for trust" />
        <div className="grid sm:grid-cols-3 gap-3">
          {[
            {
              icon: ShieldCheck,
              t: "Buyer Protection",
              d: "Funds release only after your warranty clears.",
            },
            {
              icon: Zap,
              t: "Instant Delivery",
              d: "Auto-delivered codes the second payment confirms.",
            },
            {
              icon: Headphones,
              t: "Dispute Team",
              d: "Open a dispute anytime during warranty — we mediate.",
            },
          ].map((x) => (
            <div key={x.t} className="bg-card border border-border rounded-2xl p-5">
              <div
                className="size-10 rounded-xl grid place-items-center text-primary-foreground mb-4"
                style={{ background: "var(--gradient-primary)" }}
              >
                <x.icon className="size-5" />
              </div>
              <p className="font-bold text-sm">{x.t}</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{x.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mb-2">
        <div
          className="rounded-2xl border border-border p-8 sm:p-10 text-center"
          style={{ background: "var(--gradient-primary)" }}
        >
          <h2 className="font-display text-3xl sm:text-4xl text-primary-foreground">
            Ready to sell?
          </h2>
          <p className="text-sm text-primary-foreground/85 max-w-md mx-auto mt-3">
            List your digital goods, get paid in USDT, ship from anywhere.
          </p>
          <Link
            href="/sell"
            className="inline-block mt-4 bg-background text-foreground text-xs font-bold tracking-widest px-5 py-3 rounded-lg hover:bg-card"
          >
            BECOME A SELLER
          </Link>
        </div>
      </section>
    </PublicShell>
  );
}

function SectionHeader({
  label,
  title,
  href,
  hrefLabel,
}: {
  label: string;
  title: string;
  href?: string;
  hrefLabel?: string;
}) {
  return (
    <div className="flex items-end justify-between gap-2 mb-3">
      <div>
        <p className="text-[10px] font-bold tracking-widest text-muted-foreground">{label}</p>
        <h2 className="font-display text-2xl sm:text-3xl leading-tight mt-0.5">{title}</h2>
      </div>
      {href && hrefLabel && (
        <Link href={href} className="text-xs font-bold text-primary hover:underline shrink-0">
          {hrefLabel} →
        </Link>
      )}
    </div>
  );
}
