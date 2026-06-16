"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { listDisputesAction, resolveDisputeAction } from "@/server/actions/admin";
import { dateTime, usdt } from "@/lib/format";
import { AlertTriangle, Clock } from "lucide-react";

type Dispute = Awaited<ReturnType<typeof listDisputesAction>>[number];

const STATUS_CLS: Record<string, string> = {
  open: "bg-warning/15 text-warning",
  under_review: "bg-accent/15 text-accent",
  resolved: "bg-success/15 text-success",
};

const SLA_HOURS = 72;

function SlaBadge({ openedAt, resolved }: { openedAt: number; resolved: boolean }) {
  if (resolved) return null;
  const deadline = openedAt + SLA_HOURS * 3_600_000;
  const remaining = deadline - Date.now();
  const overdue = remaining < 0;
  const hours = Math.round(Math.abs(remaining) / 3_600_000);
  return (
    <span
      className={`text-[9px] font-bold px-2 py-0.5 rounded inline-flex items-center gap-1 ${
        overdue
          ? "bg-destructive/90 text-white"
          : remaining < 12 * 3_600_000
            ? "bg-warning/90 text-warning-foreground"
            : "bg-secondary text-foreground/80"
      }`}
    >
      {overdue ? <AlertTriangle className="size-2.5" /> : <Clock className="size-2.5" />}
      {overdue ? `SLA +${hours}h` : `SLA ${hours}h`}
    </span>
  );
}

const INPUT =
  "bg-secondary border border-border rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary/50";
const BTN = "px-3 py-1.5 rounded-md text-xs font-bold disabled:opacity-50";

export function DisputesClient() {
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [partial, setPartial] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function load() {
    startTransition(async () => {
      try {
        const data = await listDisputesAction();
        setDisputes(data);
      } finally {
        setLoading(false);
      }
    });
  }

  useEffect(() => {
    load();
    intervalRef.current = setInterval(load, 15_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  async function resolve(
    disputeId: string,
    resolution: "refund_full" | "refund_partial" | "release_seller",
  ) {
    if (note.length < 5) {
      setMsg("Decision note required (min 5 chars).");
      return;
    }
    if (resolution === "refund_partial" && !partial) {
      setMsg("Enter USDT amount for partial refund.");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      await resolveDisputeAction({
        disputeId,
        resolution,
        partialRefundUsdt: resolution === "refund_partial" ? parseFloat(partial) : undefined,
        note,
      });
      setResolving(null);
      setNote("");
      setPartial("");
      setMsg("Dispute resolved.");
      load();
    } catch (err) {
      setMsg((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <h1 className="font-display text-2xl">DISPUTES CENTER</h1>

      {msg && (
        <p className="text-xs bg-secondary border border-border rounded-md px-3 py-2">{msg}</p>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : disputes.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">No disputes 🎉</p>
      ) : (
        disputes.map((dd) => (
          <div
            key={dd.id as string}
            className="bg-card border border-border rounded-lg p-4 space-y-2"
          >
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <span className="font-mono font-bold text-primary">{dd.order_no as string}</span>
              <span className="truncate">{dd.product_title as string}</span>
              <span
                className={`text-[9px] font-bold px-2 py-0.5 rounded ${
                  STATUS_CLS[dd.status as string] ?? "bg-muted"
                }`}
              >
                {(dd.status as string).replaceAll("_", " ").toUpperCase()}
              </span>
              <SlaBadge openedAt={dd.created_at as number} resolved={dd.status === "resolved"} />
              <span className="font-mono text-accent ml-auto">
                {usdt(dd.total_cents as number)}
              </span>
            </div>

            <p className="text-[10px] text-muted-foreground">
              buyer {dd.buyer_name as string} vs seller {dd.seller_name as string} · opened{" "}
              {dateTime(dd.created_at as number)} · reason:{" "}
              <b className="text-foreground">{(dd.reason as string)?.replaceAll("_", " ")}</b>
            </p>

            {dd.description && (
              <p className="text-xs bg-secondary/60 rounded-md p-2">
                <b>Buyer:</b> {dd.description as string}
              </p>
            )}
            {dd.seller_response && (
              <p className="text-xs bg-secondary/60 rounded-md p-2">
                <b>Seller:</b> {dd.seller_response as string}
              </p>
            )}

            {dd.status !== "resolved" ? (
              resolving === (dd.id as string) ? (
                <div className="flex gap-2 flex-wrap items-center pt-1">
                  <input
                    placeholder="Decision note (mandatory)"
                    className={`${INPUT} w-56`}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                  <button
                    disabled={busy || note.length < 5}
                    onClick={() => resolve(dd.id as string, "refund_full")}
                    className={`${BTN} bg-destructive text-destructive-foreground`}
                  >
                    Full refund
                  </button>
                  <input
                    placeholder="USDT"
                    type="number"
                    className={`${INPUT} w-20`}
                    value={partial}
                    onChange={(e) => setPartial(e.target.value)}
                  />
                  <button
                    disabled={busy || note.length < 5 || !partial}
                    onClick={() => resolve(dd.id as string, "refund_partial")}
                    className={`${BTN} bg-secondary text-foreground`}
                  >
                    Partial refund
                  </button>
                  <button
                    disabled={busy || note.length < 5}
                    onClick={() => resolve(dd.id as string, "release_seller")}
                    className={`${BTN} bg-primary text-primary-foreground`}
                  >
                    Release to seller
                  </button>
                  <button
                    onClick={() => {
                      setResolving(null);
                      setNote("");
                      setPartial("");
                    }}
                    className={`${BTN} bg-secondary text-foreground`}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  className={`${BTN} bg-secondary text-foreground`}
                  onClick={() => {
                    setResolving(dd.id as string);
                    setNote("");
                  }}
                >
                  Resolve…
                </button>
              )
            ) : (
              <p className="text-xs text-accent font-bold">
                Resolved: {(dd.resolution as string)?.replaceAll("_", " ")}
                {dd.resolution_cents ? ` · ${usdt(dd.resolution_cents as number)}` : ""} ·{" "}
                {dateTime(dd.resolved_at as number)}
              </p>
            )}
          </div>
        ))
      )}
    </div>
  );
}
