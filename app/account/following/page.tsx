import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Users } from "lucide-react";
import { requireUser } from "@/server/auth";
import { q } from "@/lib/server/db.server";
import { appContext } from "@/lib/server/app.server";
import { PublicShell } from "../../_components/site-shell";

export const metadata: Metadata = { title: "Following — X-VAULT" };
export const dynamic = "force-dynamic";

export default async function FollowingPage() {
  const user = await requireUser().catch(() => null);
  if (!user) redirect("/auth?redirect=/account/following");

  await appContext();
  const sellers = await q<{
    username: string;
    rating: number;
    total_sales: number;
    seller_level: number;
    followed_at: number;
  }>(
    `select u.username, u.rating, u.total_sales, u.seller_level, sf.created_at as followed_at
     from seller_follows sf
     join users u on u.id = sf.seller_id
     where sf.user_id = ?
     order by sf.created_at desc limit 100`,
    [user.id],
  );

  return (
    <PublicShell>
      <h1 className="font-display text-3xl mb-6 flex items-center gap-2">
        <Users className="size-6 text-primary" /> FOLLOWING
      </h1>

      {sellers.length === 0 ? (
        <div className="py-16 text-center space-y-3">
          <p className="text-sm text-muted-foreground">You're not following any sellers yet.</p>
          <Link href="/sellers" className="text-primary text-sm font-bold">
            Browse top sellers →
          </Link>
        </div>
      ) : (
        <div className="space-y-2 max-w-lg">
          {sellers.map((s) => (
            <Link
              key={s.username}
              href={`/s/${s.username}`}
              className="flex items-center gap-3 bg-card border border-border rounded-xl p-3 hover:border-primary/50 transition-colors"
            >
              <div className="size-10 rounded-xl bg-primary/15 border border-primary/40 grid place-items-center text-xs font-bold text-primary uppercase shrink-0">
                {s.username.slice(0, 2)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate">{s.username}</p>
                <p className="text-[11px] text-muted-foreground">
                  {s.rating > 0 ? `★ ${s.rating.toFixed(1)} · ` : ""}
                  {s.total_sales.toLocaleString()} sales · Level {s.seller_level}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </PublicShell>
  );
}
