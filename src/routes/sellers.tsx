import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Trophy, Star, ShieldCheck, TrendingUp } from "lucide-react";
import { getSellerLeaderboard } from "@/lib/api/catalog";
import { PageShell } from "@/components/shell";
import { SellerBadge } from "@/components/seller-badge";
import { usdt } from "@/lib/format";

const SITE = "https://warm-trade-space.lovable.app";

export const Route = createFileRoute("/sellers")({
  loader: async ({ context }) =>
    context.queryClient.ensureQueryData({
      queryKey: ["sellerLeaderboard", "30d"],
      queryFn: () => getSellerLeaderboard({ data: { range: "30d", limit: 25 } }),
    }),
  head: ({ loaderData }) => {
    const title = "Top Trusted Sellers — X-VAULT Marketplace";
    const desc =
      "The most trusted digital-goods sellers on X-VAULT, ranked by verified trust score, completed sales, and buyer ratings — all buyer-protected.";
    const url = `${SITE}/sellers`;
    const jsonLd = loaderData?.items?.length
      ? {
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: "Top Trusted Sellers — X-VAULT",
          numberOfItems: loaderData.items.length,
          itemListElement: loaderData.items.slice(0, 10).map((s, i) => ({
            "@type": "ListItem",
            position: i + 1,
            url: `${SITE}/s/${s.username}`,
            name: s.username,
          })),
        }
      : null;
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:url", content: url },
        { property: "og:type", content: "website" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: desc },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: jsonLd
        ? [{ type: "application/ld+json", children: JSON.stringify(jsonLd) }]
        : undefined,
    };
  },
  component: SellersPage,
});

type Range = "30d" | "90d" | "all";

function SellersPage() {
  const [range, setRange] = useState<Range>("30d");
  const { data, isLoading } = useQuery({
    queryKey: ["sellerLeaderboard", range],
    queryFn: () => getSellerLeaderboard({ data: { range, limit: 25 } }),
  });

  return (
    <PageShell>
      <header className="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold tracking-[0.25em] text-primary flex items-center gap-1.5">
            <Trophy className="size-3" /> LEADERBOARD
          </p>
          <h1 className="font-display text-3xl sm:text-4xl mt-1">TOP TRUSTED SELLERS</h1>
          <p className="text-xs text-muted-foreground max-w-xl mt-1">
            Ranked by a blended trust score combining verification tier, completed sales, buyer
            ratings, and dispute history. All transactions are buyer-protected.
          </p>
        </div>
        <div className="flex gap-1 bg-secondary rounded-md p-1 self-start">
          {(["30d", "90d", "all"] as Range[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1.5 rounded text-[11px] font-bold uppercase tracking-wider ${
                range === r ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              {r === "all" ? "ALL TIME" : r}
            </button>
          ))}
        </div>
      </header>

      {isLoading || !data ? (
        <div className="py-20 text-center text-sm text-muted-foreground">Loading leaderboard…</div>
      ) : data.items.length === 0 ? (
        <div className="py-20 text-center text-sm text-muted-foreground">
          No qualifying sellers in this range yet.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
            {data.items.slice(0, 3).map((s) => (
              <Link
                key={s.id}
                to="/s/$username"
                params={{ username: s.username }}
                className={`bg-card border rounded-lg p-4 flex flex-col gap-2 hover:border-primary/60 transition ${
                  s.rank === 1
                    ? "border-yellow-500/50 sm:scale-[1.02]"
                    : s.rank === 2
                      ? "border-slate-400/40"
                      : "border-orange-700/40"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`font-display text-3xl ${
                      s.rank === 1
                        ? "text-yellow-400"
                        : s.rank === 2
                          ? "text-slate-300"
                          : "text-orange-400"
                    }`}
                  >
                    #{s.rank}
                  </span>
                  <Trophy
                    className={`size-5 ${
                      s.rank === 1
                        ? "text-yellow-400"
                        : s.rank === 2
                          ? "text-slate-300"
                          : "text-orange-400"
                    }`}
                  />
                </div>
                <p className="font-bold text-base truncate">@{s.username}</p>
                <SellerBadge
                  tier={s.verification_tier}
                  level={s.seller_level}
                  score={s.trust_score}
                  size="xs"
                />
                <div className="grid grid-cols-3 gap-1 text-[10px] mt-2 pt-2 border-t border-border/40">
                  <div>
                    <p className="text-muted-foreground">Sales</p>
                    <p className="font-mono font-bold">{s.total_sales}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Rating</p>
                    <p className="font-mono font-bold flex items-center gap-0.5">
                      <Star className="size-2.5 fill-current text-yellow-400" />
                      {s.rating > 0 ? s.rating.toFixed(2) : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">GMV</p>
                    <p className="font-mono font-bold">{usdt(s.gmv_cents)}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="hidden sm:grid grid-cols-[40px_1fr_180px_70px_80px_90px] gap-2 px-4 py-2 border-b border-border bg-secondary/30 text-[9px] font-bold tracking-widest text-muted-foreground">
              <span>#</span>
              <span>SELLER</span>
              <span>BADGES</span>
              <span className="text-right">SALES</span>
              <span className="text-right">RATING</span>
              <span className="text-right">GMV ({range.toUpperCase()})</span>
            </div>
            {data.items.slice(3).map((s) => (
              <Link
                key={s.id}
                to="/s/$username"
                params={{ username: s.username }}
                className="grid grid-cols-[40px_1fr] sm:grid-cols-[40px_1fr_180px_70px_80px_90px] gap-2 px-4 py-2.5 border-b border-border/40 last:border-0 items-center hover:bg-secondary/40 text-xs"
              >
                <span className="font-mono text-muted-foreground">#{s.rank}</span>
                <div className="min-w-0">
                  <p className="font-bold truncate">@{s.username}</p>
                  {s.category_name && (
                    <p className="text-[10px] text-muted-foreground truncate">{s.category_name}</p>
                  )}
                </div>
                <div className="hidden sm:block">
                  <SellerBadge
                    tier={s.verification_tier}
                    level={s.seller_level}
                    score={s.trust_score}
                    size="xs"
                  />
                </div>
                <span className="hidden sm:block text-right font-mono">{s.total_sales}</span>
                <span className="hidden sm:flex items-center justify-end gap-0.5 font-mono">
                  {s.rating > 0 ? (
                    <>
                      <Star className="size-3 fill-current text-yellow-400" />
                      {s.rating.toFixed(2)}
                    </>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </span>
                <span className="hidden sm:block text-right font-mono">{usdt(s.gmv_cents)}</span>
              </Link>
            ))}
          </div>

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="bg-card border border-border rounded-lg p-3 flex items-center gap-2">
              <ShieldCheck className="size-4 text-primary" />
              <span>All sellers buyer-protected by default.</span>
            </div>
            <div className="bg-card border border-border rounded-lg p-3 flex items-center gap-2">
              <Star className="size-4 text-yellow-400" />
              <span>Ratings come from verified buyers only.</span>
            </div>
            <div className="bg-card border border-border rounded-lg p-3 flex items-center gap-2">
              <TrendingUp className="size-4 text-emerald-400" />
              <span>Leaderboard refreshes throughout the day.</span>
            </div>
          </div>
        </>
      )}
    </PageShell>
  );
}
