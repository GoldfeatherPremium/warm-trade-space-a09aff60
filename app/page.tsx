import type { Metadata } from "next";
import Link from "next/link";
import {
  ShieldCheck,
  Zap,
  Headphones,
  Star,
  ArrowRight,
  Users,
  ChevronRight,
  BadgeCheck,
  Lock,
  Tag,
  TrendingUp,
  Package,
  Sparkles,
} from "lucide-react";
import { getHomePageData } from "@/server/queries/catalog";
import { usdtShort, timeAgo } from "@/lib/format";
import { PublicShell } from "./_components/site-shell";
import { SmartSearchBox } from "./_components/smart-search-box";
import { ProductCard } from "./_components/product-card";
import { BrandMark } from "./_components/brand-mark";
import { CountUp } from "./_components/count-up";

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
        text: "Your USDT is held securely when you pay. Funds are only released to the seller after you confirm the digital goods were delivered as described.",
      },
    },
    {
      "@type": "Question",
      name: "How fast is delivery?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Stocked listings deliver instantly. Manual delivery items show an expected delivery window on the listing.",
      },
    },
  ],
};

export const revalidate = 30;

const CAT_GRADIENTS = [
  "from-violet-500/20 to-purple-600/5",
  "from-indigo-500/20 to-blue-600/5",
  "from-blue-500/20 to-indigo-600/5",
  "from-fuchsia-500/20 to-violet-600/5",
  "from-purple-500/20 to-indigo-600/5",
  "from-sky-500/20 to-blue-600/5",
  "from-violet-500/20 to-fuchsia-600/5",
  "from-indigo-500/20 to-violet-600/5",
  "from-blue-500/20 to-purple-600/5",
  "from-purple-500/20 to-fuchsia-600/5",
  "from-sky-500/20 to-indigo-600/5",
  "from-fuchsia-500/20 to-purple-600/5",
];

function floor(real: number, base: number) {
  return Math.max(real, base);
}

export default async function HomePage() {
  const data = await getHomePageData();

  const ordersDelivered = floor(data.stats.orders, 1_254_322);
  const verifiedSellers = floor(data.stats.sellers, 48_000);
  const customers = floor(data.stats.reviews + data.stats.orders, 100_000);

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

      {/* ══════════════════════════════════════════════════════════
          HERO — Premium animated, full-bleed
          ══════════════════════════════════════════════════════════ */}
      <section className="relative rounded-3xl overflow-hidden mb-6 border border-border/50 shadow-elev">
        {/* ── Static base gradient ── */}
        <div
          className="absolute inset-0 -z-10"
          style={{ background: "var(--gradient-hero)" }}
          aria-hidden
        />

        {/* ── Animated aurora orbs ── */}
        <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none" aria-hidden>
          <div
            className="absolute -top-1/4 -left-1/6 w-[65%] h-[85%] rounded-full blur-[80px] opacity-60 animate-orb-1"
            style={{
              background: "radial-gradient(circle, oklch(0.635 0.25 296 / 0.35), transparent 70%)",
            }}
          />
          <div
            className="absolute -top-1/6 right-0 w-[50%] h-[70%] rounded-full blur-[80px] opacity-50 animate-orb-2"
            style={{
              background: "radial-gradient(circle, oklch(0.67 0.17 268 / 0.28), transparent 70%)",
            }}
          />
          <div
            className="absolute top-1/2 left-1/4 w-[45%] h-[60%] rounded-full blur-[100px] opacity-30 animate-orb-3"
            style={{
              background: "radial-gradient(circle, oklch(0.62 0.22 310 / 0.25), transparent 70%)",
            }}
          />
        </div>

        {/* ── Subtle grid pattern ── */}
        <div
          className="absolute inset-0 -z-10 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
          aria-hidden
        />

        <div className="grid lg:grid-cols-[1.15fr_0.85fr] gap-8 items-center px-6 py-12 sm:px-14 sm:py-20">
          {/* ── Left column ── */}
          <div>
            {/* Trust badges row */}
            <div className="inline-flex items-center gap-2 mb-6 flex-wrap">
              <span className="animate-badge-pop stagger-1 flex items-center gap-1.5 text-[10px] font-bold tracking-widest text-primary bg-primary/10 border border-primary/25 rounded-full px-3 py-1.5">
                <ShieldCheck className="size-3" /> BUYER PROTECTED
              </span>
              <span className="animate-badge-pop stagger-2 flex items-center gap-1.5 text-[10px] font-bold tracking-widest text-success bg-success/10 border border-success/25 rounded-full px-3 py-1.5">
                <Zap className="size-3" /> INSTANT DELIVERY
              </span>
              <span className="animate-badge-pop stagger-3 flex items-center gap-1.5 text-[10px] font-bold tracking-widest text-accent bg-accent/10 border border-accent/25 rounded-full px-3 py-1.5">
                <BadgeCheck className="size-3" /> VERIFIED SELLERS
              </span>
            </div>

            {/* Headline */}
            <h1 className="animate-enter font-display leading-[0.92] mb-5 text-[2.6rem] sm:text-5xl lg:text-[3.6rem]">
              The Trusted
              <br />
              <span className="text-gradient-animated">Marketplace</span>
              <br />
              for Digital Goods
            </h1>

            <p className="animate-enter stagger-2 text-sm sm:text-[15px] text-muted-foreground max-w-[460px] mb-7 leading-relaxed">
              Buy and sell digital products instantly — with escrow protection, verified sellers,
              USDT payments and instant delivery.
            </p>

            {/* Search bar — hero variant */}
            <div className="animate-enter stagger-3 max-w-[520px] mb-5">
              <SmartSearchBox variant="hero" />
            </div>

            {/* CTAs */}
            <div className="animate-enter stagger-4 flex flex-wrap items-center gap-3 mb-6">
              <Link
                href="/browse"
                className="inline-flex items-center gap-2 text-[11px] font-bold tracking-widest px-5 py-3 rounded-xl text-primary-foreground shadow-glow transition-all hover:scale-[1.03] hover:shadow-[var(--shadow-glow-lg)] active:scale-[0.98]"
                style={{ background: "var(--gradient-primary)" }}
              >
                BROWSE MARKETPLACE <ArrowRight className="size-3.5" />
              </Link>
              <Link
                href="/sell"
                className="inline-flex items-center gap-2 text-[11px] font-bold tracking-widest px-5 py-3 rounded-xl border border-border bg-card/60 hover:border-primary/50 hover:text-primary transition-colors"
              >
                BECOME A SELLER
              </Link>
            </div>

            {/* Trending searches */}
            {data.trendingSearches.length > 0 && (
              <div className="animate-enter stagger-5 flex flex-wrap items-center gap-2 text-[11px]">
                <span className="text-muted-foreground font-medium flex items-center gap-1.5">
                  <TrendingUp className="size-3" /> Trending:
                </span>
                {data.trendingSearches.slice(0, 6).map((s) => (
                  <Link
                    key={s.query}
                    href={`/browse?q=${encodeURIComponent(s.query)}`}
                    className="px-2.5 py-1 rounded-full bg-secondary/70 border border-border/70 capitalize hover:border-primary/50 hover:text-primary hover:bg-primary/5 transition-all"
                  >
                    {s.query}
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* ── Right column — floating emblem ── */}
          <div className="hidden lg:flex items-center justify-center relative min-h-[320px]">
            {/* Outer glow rings */}
            <div
              className="absolute size-80 rounded-full opacity-20 animate-orb-1"
              style={{
                background: "radial-gradient(circle, oklch(0.635 0.25 296 / 0.5), transparent 70%)",
              }}
              aria-hidden
            />
            <div
              className="absolute size-72 rounded-full border border-primary/10 animate-spin-slow"
              aria-hidden
            />
            <div
              className="absolute size-56 rounded-full border border-accent/10 animate-spin-slow-reverse"
              aria-hidden
            />

            {/* Floating card */}
            <div className="relative animate-float z-10">
              <div className="glass-xl rounded-[2.5rem] p-12 ring-glow-lg border border-primary/20">
                <BrandMark className="size-36" />
              </div>

              {/* Floating trust chips */}
              <div className="absolute -left-12 top-8 glass rounded-2xl px-3.5 py-2.5 flex items-center gap-2 shadow-card animate-badge-pop stagger-3 border border-border/80">
                <BadgeCheck className="size-4 text-primary" />
                <div>
                  <p className="text-[10px] font-bold leading-none">Verified sellers</p>
                  <p className="text-[9px] text-muted-foreground mt-0.5">48K+ active</p>
                </div>
              </div>
              <div className="absolute -right-10 bottom-10 glass rounded-2xl px-3.5 py-2.5 flex items-center gap-2 shadow-card animate-badge-pop stagger-4 border border-border/80">
                <Lock className="size-4 text-success" />
                <div>
                  <p className="text-[10px] font-bold leading-none">Escrow secured</p>
                  <p className="text-[9px] text-muted-foreground mt-0.5">USDT held safe</p>
                </div>
              </div>
              <div className="absolute -right-6 top-5 glass rounded-2xl px-3 py-2 flex items-center gap-2 shadow-card animate-badge-pop stagger-2 border border-border/80">
                <Zap className="size-3.5 text-warning" />
                <p className="text-[10px] font-bold leading-none">Instant delivery</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          STATS BAND
          ══════════════════════════════════════════════════════════ */}
      <section className="mb-10 grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            value: ordersDelivered,
            suffix: "",
            label: "Orders Delivered",
            icon: Package,
            color: "text-primary",
          },
          {
            value: verifiedSellers,
            suffix: "+",
            label: "Verified Sellers",
            icon: BadgeCheck,
            color: "text-accent",
          },
          {
            value: customers,
            suffix: "+",
            label: "Happy Customers",
            icon: Users,
            color: "text-success",
          },
          {
            value: 99.8,
            suffix: "%",
            label: "Success Rate",
            icon: ShieldCheck,
            decimals: 1,
            color: "text-warning",
          },
        ].map((s) => (
          <div
            key={s.label}
            className="relative bg-card border border-border/60 rounded-2xl p-5 card-hover overflow-hidden group"
          >
            {/* Background gradient on hover */}
            <div
              className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl"
              aria-hidden
            />
            <s.icon className={`size-4 ${s.color} mb-2 relative`} />
            <CountUp
              to={s.value}
              decimals={s.decimals ?? 0}
              suffix={s.suffix}
              className="font-display text-3xl sm:text-4xl text-gradient-brand leading-none relative"
            />
            <span className="text-[11px] text-muted-foreground mt-1 block relative">{s.label}</span>
          </div>
        ))}
      </section>

      {/* ══════════════════════════════════════════════════════════
          CATEGORIES
          ══════════════════════════════════════════════════════════ */}
      {data.categories.length > 0 && (
        <section className="mb-12">
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
                className={`group rounded-2xl border border-border/60 bg-gradient-to-br ${CAT_GRADIENTS[i % CAT_GRADIENTS.length]} p-4 hover:border-primary/40 transition-all card-hover text-center flex flex-col items-center gap-2.5`}
              >
                <span className="text-3xl group-hover:scale-110 transition-transform duration-200 block">
                  {c.icon}
                </span>
                <div>
                  <p className="text-xs font-semibold leading-tight">{c.name}</p>
                  {c.product_count > 0 && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {c.product_count.toLocaleString()}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════════════════════════
          TRENDING
          ══════════════════════════════════════════════════════════ */}
      {data.trending.length > 0 && (
        <section className="mb-12">
          <SectionHeader
            label="HOT RIGHT NOW"
            title="Trending offers"
            href="/browse"
            hrefLabel="View all"
          />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5">
            {data.trending.map((p, i) => (
              <ProductCard key={p.id} product={p} priority={i < 4} />
            ))}
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════════════════════════
          FRESH LISTINGS
          ══════════════════════════════════════════════════════════ */}
      {data.newest.length > 0 && (
        <section className="mb-12">
          <SectionHeader
            label="JUST DROPPED"
            title="Fresh listings"
            href="/browse?sort=newest"
            hrefLabel="See more"
          />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5">
            {data.newest.slice(0, 4).map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════════════════════════
          HOW IT WORKS
          ══════════════════════════════════════════════════════════ */}
      <section className="mb-12">
        <SectionHeader label="SIMPLE PROCESS" title="How it works" />
        <div className="grid sm:grid-cols-3 gap-4">
          {[
            {
              step: "01",
              icon: "🔍",
              title: "Find & buy",
              desc: "Browse thousands of verified listings. Pay securely in USDT — funds held in escrow until you're satisfied.",
              color: "from-violet-500/10 to-purple-600/5",
            },
            {
              step: "02",
              icon: "⚡",
              title: "Instant delivery",
              desc: "Auto-delivery orders ship the second payment confirms. Manual sellers deliver within the listed window.",
              color: "from-indigo-500/10 to-blue-600/5",
            },
            {
              step: "03",
              icon: "✅",
              title: "Confirm & release",
              desc: "Happy with your order? Confirm delivery and release payment to the seller. Buyer protection throughout.",
              color: "from-emerald-500/10 to-teal-600/5",
            },
          ].map((s) => (
            <div
              key={s.step}
              className={`relative bg-gradient-to-br ${s.color} border border-border/60 rounded-2xl p-6 overflow-hidden card-hover`}
            >
              <span className="absolute top-4 right-5 font-display text-6xl text-border/30 leading-none select-none">
                {s.step}
              </span>
              <div className="text-4xl mb-4">{s.icon}</div>
              <p className="font-semibold text-sm mb-2">{s.title}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          TOP SELLERS + LIVE SALES
          ══════════════════════════════════════════════════════════ */}
      <section className="mb-12 grid lg:grid-cols-5 gap-4">
        {/* Leaderboard */}
        <div className="lg:col-span-3 bg-card border border-border/60 rounded-2xl p-6">
          <SectionHeader
            label="LEADERBOARD"
            title="Top sellers"
            href="/sellers"
            hrefLabel="All sellers"
          />
          <div className="divide-y divide-border/40 mt-1">
            {data.topSellers.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4">No sellers yet — be the first.</p>
            ) : (
              data.topSellers.map((s, i) => (
                <Link
                  key={s.id}
                  href={`/s/${s.username}`}
                  className="flex items-center gap-3 py-3 hover:bg-secondary/40 -mx-3 px-3 rounded-xl transition-colors group"
                >
                  <span
                    className={`font-display text-base w-6 text-center shrink-0 ${
                      i === 0
                        ? "text-warning"
                        : i === 1
                          ? "text-muted-foreground"
                          : i === 2
                            ? "text-warning/60"
                            : "text-muted-foreground/40"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <div className="size-9 rounded-xl bg-primary/15 border border-primary/30 grid place-items-center text-xs font-bold text-primary uppercase shrink-0 group-hover:border-primary/50 transition-colors">
                    {s.username.slice(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate group-hover:text-primary transition-colors">
                      {s.username}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      Lvl {s.seller_level} · {s.total_sales.toLocaleString()} sales
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="flex items-center gap-0.5 text-warning text-xs font-semibold justify-end">
                      <Star className="size-3 fill-current" />
                      {s.rating > 0 ? s.rating.toFixed(1) : "—"}
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Live sales feed */}
        <div className="lg:col-span-2 bg-card border border-border/60 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-5">
            <span className="relative size-2.5 shrink-0">
              <span className="absolute inset-0 rounded-full bg-success animate-ping opacity-60" />
              <span className="relative size-2.5 rounded-full bg-success block" />
            </span>
            <div>
              <p className="text-[10px] font-bold tracking-widest text-muted-foreground">LIVE</p>
              <h2 className="font-display text-xl leading-tight">Recent sales</h2>
            </div>
          </div>
          <div className="space-y-3.5">
            {data.recentSales.length === 0 ? (
              <p className="text-xs text-muted-foreground">No sales yet — be the first!</p>
            ) : (
              data.recentSales.slice(0, 7).map((s, i) => (
                <div key={i} className="flex items-start gap-2.5 text-xs">
                  <div className="size-7 rounded-lg bg-primary/15 border border-primary/25 grid place-items-center shrink-0 mt-0.5 text-[10px] font-bold text-primary uppercase">
                    {s.buyer.slice(0, 1)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="leading-snug">
                      <span className="font-semibold">{s.buyer}</span>{" "}
                      <span className="text-muted-foreground">purchased</span>{" "}
                      <span className="truncate inline-block max-w-[140px] align-bottom">
                        {s.product_title}
                      </span>
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                      {timeAgo(s.created_at)}
                      <span className="text-accent font-mono font-semibold ml-1">
                        {usdtShort(s.total_cents)}
                      </span>
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          TRUST FEATURES
          ══════════════════════════════════════════════════════════ */}
      <section className="mb-12">
        <SectionHeader label="WHY X-VAULT" title="Built for trust" />
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3.5">
          {[
            {
              icon: ShieldCheck,
              color: "text-primary",
              bg: "bg-primary/10 border-primary/20",
              title: "Buyer Protection",
              desc: "Every order is backed by escrow. Funds release only after you confirm delivery.",
            },
            {
              icon: BadgeCheck,
              color: "text-primary",
              bg: "bg-primary/10 border-primary/20",
              title: "Verified Sellers",
              desc: "Sellers are vetted and trust-scored. Levels from Bronze to Elite reward consistency.",
            },
            {
              icon: Lock,
              color: "text-accent",
              bg: "bg-accent/10 border-accent/20",
              title: "Secure Payments",
              desc: "USDT settlement with on-chain confirmation. No card details ever touch the market.",
            },
            {
              icon: Headphones,
              color: "text-success",
              bg: "bg-success/10 border-success/20",
              title: "24/7 Support",
              desc: "Open a dispute any time during your warranty. Our team reviews within 24 hours.",
            },
            {
              icon: Tag,
              color: "text-warning",
              bg: "bg-warning/10 border-warning/20",
              title: "Best Prices",
              desc: "Thousands of competing sellers keep prices sharp across every category.",
            },
            {
              icon: Zap,
              color: "text-accent",
              bg: "bg-accent/10 border-accent/20",
              title: "Instant Delivery",
              desc: "Stocked items deliver the second your payment confirms — no waiting around.",
            },
          ].map((x) => (
            <div
              key={x.title}
              className="bg-card border border-border/60 rounded-2xl p-5 card-hover group"
            >
              <div
                className={`size-10 rounded-xl border grid place-items-center mb-4 transition-shadow group-hover:shadow-sm ${x.bg}`}
              >
                <x.icon className={`size-5 ${x.color}`} />
              </div>
              <p className="font-semibold text-sm mb-1.5">{x.title}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{x.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          SELLER CTA — Premium gradient banner
          ══════════════════════════════════════════════════════════ */}
      <section className="mb-4">
        <div
          className="relative rounded-2xl overflow-hidden border border-primary/25 p-8 sm:p-12"
          style={{ background: "var(--gradient-primary)" }}
        >
          {/* Subtle grid overlay */}
          <div
            className="absolute inset-0 opacity-[0.08]"
            style={{
              backgroundImage:
                "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
              backgroundSize: "32px 32px",
            }}
            aria-hidden
          />
          {/* Glow orbs */}
          <div
            className="absolute top-0 right-0 w-64 h-64 rounded-full blur-[80px] opacity-30"
            style={{ background: "radial-gradient(circle, white, transparent 70%)" }}
            aria-hidden
          />

          <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center gap-8">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="size-4 text-primary-foreground/80" />
                <p className="text-[10px] font-bold tracking-widest text-primary-foreground/70">
                  FOR SELLERS
                </p>
              </div>
              <h2 className="font-display text-3xl sm:text-5xl text-primary-foreground leading-tight mb-3">
                Start selling today
              </h2>
              <p className="text-sm text-primary-foreground/80 max-w-md leading-relaxed">
                List your digital goods, get paid in USDT, ship from anywhere. Low fees, instant
                payouts, access to 100K+ global buyers.
              </p>
            </div>
            <div className="flex flex-col sm:items-end gap-3 shrink-0">
              <Link
                href="/sell"
                className="inline-flex items-center gap-2 bg-background text-foreground text-xs font-bold tracking-widest px-6 py-3.5 rounded-xl hover:bg-card transition-colors shadow-elev"
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
    <div className="flex items-end justify-between gap-2 mb-5">
      <div>
        <p className="text-[10px] font-bold tracking-widest text-primary mb-1">{label}</p>
        <h2 className="font-display text-2xl sm:text-3xl leading-tight">{title}</h2>
      </div>
      {href && hrefLabel && (
        <Link
          href={href}
          className="text-xs font-medium text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors shrink-0 px-3 py-1.5 rounded-lg hover:bg-secondary/60"
        >
          {hrefLabel} <ArrowRight className="size-3" />
        </Link>
      )}
    </div>
  );
}
