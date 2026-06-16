"use client";

import { useEffect, useState, useTransition } from "react";
import { Star } from "lucide-react";
import { listSellerReviewsAction, replyToReviewAction } from "@/server/actions/seller";
import { timeAgo } from "@/lib/format";

type Reviews = Awaited<ReturnType<typeof listSellerReviewsAction>>;
type Review = Reviews["reviews"][number];

export default function SellerReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [replying, setReplying] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const load = () => {
    startTransition(async () => {
      const d = await listSellerReviewsAction();
      setReviews(d.reviews);
      setLoaded(true);
    });
  };

  useEffect(() => {
    load();
  }, []);

  const sendReply = (reviewId: string) => {
    setError(null);
    startTransition(async () => {
      try {
        await replyToReviewAction(reviewId, reply);
        setReplying(null);
        setReply("");
        load();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error");
      }
    });
  };

  return (
    <div className="space-y-3 max-w-2xl">
      <h1 className="font-display text-2xl">REVIEWS</h1>
      {error && (
        <p className="text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
          {error}
        </p>
      )}
      {!loaded ? (
        <div className="py-16 text-center text-sm text-muted-foreground animate-pulse">
          Loading…
        </div>
      ) : reviews.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">No reviews yet.</p>
      ) : (
        reviews.map((r) => (
          <div key={r.id} className="bg-card border border-border rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2 text-xs">
              <span className="font-bold">{r.buyer}</span>
              <span className="text-warning flex">
                {Array.from({ length: r.rating }).map((_, j) => (
                  <Star key={j} className="size-3 fill-current" />
                ))}
              </span>
              <span className="text-[10px] text-muted-foreground truncate">
                {r.product_title} · {r.order_no}
              </span>
              <span className="text-[10px] text-muted-foreground ml-auto">
                {timeAgo(r.created_at)}
              </span>
            </div>
            {r.comment && <p className="text-xs">{r.comment}</p>}
            {r.seller_reply ? (
              <p className="text-[11px] bg-secondary rounded-md p-2 text-muted-foreground">
                <b className="text-foreground">Your reply:</b> {r.seller_reply}
              </p>
            ) : replying === r.id ? (
              <div className="space-y-2">
                <textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Public reply…"
                  className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-xs"
                  rows={3}
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => sendReply(r.id)}
                    disabled={reply.length < 2}
                    className="bg-primary text-primary-foreground text-xs font-bold px-3 py-1.5 rounded-md disabled:opacity-50"
                  >
                    Reply
                  </button>
                  <button
                    onClick={() => {
                      setReplying(null);
                      setReply("");
                    }}
                    className="bg-secondary text-xs font-bold px-3 py-1.5 rounded-md hover:bg-border"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => {
                  setReplying(r.id);
                  setReply("");
                }}
                className="bg-secondary text-xs font-bold px-3 py-1.5 rounded-md hover:bg-border"
              >
                Reply
              </button>
            )}
          </div>
        ))
      )}
    </div>
  );
}
