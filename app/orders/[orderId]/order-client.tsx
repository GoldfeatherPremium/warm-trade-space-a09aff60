"use client";

import { useEffect, useState, useTransition } from "react";
import { Star, Copy, Check, AlertTriangle, CheckCircle2, PackageCheck } from "lucide-react";
import {
  buyerConfirmReceivedAction,
  buyerCancelSlaBreachAction,
  openDisputeAction,
  leaveReviewAction,
  sellerMarkDeliveredAction,
  sellerRespondDisputeAction,
  getOrderDataAction,
} from "@/server/actions/orders";
import { usdt, ORDER_STATUS_META, dateTime } from "@/lib/format";
import Link from "next/link";

type OrderData = NonNullable<Awaited<ReturnType<typeof getOrderDataAction>>>;

const TIMELINE_STEPS = ["awaiting_payment", "paid", "delivered", "completed", "released"];

function StatusBadge({ status }: { status: string }) {
  const meta = ORDER_STATUS_META[status] ?? { label: status, cls: "bg-muted" };
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${meta.cls}`}>
      {meta.label.toUpperCase()}
    </span>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
    >
      {copied ? <Check className="size-3 text-accent" /> : <Copy className="size-3" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

export function OrderClient({ initial }: { initial: OrderData }) {
  const [data, setData] = useState(initial);
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Dispute form
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [disputeReason, setDisputeReason] = useState("not_delivered");
  const [disputeDesc, setDisputeDesc] = useState("");

  // Deliver form
  const [deliverOpen, setDeliverOpen] = useState(false);
  const [proofNote, setProofNote] = useState("");
  const [manualPayload, setManualPayload] = useState("");

  // Dispute respond form
  const [respondOpen, setRespondOpen] = useState(false);
  const [disputeResponse, setDisputeResponse] = useState("");

  // Review form
  const [reviewOpen, setReviewOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");

  const { order: o, deliveries, dispute: disp, review: rev, viewerIsBuyer, viewerIsSeller } = data;

  // Poll every 5s while order is active
  useEffect(() => {
    if (["released", "refunded", "cancelled", "expired"].includes(o.status)) return;
    const id = setInterval(() => {
      startTransition(async () => {
        const fresh = await getOrderDataAction(o.id);
        if (fresh) setData(fresh as OrderData);
      });
    }, 5000);
    return () => clearInterval(id);
  }, [o.id, o.status]);

  async function act(key: string, fn: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(key);
    setError(null);
    const res = await fn();
    setBusy(null);
    if (!res.ok) {
      setError(res.error ?? "Something went wrong.");
      return false;
    }
    const fresh = await getOrderDataAction(o.id);
    if (fresh) setData(fresh as OrderData);
    return true;
  }

  const stepIdx = TIMELINE_STEPS.indexOf(o.status === "delivering" ? "paid" : o.status);
  const slaDeadline = (o.paid_at ?? o.created_at) + o.delivery_sla_minutes * 60_000;
  const slaBreached = ["paid", "delivering"].includes(o.status) && Date.now() > slaDeadline;

  const inputCls =
    "w-full bg-background border border-border rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50";

  return (
    <div className="space-y-4">
      {/* Order header */}
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-sm font-bold flex items-center gap-2 flex-wrap">
              {o.product_title}
              <StatusBadge status={o.status} />
            </h1>
            <p className="text-[11px] text-muted-foreground mt-1">
              {o.order_no} · qty {o.qty} · {dateTime(o.created_at)}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {viewerIsBuyer ? (
                <>
                  Seller:{" "}
                  <Link href={`/s/${data.sellerName}`} className="text-primary hover:underline">
                    {data.sellerName}
                  </Link>
                </>
              ) : (
                <>
                  Buyer: <span className="font-medium">{data.buyerName}</span>
                </>
              )}
            </p>
          </div>
          <div className="text-right">
            <p className="font-mono text-lg text-accent">{usdt(o.total_cents)}</p>
            {(o.discount_cents ?? 0) > 0 && (
              <p className="text-[10px] text-muted-foreground">
                incl. {usdt(o.discount_cents)} discount
              </p>
            )}
          </div>
        </div>

        {/* Timeline */}
        <div className="mt-4 grid grid-cols-5 gap-1 relative">
          <div aria-hidden className="absolute top-2.5 left-[10%] right-[10%] h-px bg-border" />
          {TIMELINE_STEPS.map((step, i) => {
            const done = i < stepIdx;
            const active = i === stepIdx;
            return (
              <div key={step} className="flex flex-col items-center gap-1 relative z-10">
                <span
                  className={`size-5 rounded-full border grid place-items-center ${done ? "bg-accent border-accent" : active ? "bg-primary border-primary" : "bg-card border-border"}`}
                >
                  {done && <Check className="size-2.5 text-accent-foreground" />}
                </span>
                <span
                  className={`text-[9px] font-bold text-center ${active ? "text-primary" : done ? "text-accent" : "text-muted-foreground"}`}
                >
                  {ORDER_STATUS_META[step]?.label?.split("·")[0]?.trim().toUpperCase() ??
                    step.toUpperCase()}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {error && (
        <p className="text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
          {error}
        </p>
      )}

      {/* Deliveries */}
      {deliveries.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-4 space-y-3">
          <h2 className="text-xs font-bold tracking-widest text-muted-foreground flex items-center gap-1.5">
            <PackageCheck className="size-4" /> DELIVERY
          </h2>
          {deliveries.map((d) => (
            <div key={d.id} className="border border-border rounded-md p-3 space-y-1.5">
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span className="font-bold uppercase">{d.type}</span>
                <span>{dateTime(d.created_at)}</span>
              </div>
              {d.payload && (
                <div className="bg-secondary rounded-md p-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-mono break-all whitespace-pre-wrap">{d.payload}</p>
                    <CopyButton text={d.payload} />
                  </div>
                </div>
              )}
              {d.note && <p className="text-xs text-muted-foreground">{d.note}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Dispute */}
      {disp && (
        <div className="bg-card border border-warning/30 rounded-lg p-4 space-y-2">
          <h2 className="text-xs font-bold tracking-widest text-warning flex items-center gap-1.5">
            <AlertTriangle className="size-4" /> DISPUTE — {disp.status.toUpperCase()}
          </h2>
          <p className="text-sm font-bold">{disp.reason.replaceAll("_", " ")}</p>
          {disp.description && <p className="text-xs text-muted-foreground">{disp.description}</p>}
          {disp.seller_response && (
            <div className="pl-3 border-l-2 border-border">
              <p className="text-[10px] font-bold text-muted-foreground">SELLER RESPONSE</p>
              <p className="text-xs mt-0.5">{disp.seller_response}</p>
            </div>
          )}
          {disp.resolution && (
            <div className="bg-accent/10 border border-accent/30 rounded-md p-2.5">
              <p className="text-[10px] font-bold text-accent">
                RESOLUTION: {disp.resolution.toUpperCase()}
              </p>
              {disp.resolution_cents != null && (
                <p className="text-xs mt-0.5">Refund: {usdt(disp.resolution_cents)}</p>
              )}
            </div>
          )}
          {viewerIsSeller &&
            !disp.seller_response &&
            disp.status !== "resolved" &&
            (respondOpen ? (
              <div className="space-y-2 pt-2">
                <textarea
                  value={disputeResponse}
                  onChange={(e) => setDisputeResponse(e.target.value)}
                  rows={3}
                  placeholder="Explain your side…"
                  className={inputCls}
                />
                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      act("respond", () => sellerRespondDisputeAction(o.id, disputeResponse))
                    }
                    disabled={!!busy || !disputeResponse.trim()}
                    className="px-4 py-2 text-xs font-bold bg-primary text-primary-foreground rounded-md disabled:opacity-60"
                  >
                    {busy === "respond" ? "Submitting…" : "Submit response"}
                  </button>
                  <button
                    onClick={() => setRespondOpen(false)}
                    className="px-4 py-2 text-xs text-muted-foreground"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setRespondOpen(true)}
                className="text-xs text-primary hover:underline"
              >
                Respond to dispute
              </button>
            ))}
        </div>
      )}

      {/* Buyer actions */}
      {viewerIsBuyer && (
        <div className="bg-card border border-border rounded-lg p-4 space-y-3">
          <h2 className="text-xs font-bold tracking-widest text-muted-foreground">ACTIONS</h2>

          {o.status === "delivered" && !rev && (
            <button
              onClick={() => act("confirm", () => buyerConfirmReceivedAction(o.id))}
              disabled={!!busy}
              className="flex items-center gap-2 w-full justify-center py-2.5 text-sm font-bold bg-accent text-accent-foreground rounded-lg disabled:opacity-60"
            >
              <CheckCircle2 className="size-4" />
              {busy === "confirm" ? "Confirming…" : "Confirm delivery received"}
            </button>
          )}

          {slaBreached && o.status !== "disputed" && !disp && (
            <button
              onClick={() => act("sla", () => buyerCancelSlaBreachAction(o.id))}
              disabled={!!busy}
              className="w-full py-2.5 text-sm font-bold bg-destructive/90 text-white rounded-lg disabled:opacity-60"
            >
              {busy === "sla" ? "Cancelling…" : "Cancel — SLA breach (no delivery)"}
            </button>
          )}

          {["paid", "delivering", "delivered"].includes(o.status) &&
            !disp &&
            (disputeOpen ? (
              <div className="space-y-2 border border-border rounded-md p-3">
                <p className="text-xs font-bold">Open a dispute</p>
                <select
                  value={disputeReason}
                  onChange={(e) => setDisputeReason(e.target.value)}
                  className={inputCls}
                >
                  <option value="not_delivered">Not delivered</option>
                  <option value="wrong_item">Wrong item</option>
                  <option value="not_as_described">Not as described</option>
                  <option value="quality_issue">Quality issue</option>
                  <option value="seller_unresponsive">Seller unresponsive</option>
                  <option value="other">Other</option>
                </select>
                <textarea
                  value={disputeDesc}
                  onChange={(e) => setDisputeDesc(e.target.value)}
                  rows={2}
                  placeholder="Describe the issue…"
                  className={inputCls}
                />
                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      act("dispute", () =>
                        openDisputeAction({
                          orderId: o.id,
                          reason: disputeReason as never,
                          description: disputeDesc || "No description provided.",
                        }),
                      )
                    }
                    disabled={!!busy}
                    className="px-4 py-2 text-xs font-bold bg-destructive text-white rounded-md disabled:opacity-60"
                  >
                    {busy === "dispute" ? "Opening…" : "Open dispute"}
                  </button>
                  <button
                    onClick={() => setDisputeOpen(false)}
                    className="px-4 py-2 text-xs text-muted-foreground"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setDisputeOpen(true)}
                className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1"
              >
                <AlertTriangle className="size-3" /> Open a dispute
              </button>
            ))}

          {["completed", "released"].includes(o.status) &&
            !rev &&
            (reviewOpen ? (
              <div className="space-y-2 border border-border rounded-md p-3">
                <p className="text-xs font-bold">Leave a review</p>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button key={s} onClick={() => setRating(s)}>
                      <Star
                        className={`size-5 ${s <= rating ? "text-warning fill-current" : "text-muted-foreground"}`}
                      />
                    </button>
                  ))}
                </div>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={2}
                  placeholder="Optional comment…"
                  className={inputCls}
                />
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      const ok = await act("review", () =>
                        leaveReviewAction({ orderId: o.id, rating, comment: comment || undefined }),
                      );
                      if (ok) setReviewOpen(false);
                    }}
                    disabled={!!busy}
                    className="px-4 py-2 text-xs font-bold bg-primary text-primary-foreground rounded-md disabled:opacity-60"
                  >
                    {busy === "review" ? "Saving…" : "Submit review"}
                  </button>
                  <button
                    onClick={() => setReviewOpen(false)}
                    className="px-4 py-2 text-xs text-muted-foreground"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setReviewOpen(true)}
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                <Star className="size-3" /> Leave a review
              </button>
            ))}

          {rev && (
            <div className="bg-secondary/40 rounded-md p-3">
              <p className="text-[10px] font-bold text-muted-foreground">YOUR REVIEW</p>
              <div className="flex items-center gap-1 mt-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={s}
                    className={`size-3.5 ${s <= rev.rating ? "text-warning fill-current" : "text-muted-foreground"}`}
                  />
                ))}
                <span className="text-[10px] text-muted-foreground ml-1">
                  {dateTime(rev.created_at)}
                </span>
              </div>
              {rev.comment && <p className="text-xs mt-1">{rev.comment}</p>}
            </div>
          )}
        </div>
      )}

      {/* Seller actions */}
      {viewerIsSeller && ["paid", "delivering"].includes(o.status) && (
        <div className="bg-card border border-border rounded-lg p-4 space-y-3">
          <h2 className="text-xs font-bold tracking-widest text-muted-foreground">DELIVER</h2>
          {deliverOpen ? (
            <div className="space-y-2">
              <textarea
                value={proofNote}
                onChange={(e) => setProofNote(e.target.value)}
                rows={2}
                placeholder="Delivery note / proof (required)"
                className={inputCls}
              />
              <textarea
                value={manualPayload}
                onChange={(e) => setManualPayload(e.target.value)}
                rows={3}
                placeholder="Delivery payload (account credentials, license key, etc.)"
                className={inputCls}
              />
              <div className="flex gap-2">
                <button
                  onClick={() =>
                    act("deliver", () =>
                      sellerMarkDeliveredAction(o.id, proofNote, manualPayload || undefined),
                    )
                  }
                  disabled={!!busy || !proofNote.trim()}
                  className="px-4 py-2 text-xs font-bold bg-accent text-accent-foreground rounded-md disabled:opacity-60"
                >
                  {busy === "deliver" ? "Marking…" : "Mark as delivered"}
                </button>
                <button
                  onClick={() => setDeliverOpen(false)}
                  className="px-4 py-2 text-xs text-muted-foreground"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setDeliverOpen(true)}
              className="flex items-center gap-2 w-full justify-center py-2.5 text-sm font-bold bg-accent text-accent-foreground rounded-lg"
            >
              <PackageCheck className="size-4" /> Mark delivered
            </button>
          )}
        </div>
      )}
    </div>
  );
}
