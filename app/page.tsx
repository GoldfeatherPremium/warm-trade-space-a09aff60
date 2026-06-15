import type { Metadata } from "next";
import Link from "next/link";
import {
  ShieldCheck,
  Zap,
  Headphones,
  Star,
  ArrowRight,
  Users,
  Clock,
  ChevronRight,
} from "lucide-react";
import { getHomePageData } from "@/server/queries/catalog";
import { usdtShort, timeAgo } from "@/lib/format";
import { PublicShell } from "./_components/site-shell";
import { SearchBox } from "./_components/search-box";
import { ProductCard } from "./_components/product-card";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  title: { absolute: "X-VAULT — Buy & Sell Digital Goods with USDT" },
  description:
    "The trusted digital goods marketplace. Game currency, gift cards, keys, accounts and boosting — buyer-protected, paid in USDT, instant delivery.",
  alternates: { canonical: "/" },
  openGraph: {
    title: { absolute: "X-VAULT — Buy & Sell Digital Goods with USDT" },
    description: "Buyer-protected digital marketplace. Pay in USDT, instant delivery.",
    url: SITE_URL + "/",
    images: [{ url: `${SITE_URL}/assets/og-default.jpg`, width: 1200, height: 630 }],
  },
  twitter: { card: "summary_large_image" },
};

const ORG_JSONLD = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "X-VAULT",
  url: SITE_URL,
  logo: `${SITE_URL}/assets/og-default.jpg`,
  sameAs: [],
};

const WEBSITE_JSONLD = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "X-VAULT",
  url: SITE_URL,
  potentialAction: {
    "@type": "SearchAction",
    target: { "@type": "EntryPoint", urlTemplate: `${SITE_URL}/browse?q={search_term_string}` },
    "query-input": "required name=search_term_string",
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

export const revalidate = 30;

// Category gradient palettes — cycles through for visual variety
const CAT_GRADIENTS = [
  "from-violet-500/20 to-purple-600/10",
  "from-emerald-500/20 to-teal-600/10",
  "from-blue-500/20 to-cyan-600/10",
  "from-rose-500/20 to-pink-600/10",
  "from-amber-500/20 to-orange-600/10",
  "from-fuchsia-500/20 to-purple-600/10",
  "from-sky-500/20 to-blue-600/10",
  "from-lime-500/20 to-green-600/10",
  "from-red-500/20 to-rose-600/10",
  "from-indigo-500/20 to-violet-600/10",
  "from-teal-500/20 to-cyan-600/10",
  "from-orange-500/20 to-amber-600/10",
];

export default async function HomePage() {
  const data = await getHomePageData();

  return (
    <PublicShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ORG_JSONLD) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(WEBSITE_JSONLD) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_JSONLD) }}
      />

      {/* ── HERO ─────────────────────────────────────────────────── */}
      {/* Background applied directly on section — no absolute child avoids z-index stacking issues */}
      <section
        className="rounded-2xl overflow-hidden mb-8 border border-border/60"
        style={{ background: "var(--gradient-hero)" }}
      >
        <div className="px-6 py-10 sm:px-12 sm:py-14">
          {/* Trust badges */}
          <div className="flex flex-wrap items-center gap-2 mb-5">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold tracking-widest text-primary bg-primary/10 border border-primary/25 rounded-full px-3 py-1">
              <ShieldCheck className="size-3" /> BUYER PROTECTED
            </span>
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold tracking-widest text-accent bg-accent/10 border border-accent/25 rounded-full px-3 py-1">
              <Zap className="size-3" /> USDT PAYMENTS
            </span>
          </div>

          {/* Headline */}
          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl leading-[0.95] mb-4 max-w-2xl">
            The Trusted Digital Goods Marketplace
          </h1>
          <p className="text-sm text-muted-foreground max-w-lg mb-6 leading-relaxed">
            Game currency, gift cards, keys, accounts &amp; subscriptions. Funds held in escrow and
            released only after delivery — backed by our dispute team.
          </p>

          {/* Search */}
          <div className="max-w-2xl mb-5">
            <SearchBox variant="hero" />
          </div>

          {/* Trending searches */}
          {data.trendingSearches.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <span className="text-muted-foreground font-medium">Trending:</span>
              {data.trendingSearches.slice(0, 6).map((s) => (
                <Link
                  key={s.query}
                  href={`/browse?q=${encodeURIComponent(s.query)}`}
                  className="px-2.5 py-1 rounded-full bg-card/60 border border-border/60 capitalize hover:border-primary/50 hover:text-primary transition-colors"
                >
                  {s.query}
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Stats bar */}
        <div className="border-t border-border/40 bg-card/30 px-6 sm:px-12 py-3 flex flex-wrap gap-x-8 gap-y-2">
          {[
            { icon: ShieldCheck, label: "Buyer Protected", value: "Every order" },
            { icon: Zap, label: "Instant Delivery", value: "Auto orders" },
            { icon: Users, label: "Verified Sellers", value: "All vetted" },
            { icon: Clock, label: "Dispute Response", value: "Under 24h" },
          ].map((s) => (
            <div key={s.label} className="flex items-center gap-2">
              <s.icon className="size-3.5 text-primary shrink-0" />
              <span className="text-xs text-muted-foreground">
                <span className="text-foreground font-medium">{s.value}</span> · {s.label}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ── CATEGORIES ───────────────────────────────────────────── */}
      {data.categories.length > 0 && (
        <section className="mb-10">
          <SectionHeader
            label="EXPLORE"
            title="Shop by category"
            href="/browse"
            hrefLabel="All categories"
          />
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2.5">
            {data.categories.map((c, i) => (
              <Link
                key={c.id}
                href={`/browse?category=${c.slug}`}
                className={`group rounded-xl border border-border/60 bg-gradient-to-br ${CAT_GRADIENTS[i % CAT_GRADIENTS.length]} p-4 hover:border-primary/40 transition-all card-hover text-center flex flex-col items-center gap-2`}
              >
                <span className="text-3xl">{c.icon}</span>
                <div>
                  <p className="text-xs font-semibold leading-tight">{c.name}</p>
                  {c.product_count > 0 && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {c.product_count.toLocaleString()} listings
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── TRENDING ─────────────────────────────────────────────── */}
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

      {/* ── FRESH LISTINGS ───────────────────────────────────────── */}
      {data.newest.length > 0 && (
        <section className="mb-10">
          <SectionHeader
            label="JUST DROPPED"
            title="Fresh listings"
            href="/browse?sort=newest"
            hrefLabel="See more"
          />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {data.newest.slice(0, 4).map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      {/* ── HOW IT WORKS ─────────────────────────────────────────── */}
      <section className="mb-10">
        <SectionHeader label="SIMPLE PROCESS" title="How it works" />
        <div className="grid sm:grid-cols-3 gap-3">
          {[
            {
              step: "01",
              icon: "🔍",
              title: "Find & buy",
              desc: "Browse thousands of verified listings. Pay securely in USDT — funds held in escrow.",
            },
            {
              step: "02",
              icon: "⚡",
              title: "Instant delivery",
              desc: "Auto-delivery orders ship the second payment confirms. Manual sellers deliver within the listed window.",
            },
            {
              step: "03",
              icon: "✅",
              title: "Confirm & release",
              desc: "Happy with your order? Confirm delivery and release payment to the seller. Your warranty protects you throughout.",
            },
          ].map((s) => (
            <div
              key={s.step}
              className="relative bg-card border border-border/60 rounded-xl p-5 overflow-hidden"
            >
              <span className="absolute top-3 right-4 font-display text-5xl text-border/40 leading-none select-none">
                {s.step}
              </span>
              <div className="text-3xl mb-3">{s.icon}</div>
              <p className="font-semibold text-sm mb-1.5">{s.title}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── TOP SELLERS + LIVE SALES ─────────────────────────────── */}
      <section className="mb-10 grid lg:grid-cols-5 gap-4">
        {/* Leaderboard */}
        <div className="lg:col-span-3 bg-card border border-border/60 rounded-xl p-5">
          <SectionHeader
            label="LEADERBOARD"
            title="Top sellers"
            href="/sellers"
            hrefLabel="All sellers"
          />
          <div className="divide-y divide-border/40 mt-2">
            {data.topSellers.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4">No sellers yet — be the first.</p>
            ) : (
              data.topSellers.map((s, i) => (
                <Link
                  key={s.id}
                  href={`/s/${s.username}`}
                  className="flex items-center gap-3 py-3 hover:bg-secondary/30 -mx-2 px-2 rounded-lg transition-colors"
                >
                  <span
                    className={`font-display text-lg w-6 text-center shrink-0 ${i === 0 ? "text-amber-500" : i === 1 ? "text-slate-400" : i === 2 ? "text-amber-700" : "text-muted-foreground/50"}`}
                  >
                    {i + 1}
                  </span>
                  <div className="size-9 rounded-lg bg-primary/15 border border-primary/30 grid place-items-center text-xs font-bold text-primary uppercase shrink-0">
                    {s.username.slice(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{s.username}</p>
                    <p className="text-[10px] text-muted-foreground">
                      Lvl {s.seller_level} · {s.total_sales.toLocaleString()} sales
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="flex items-center gap-0.5 text-amber-500 text-xs font-semibold justify-end">
                      <Star className="size-3 fill-current" />
                      {s.rating > 0 ? s.rating.toFixed(1) : "—"}
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Live feed */}
        <div className="lg:col-span-2 bg-card border border-border/60 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="size-2 rounded-full bg-primary live-dot shrink-0" />
            <div>
              <p className="text-[10px] font-bold tracking-widest text-muted-foreground">LIVE</p>
              <h2 className="font-display text-xl leading-tight">Recent sales</h2>
            </div>
          </div>
          <div className="space-y-3">
            {data.recentSales.length === 0 ? (
              <p className="text-xs text-muted-foreground">No sales yet — be the first!</p>
            ) : (
              data.recentSales.slice(0, 7).map((s, i) => (
                <div key={i} className="flex items-start gap-2.5 text-xs">
                  <div className="size-6 rounded-md bg-secondary border border-border grid place-items-center shrink-0 mt-0.5 text-[10px] font-bold text-muted-foreground uppercase">
                    {s.buyer.slice(0, 1)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="leading-snug">
                      <span className="font-semibold">{s.buyer}</span>{" "}
                      <span className="text-muted-foreground">purchased</span>{" "}
                      <span className="truncate">{s.product_title}</span>
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                      {timeAgo(s.created_at)}
                      <span className="text-accent font-mono font-medium">
                        · {usdtShort(s.total_cents)}
                      </span>
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* ── TRUST FEATURES ───────────────────────────────────────── */}
      <section className="mb-10">
        <SectionHeader label="WHY X-VAULT" title="Built for trust" />
        <div className="grid sm:grid-cols-3 gap-3">
          {[
            {
              icon: ShieldCheck,
              color: "text-primary",
              bg: "bg-primary/10 border-primary/20",
              title: "Buyer Protection",
              desc: "Every order is backed by escrow. Funds release only after you confirm delivery.",
            },
            {
              icon: Zap,
              color: "text-amber-600",
              bg: "bg-amber-500/10 border-amber-500/20",
              title: "Instant Delivery",
              desc: "Stocked items deliver the second your payment confirms — no waiting around.",
            },
            {
              icon: Headphones,
              color: "text-blue-600",
              bg: "bg-blue-500/10 border-blue-500/20",
              title: "24h Dispute Team",
              desc: "Open a dispute any time during your warranty. Our team reviews within 24 hours.",
            },
          ].map((x) => (
            <div key={x.title} className="bg-card border border-border/60 rounded-xl p-5">
              <div className={`size-10 rounded-xl border grid place-items-center mb-4 ${x.bg}`}>
                <x.icon className={`size-5 ${x.color}`} />
              </div>
              <p className="font-semibold text-sm mb-1.5">{x.title}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{x.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── SELLER CTA ───────────────────────────────────────────── */}
      <section className="mb-2">
        <div
          className="relative rounded-xl overflow-hidden border border-primary/20 p-8 sm:p-10"
          style={{ background: "var(--gradient-primary)" }}
        >
          <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center gap-6">
            <div className="flex-1">
              <p className="text-[10px] font-bold tracking-widest text-primary-foreground/70 mb-2">
                FOR SELLERS
              </p>
              <h2 className="font-display text-3xl sm:text-4xl text-primary-foreground leading-tight">
                Start selling today
              </h2>
              <p className="text-sm text-primary-foreground/80 mt-2 max-w-md">
                List your digital goods, get paid in USDT, ship from anywhere. Low fees, instant
                payouts, global buyers.
              </p>
            </div>
            <div className="flex flex-col sm:items-end gap-3 shrink-0">
              <Link
                href="/sell"
                className="inline-flex items-center gap-2 bg-background text-foreground text-xs font-bold tracking-widest px-6 py-3 rounded-lg hover:bg-card transition-colors"
              >
                BECOME A SELLER <ArrowRight className="size-3.5" />
              </Link>
              <Link
                href="/legal/fees"
                className="text-xs text-primary-foreground/70 hover:text-primary-foreground transition-colors flex items-center gap-1"
              >
                See fee schedule <ChevronRight className="size-3" />
              </Link>
            </div>
          </div>
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
    <div className="flex items-end justify-between gap-2 mb-4">
      <div>
        <p className="text-[10px] font-bold tracking-widest text-primary mb-0.5">{label}</p>
        <h2 className="font-display text-2xl sm:text-3xl leading-tight">{title}</h2>
      </div>
      {href && hrefLabel && (
        <Link
          href={href}
          className="text-xs font-medium text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors shrink-0"
        >
          {hrefLabel} <ArrowRight className="size-3" />
        </Link>
      )}
    </div>
  );
}
