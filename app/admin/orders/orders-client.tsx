"use client";

import { useEffect, useState, useTransition } from "react";
import {
  adminListOrdersAction,
  adminForceOrderAction,
  adminEscrowAction,
} from "@/server/actions/admin";
import { dateTime, usdt } from "@/lib/format";
import { ShieldAlert, ShieldCheck, Clock } from "lucide-react";

type Order = Awaited<ReturnType<typeof adminListOrdersAction>>[number];

const STATUS_META: Record<string, { label: string; cls: string }> = {
  awaiting_payment: { label: "Awaiting payment", cls: "bg-yellow-500/15 text-yellow-400" },
  paid: { label: "Paid", cls: "bg-blue-500/15 text-blue-400" },
  delivering: { label: "Delivering", cls: "bg-purple-500/15 text-purple-400" },
  delivered: { label: "Delivered", cls: "bg-accent/15 text-accent" },
  completed: { label: "Completed", cls: "bg-emerald-500/15 text-emerald-400" },
  disputed: { label: "Disputed", cls: "bg-destructive/15 text-destructive" },
  refunded: { label: "Refunded", cls: "bg-blue-500/15 text-blue-400" },
  cancelled: { label: "Cancelled", cls: "bg-muted text-muted-foreground" },
  expired: { label: "Expired", cls: "bg-muted text-muted-foreground" },
};

const ESCROW_CLS: Record<string, string> = {
  held: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
  on_hold: "bg-destructive/15 text-destructive border-destructive/40",
  released: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  refunded: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  none: "bg-muted/30 text-muted-foreground border-border",
};

const INPUT =
  "bg-secondary border border-border rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary/50";
const BTN = "px-2.5 py-1 rounded-md text-[10px] font-bold disabled:opacity-50";

export function OrdersClient() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFor, setActionFor] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function load() {
    setLoading(true);
    startTransition(async () => {
      try {
        const data = await adminListOrdersAction({ q: q || undefined, status: status || undefined });
        setOrders(data);
      } finally {
        setLoading(false);
      }
    });
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, status]);

  async function forceAction(orderId: string, action: "refund" | "release" | "cancel") {
    if (note.length < 5) { setMsg("Note must be at least 5 characters."); return; }
    setBusy(true);
    setMsg(null);
    try {
      await adminForceOrderAction({ orderId, action, note });
      setActionFor(null);
      setNote("");
      setMsg("Action applied.");
      load();
    } catch (err) {
      setMsg((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function escrow(orderId: string, action: "hold" | "unhold" | "extend", reason: string, hours?: number) {
    setBusy(true);
    setMsg(null);
    try {
      await adminEscrowAction({ orderId, action, reason, hours });
      setMsg("Escrow updated.");
      load();
    } catch (err) {
      setMsg((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <h1 className="font-display text-2xl">ALL ORDERS</h1>
      <div className="flex gap-2 flex-wrap">
        <input
          placeholder="Search order no / product / user…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className={`${INPUT} max-w-xs`}
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className={INPUT}
        >
          <option value="">All statuses</option>
          {Object.entries(STATUS_META).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      {msg && (
        <p className="text-xs bg-secondary border border-border rounded-md px-3 py-2">{msg}</p>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="space-y-2">
          {orders.map((o) => {
            const meta =
              STATUS_META[(o.status as string)] ?? { label: o.status as string, cls: "bg-muted" };
            const escrowStatus = o.escrow_status as string | null;
            return (
              <div
                key={o.id as string}
                className="bg-card border border-border rounded-lg p-3 space-y-2"
              >
                <div className="flex items-center gap-2 flex-wrap text-xs">
                  <span className="font-mono font-bold text-primary">{o.order_no as string}</span>
                  <span className="truncate flex-1">{o.product_title as string}</span>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${meta.cls}`}>
                    {meta.label.toUpperCase()}
                  </span>
                  {escrowStatus && escrowStatus !== "none" && (
                    <span
                      className={`inline-flex items-center gap-1 text-[9px] font-bold border px-1.5 py-0.5 rounded ${
                        ESCROW_CLS[escrowStatus] ?? ESCROW_CLS.none
                      }`}
                    >
                      {escrowStatus === "on_hold" ? (
                        <ShieldAlert className="size-2.5" />
                      ) : escrowStatus === "released" ? (
                        <ShieldCheck className="size-2.5" />
                      ) : (
                        <Clock className="size-2.5" />
                      )}
                      {escrowStatus.replace("_", " ").toUpperCase()}
                    </span>
                  )}
                  <span className="font-mono text-accent">{usdt(o.total_cents as number)}</span>
                </div>

                {escrowStatus === "on_hold" && o.escrow_hold_reason && (
                  <p className="text-[10px] text-destructive bg-destructive/5 border border-destructive/20 rounded px-2 py-1">
                    Hold: {o.escrow_hold_reason as string}
                  </p>
                )}

                <div className="flex items-center gap-2 flex-wrap text-[10px] text-muted-foreground">
                  <span>buyer {o.buyer_name as string}</span>·
                  <span>seller {o.seller_name as string}</span>·
                  <span>{dateTime(o.created_at as number)}</span>

                  <span className="ml-auto flex gap-1 flex-wrap">
                    {actionFor === (o.id as string) ? (
                      <>
                        <input
                          placeholder="Mandatory note (audited)"
                          className={`${INPUT} w-52`}
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                        />
                        {(["refund", "release", "cancel"] as const).map((act) => (
                          <button
                            key={act}
                            disabled={busy || note.length < 5}
                            onClick={() => forceAction(o.id as string, act)}
                            className={`${BTN} ${act === "refund" ? "bg-destructive text-destructive-foreground" : "bg-secondary text-foreground"}`}
                          >
                            {act}
                          </button>
                        ))}
                        <button
                          onClick={() => { setActionFor(null); setNote(""); }}
                          className={`${BTN} bg-secondary text-foreground`}
                        >
                          ×
                        </button>
                      </>
                    ) : (
                      <>
                        {escrowStatus === "held" && (
                          <button
                            disabled={busy}
                            className={`${BTN} bg-secondary text-foreground`}
                            onClick={() => {
                              const reason = window.prompt("Reason for escrow hold (audited):");
                              if (reason && reason.length >= 5)
                                escrow(o.id as string, "hold", reason);
                            }}
                          >
                            Hold escrow
                          </button>
                        )}
                        {escrowStatus === "on_hold" && (
                          <button
                            disabled={busy}
                            className={`${BTN} bg-secondary text-foreground`}
                            onClick={() => escrow(o.id as string, "unhold", "Hold lifted")}
                          >
                            Lift hold
                          </button>
                        )}
                        {(escrowStatus === "held" || escrowStatus === "on_hold") && o.warranty_ends_at && (
                          <button
                            disabled={busy}
                            className={`${BTN} bg-secondary text-foreground`}
                            onClick={() => {
                              const h = Number(window.prompt("Extend warranty by how many hours?"));
                              if (!h || h < 1) return;
                              const reason = window.prompt("Reason (audited):") ?? "Manual extension";
                              if (reason.length < 5) return;
                              escrow(o.id as string, "extend", reason, h);
                            }}
                          >
                            Extend
                          </button>
                        )}
                        <button
                          disabled={busy}
                          className={`${BTN} bg-secondary text-foreground`}
                          onClick={() => { setActionFor(o.id as string); setNote(""); }}
                        >
                          Force action
                        </button>
                      </>
                    )}
                  </span>
                </div>
              </div>
            );
          })}
          {orders.length === 0 && (
            <p className="py-12 text-center text-sm text-muted-foreground">No orders found.</p>
          )}
        </div>
      )}
    </div>
  );
}
