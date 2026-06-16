import type { Metadata } from "next";
import Link from "next/link";
import { Star, ShieldCheck } from "lucide-react";
import { getSellerLeaderboardData } from "@/server/queries/catalog";
import { usdt } from "@/lib/format";
import { PublicShell } from "../_components/site-shell";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Top Sellers",
  description:
    "The most trusted digital-goods sellers on X-VAULT, ranked by verified trust score, completed sales and buyer ratings — all buyer-protected.",
  alternates: { canonical: "/sellers" },
};

export default async function SellersPage() {
  const sellers = await getSellerLeaderboardData("30d", 30);
  return (
    <PublicShell>
      <header className="mb-6">
        <h1 className="font-display text-3xl flex items-center gap-2">
          <ShieldCheck className="size-6 text-primary" /> Top sellers
        </h1>
        <p className="text-[11px] text-muted-foreground mt-1">
          Ranked by verified trust score, completed sales, ratings, and dispute history. All
          transactions are buyer-protected.
        </p>
      </header>

      {sellers.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">
          No ranked sellers yet — check back soon.
        </p>
      ) : (
        <div className="space-y-2">
          {sellers.map((s) => (
            <Link
              key={s.id}
              href={`/s/${s.username}`}
              className="flex items-center gap-3 bg-card border border-border rounded-xl p-3 hover:border-primary/50 transition-colors"
            >
              <span className="font-display text-xl w-8 text-center text-muted-foreground">
                {s.rank}
              </span>
              <div className="size-11 rounded-xl bg-primary/15 border border-primary/40 grid place-items-center text-sm font-bold text-primary uppercase">
                {s.username.slice(0, 2)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate">{s.username}</p>
                <p className="text-[11px] text-muted-foreground">
                  Lvl {s.seller_level} · {s.total_sales.toLocaleString()} sales
                  {s.category_name ? ` · ${s.category_name}` : ""}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[11px] text-warning flex items-center gap-0.5 font-bold justify-end">
                  <Star className="size-3 fill-current" />
                  {s.rating > 0 ? s.rating.toFixed(1) : "new"}
                </p>
                <p className="text-[10px] text-muted-foreground font-mono">{usdt(s.gmv_cents)}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </PublicShell>
  );
}
