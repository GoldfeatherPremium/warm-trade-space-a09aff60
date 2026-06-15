import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import { requireUser } from "@/server/auth";
import { getDisputeThread } from "@/server/queries/disputes";
import { usdt, dateTime } from "@/lib/format";
import { PublicShell } from "../../_components/site-shell";
import { DisputeClient } from "./dispute-client";

export const metadata: Metadata = { title: "Dispute" };
export const dynamic = "force-dynamic";

const STATUS_CLS: Record<string, string> = {
  open: "bg-yellow-500/15 text-yellow-400",
  seller_responded: "bg-blue-500/15 text-blue-400",
  under_review: "bg-blue-500/15 text-blue-400",
  awaiting_buyer: "bg-yellow-500/15 text-yellow-400",
  resolved: "bg-accent/15 text-accent",
};

export default async function DisputeDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const user = await requireUser().catch(() => null);
  if (!user) redirect(`/auth?redirect=/disputes/${orderId}`);

  const thread = await getDisputeThread(orderId, user);
  if (!thread) notFound();

  const { myRole, order: o, dispute: d, evidence, messages } = thread;

  return (
    <PublicShell>
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-2">
          <Link href="/disputes" className="text-sm text-muted-foreground hover:text-foreground">
            Disputes
          </Link>
          <span className="text-muted-foreground">/</span>
          <span className="text-sm">{o.order_no}</span>
        </div>

        {/* Order summary */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="font-display text-xl">{o.product_title}</h1>
              <p className="text-[11px] text-muted-foreground mt-1">{o.order_no}</p>
              <Link
                href={`/orders/${o.id}`}
                className="text-xs text-primary hover:underline mt-1 block"
              >
                View order →
              </Link>
            </div>
            <p className="font-mono text-lg text-accent">{usdt(o.total_cents)}</p>
          </div>
        </div>

        {d ? (
          <>
            {/* Dispute header */}
            <div
              className={`bg-card border rounded-xl p-5 space-y-3 ${d.status === "resolved" ? "border-accent/30" : "border-yellow-500/30"}`}
            >
              <div className="flex items-center gap-3 flex-wrap">
                <AlertTriangle
                  className={`size-5 ${d.status === "resolved" ? "text-accent" : "text-yellow-400"}`}
                />
                <h2 className="font-display text-lg">{d.reason.replaceAll("_", " ")}</h2>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded ${STATUS_CLS[d.status] ?? "bg-muted"}`}
                >
                  {d.status.replaceAll("_", " ").toUpperCase()}
                </span>
              </div>
              {d.description && <p className="text-sm text-muted-foreground">{d.description}</p>}
              <p className="text-[11px] text-muted-foreground">Opened {dateTime(d.created_at)}</p>

              {d.seller_response && (
                <div className="pl-3 border-l-2 border-border">
                  <p className="text-[10px] font-bold text-muted-foreground mb-1">
                    SELLER RESPONSE
                  </p>
                  <p className="text-sm">{d.seller_response}</p>
                </div>
              )}

              {d.resolution && (
                <div className="bg-accent/10 border border-accent/30 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="size-4 text-accent" />
                    <p className="text-xs font-bold text-accent">
                      RESOLVED — {d.resolution.replaceAll("_", " ").toUpperCase()}
                    </p>
                  </div>
                  {d.resolution_cents != null && (
                    <p className="text-sm mt-1">Refund: {usdt(d.resolution_cents)}</p>
                  )}
                  {d.resolved_at && (
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {dateTime(d.resolved_at)}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Messages & Evidence */}
            <DisputeClient
              orderId={orderId}
              myRole={myRole}
              evidenceInit={evidence}
              messagesInit={messages}
              resolved={d.status === "resolved"}
            />
          </>
        ) : (
          <div className="bg-card border border-border rounded-xl p-8 text-center space-y-3">
            <ShieldCheck className="size-10 mx-auto text-accent opacity-60" />
            <p className="text-sm text-muted-foreground">
              No dispute has been opened on this order.
            </p>
            <Link href={`/orders/${o.id}`} className="text-sm text-primary hover:underline">
              Go to order →
            </Link>
          </div>
        )}
      </div>
    </PublicShell>
  );
}
