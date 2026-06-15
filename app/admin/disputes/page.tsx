"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { Sparkles, AlertTriangle, Clock } from "lucide-react";
import { listDisputes, resolveDispute, aiAssistDispute } from "@/server/actions/admin";
import { GENERIC_STATUS_CLS, dateTime, usdt } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function SlaBadge({
  openedAt,
  slaHours,
  resolved,
}: {
  openedAt: number;
  slaHours: number;
  resolved: boolean;
}) {
  if (resolved) return null;
  const deadline = openedAt + slaHours * 3600_000;
  const remaining = deadline - Date.now();
  const overdue = remaining < 0;
  const hours = Math.round(Math.abs(remaining) / 3600_000);
  return (
    <span
      className={`text-[9px] font-bold px-2 py-0.5 rounded inline-flex items-center gap-1 ${
        overdue
          ? "bg-destructive/90 text-white"
          : remaining < 12 * 3600_000
            ? "bg-amber-500/90 text-black"
            : "bg-secondary text-foreground/80"
      }`}
      title={`SLA target ${slaHours}h from open`}
    >
      {overdue ? <AlertTriangle className="size-2.5" /> : <Clock className="size-2.5" />}
      {overdue ? `SLA +${hours}h` : `SLA ${hours}h`}
    </span>
  );
}

export default function AdminDisputes() {
  const slaHours = 72;
  const [data, setData] = useState<Awaited<ReturnType<typeof listDisputes>> | null>(null);
  const [resolving, setResolving] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [partial, setPartial] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let alive = true;
    const load = () =>
      listDisputes()
        .then((d) => {
          if (alive) setData(d);
        })
        .catch(() => {});
    load();
    const t = setInterval(load, 15_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  const refresh = () =>
    listDisputes()
      .then((d) => setData(d))
      .catch(() => {});

  const resolve = (vars: {
    disputeId: string;
    resolution: "refund_full" | "refund_partial" | "release_seller";
    partialRefundUsdt?: number;
    note: string;
  }) => {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      try {
        await resolveDispute(vars);
        setSuccess("Dispute resolved");
        setResolving(null);
        setNote("");
        setPartial("");
        await refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error");
      }
    });
  };

  return (
    <div className="space-y-3">
      <h1 className="font-display text-2xl">DISPUTES CENTER</h1>
      {error && (
        <p className="text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
          {error}
        </p>
      )}
      {success && (
        <p className="text-xs text-accent bg-accent/10 border border-accent/30 rounded-md px-3 py-2">
          {success}
        </p>
      )}
      {data?.disputes.length === 0 && (
        <p className="py-12 text-center text-sm text-muted-foreground">No disputes 🎉</p>
      )}
      {data?.disputes.map((dd) => (
        <div
          key={dd.id as string}
          className="bg-card border border-border rounded-lg p-4 space-y-2"
        >
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <Link
              href={`/orders/${dd.order_id as string}`}
              className="font-mono font-bold text-primary"
            >
              {dd.order_no}
            </Link>
            <span className="truncate">{dd.product_title}</span>
            <span
              className={`text-[9px] font-bold px-2 py-0.5 rounded ${GENERIC_STATUS_CLS[dd.status as string] ?? "bg-muted"}`}
            >
              {(dd.status as string).replaceAll("_", " ").toUpperCase()}
            </span>
            <SlaBadge
              openedAt={dd.created_at as number}
              slaHours={slaHours}
              resolved={dd.status === "resolved"}
            />
            <Link
              href={`/disputes/${dd.order_id as string}`}
              className="text-[10px] font-bold text-primary underline"
            >
              Open vault →
            </Link>
            <span className="font-mono text-accent ml-auto">{usdt(dd.total_cents as number)}</span>
          </div>

          <p className="text-[10px] text-muted-foreground">
            buyer {dd.buyer_name} vs seller {dd.seller_name} · opened{" "}
            {dateTime(dd.created_at as number)} · reason:{" "}
            <b className="text-foreground">{(dd.reason as string).replaceAll("_", " ")}</b>
          </p>
          {dd.description && (
            <p className="text-xs bg-secondary/60 rounded-md p-2">
              <b>Buyer:</b> {dd.description}
            </p>
          )}
          {dd.seller_response && (
            <p className="text-xs bg-secondary/60 rounded-md p-2">
              <b>Seller:</b> {dd.seller_response}
            </p>
          )}
          <AiAssist
            orderId={dd.order_id as string}
            onCopy={(reply) => setNote(reply.slice(0, 200))}
          />
          {dd.status !== "resolved" ? (
            resolving === dd.id ? (
              <div className="flex gap-2 flex-wrap items-center pt-1">
                <Input
                  placeholder="Decision note (mandatory)"
                  className="h-8 text-xs w-56"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={isPending || note.length < 5}
                  onClick={() =>
                    resolve({ disputeId: dd.id as string, resolution: "refund_full", note })
                  }
                >
                  Full refund
                </Button>
                <Input
                  placeholder="USDT"
                  type="number"
                  className="h-8 text-xs w-20"
                  value={partial}
                  onChange={(e) => setPartial(e.target.value)}
                />
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={isPending || note.length < 5 || !partial}
                  onClick={() =>
                    resolve({
                      disputeId: dd.id as string,
                      resolution: "refund_partial",
                      partialRefundUsdt: parseFloat(partial),
                      note,
                    })
                  }
                >
                  Partial refund
                </Button>
                <Button
                  size="sm"
                  disabled={isPending || note.length < 5}
                  onClick={() =>
                    resolve({
                      disputeId: dd.id as string,
                      resolution: "release_seller",
                      note,
                    })
                  }
                >
                  Release to seller
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setResolving(null)}>
                  Cancel
                </Button>
              </div>
            ) : (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setResolving(dd.id as string);
                  setNote("");
                }}
              >
                Resolve…
              </Button>
            )
          ) : (
            <p className="text-xs text-accent font-bold">
              Resolved: {(dd.resolution as string)?.replaceAll("_", " ")}
              {dd.resolution_cents ? ` · ${usdt(dd.resolution_cents as number)}` : ""} ·{" "}
              {dateTime(dd.resolved_at as number)}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

function AiAssist({ orderId, onCopy }: { orderId: string; onCopy: (reply: string) => void }) {
  const [result, setResult] = useState<{
    category: string;
    severity: string;
    summary: string;
    suggestedReply: string;
    suggestedResolution: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const run = () => {
    setError(null);
    startTransition(async () => {
      try {
        const r = await aiAssistDispute({ orderId });
        setResult(r);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error");
      }
    });
  };
  return (
    <div className="rounded-md border border-primary/30 bg-primary/5 p-2 space-y-1">
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="secondary"
          className="h-7 text-[10px]"
          onClick={run}
          disabled={isPending}
        >
          <Sparkles className="size-3 mr-1" />
          {isPending ? "Analysing…" : result ? "Re-analyse" : "AI assist"}
        </Button>
        {result && (
          <span className="text-[10px] text-muted-foreground">
            {result.category} · severity {result.severity} · suggests{" "}
            <b className="text-foreground">{result.suggestedResolution.replaceAll("_", " ")}</b>
          </span>
        )}
      </div>
      {error && <p className="text-[10px] text-destructive">{error}</p>}
      {result && (
        <div className="space-y-1 text-[11px]">
          <p className="text-muted-foreground">{result.summary}</p>
          <div className="bg-secondary/60 rounded p-2 whitespace-pre-wrap">
            {result.suggestedReply}
          </div>
          <button
            type="button"
            className="text-[10px] text-primary font-bold"
            onClick={() => {
              navigator.clipboard?.writeText(result.suggestedReply).catch(() => {});
              onCopy(result.suggestedReply);
            }}
          >
            Copy reply
          </button>
        </div>
      )}
    </div>
  );
}
