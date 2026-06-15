import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import { requireUser } from "@/server/auth";
import { listUserDisputes } from "@/server/queries/disputes";
import { usdt, dateTime } from "@/lib/format";
import { PublicShell } from "../_components/site-shell";

export const metadata: Metadata = { title: "Disputes", robots: { index: false } };
export const dynamic = "force-dynamic";

const STATUS_CLS: Record<string, string> = {
  open: "bg-yellow-500/15 text-yellow-400",
  seller_responded: "bg-blue-500/15 text-blue-400",
  under_review: "bg-blue-500/15 text-blue-400",
  awaiting_buyer: "bg-yellow-500/15 text-yellow-400",
  resolved: "bg-accent/15 text-accent",
};

const PRIORITY_CLS: Record<string, string> = {
  low: "text-muted-foreground",
  normal: "text-muted-foreground",
  high: "text-yellow-400",
  urgent: "text-destructive",
};

export default async function DisputesPage() {
  const user = await requireUser().catch(() => null);
  if (!user) redirect("/auth?redirect=/disputes");

  const disputes = await listUserDisputes(user);

  return (
    <PublicShell>
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <AlertTriangle className="size-6 text-yellow-400" />
          <h1 className="font-display text-3xl">Disputes</h1>
        </div>

        {disputes.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-12 text-center space-y-3">
            <ShieldCheck className="size-12 mx-auto text-accent opacity-60" />
            <p className="font-display text-lg">No disputes</p>
            <p className="text-sm text-muted-foreground">All your trades are going smoothly.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {disputes.map((d) => (
              <Link
                key={d.id}
                href={`/disputes/${d.order_id}`}
                className="block bg-card border border-border rounded-xl p-4 hover:border-primary/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded ${STATUS_CLS[d.status] ?? "bg-muted"}`}
                      >
                        {d.status.replaceAll("_", " ").toUpperCase()}
                      </span>
                      <span className={`text-[10px] font-bold ${PRIORITY_CLS[d.priority] ?? ""}`}>
                        {d.priority.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-sm font-bold truncate">{d.product_title}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {d.order_no} · {d.reason.replaceAll("_", " ")}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {d.buyer} → {d.seller}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-mono text-sm text-accent">{usdt(d.total_cents)}</p>
                    <p className="text-[10px] text-muted-foreground">{dateTime(d.created_at)}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </PublicShell>
  );
}
