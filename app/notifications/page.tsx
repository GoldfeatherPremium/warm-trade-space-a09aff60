import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Bell } from "lucide-react";
import { requireUser } from "@/server/auth";
import { q } from "@/lib/server/db.server";
import { timeAgo } from "@/lib/format";
import { PublicShell } from "../_components/site-shell";
import { MarkAllReadButton } from "./mark-all-read";

export const metadata: Metadata = { title: "Notifications — X-VAULT", robots: { index: false } };
export const dynamic = "force-dynamic";

const TYPE_META: Record<string, { label: string; cls: string }> = {
  order_paid: { label: "Order paid", cls: "bg-accent/15 text-accent" },
  order_delivered: { label: "Delivered", cls: "bg-blue-500/15 text-blue-400" },
  order_completed: { label: "Completed", cls: "bg-accent/15 text-accent" },
  order_cancelled: { label: "Cancelled", cls: "bg-muted text-muted-foreground" },
  dispute_opened: { label: "Dispute", cls: "bg-yellow-500/15 text-yellow-400" },
  dispute_update: { label: "Dispute update", cls: "bg-yellow-500/15 text-yellow-400" },
  chat: { label: "Message", cls: "bg-primary/15 text-primary" },
  review: { label: "Review", cls: "bg-accent/15 text-accent" },
  withdrawal: { label: "Withdrawal", cls: "bg-blue-500/15 text-blue-400" },
  system: { label: "System", cls: "bg-muted text-muted-foreground" },
};

export default async function NotificationsPage() {
  const user = await requireUser().catch(() => null);
  if (!user) redirect("/auth?redirect=/notifications");

  const notifications = await q<{
    id: string;
    type: string;
    title: string;
    body: string | null;
    link: string | null;
    read_at: number | null;
    created_at: number;
  }>(`select * from notifications where user_id = ? order by created_at desc limit 100`, [user.id]);

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  return (
    <PublicShell>
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Bell className="size-6 text-accent" />
            <h1 className="font-display text-3xl">Notifications</h1>
            {unreadCount > 0 && (
              <span className="size-6 rounded-full bg-accent text-accent-foreground text-xs font-bold grid place-items-center">
                {unreadCount}
              </span>
            )}
          </div>
          {unreadCount > 0 && <MarkAllReadButton />}
        </div>

        {notifications.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-12 text-center space-y-3">
            <Bell className="size-12 mx-auto opacity-20" />
            <p className="text-sm text-muted-foreground">No notifications yet.</p>
          </div>
        ) : (
          <div className="space-y-1">
            {notifications.map((n) => {
              const meta = TYPE_META[n.type] ?? { label: n.type, cls: "bg-muted" };
              const card = (
                <div
                  className={`bg-card border rounded-xl p-4 transition-colors ${!n.read_at ? "border-primary/30 bg-primary/5" : "border-border"}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="shrink-0 mt-0.5">
                      {!n.read_at && <span className="size-2 rounded-full bg-accent block" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${meta.cls}`}>
                          {meta.label.toUpperCase()}
                        </span>
                        <span className="text-[10px] text-muted-foreground ml-auto">
                          {timeAgo(n.created_at)}
                        </span>
                      </div>
                      <p className="text-sm font-bold">{n.title}</p>
                      {n.body && <p className="text-xs text-muted-foreground mt-0.5">{n.body}</p>}
                    </div>
                  </div>
                </div>
              );

              return n.link ? (
                <Link
                  key={n.id}
                  href={n.link}
                  className="block hover:opacity-80 transition-opacity"
                >
                  {card}
                </Link>
              ) : (
                <div key={n.id}>{card}</div>
              );
            })}
          </div>
        )}
      </div>
    </PublicShell>
  );
}
