"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { listVerificationsAction, reviewVerificationAction } from "@/server/actions/admin";
import { dateTime } from "@/lib/format";

type Verification = Awaited<ReturnType<typeof listVerificationsAction>>[number];
type StatusFilter = "pending" | "approved" | "rejected" | "all";

const TIER_META: Record<string, { label: string; cls: string }> = {
  verified: { label: "Verified", cls: "bg-primary/15 text-primary" },
  trusted: { label: "Trusted", cls: "bg-accent/15 text-accent" },
  elite: { label: "Elite", cls: "bg-primary/15 text-primary" },
};

const STATUS_META: Record<string, { label: string; cls: string }> = {
  pending: { label: "Pending", cls: "bg-warning/15 text-warning" },
  approved: { label: "Approved", cls: "bg-success/15 text-success" },
  rejected: { label: "Rejected", cls: "bg-destructive/15 text-destructive" },
};

const BTN_CLS = "px-3 py-1.5 rounded-md text-xs font-bold";
const INPUT_CLS =
  "bg-secondary border border-border rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary/50";

function VerificationRow({ v, onRefresh }: { v: Verification; onRefresh: () => void }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const tierMeta = TIER_META[v.tier_requested] ?? {
    label: v.tier_requested,
    cls: "bg-secondary text-muted-foreground",
  };
  const statusMeta = STATUS_META[v.status] ?? {
    label: v.status,
    cls: "bg-secondary text-muted-foreground",
  };

  async function decide(decision: "approved" | "rejected") {
    setBusy(true);
    setError(null);
    startTransition(async () => {
      try {
        await reviewVerificationAction({
          id: v.id,
          decision,
          adminNote: note.trim() || undefined,
        });
        onRefresh();
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Action failed.");
        setBusy(false);
      }
    });
  }

  return (
    <div className="bg-card border border-border rounded-lg p-3 space-y-2">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm">{v.username}</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${tierMeta.cls}`}>
              {tierMeta.label.toUpperCase()}
            </span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${statusMeta.cls}`}>
              {statusMeta.label.toUpperCase()}
            </span>
          </div>
          {v.evidence && <p className="text-xs text-muted-foreground line-clamp-2">{v.evidence}</p>}
        </div>
        <div className="text-[10px] text-muted-foreground shrink-0">{dateTime(v.created_at)}</div>
      </div>

      {v.status === "pending" && (
        <div className="pt-1 border-t border-border space-y-2">
          <input
            type="text"
            className={`${INPUT_CLS} w-full`}
            placeholder="Admin note (optional)…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex gap-2">
            <button
              disabled={busy}
              onClick={() => decide("approved")}
              className={`${BTN_CLS} bg-success text-success-foreground disabled:opacity-50`}
            >
              {busy ? "…" : "Approve"}
            </button>
            <button
              disabled={busy}
              onClick={() => decide("rejected")}
              className={`${BTN_CLS} bg-destructive text-destructive-foreground disabled:opacity-50`}
            >
              {busy ? "…" : "Reject"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function VerificationsClient() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  const [verifications, setVerifications] = useState<Verification[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listVerificationsAction({ status: statusFilter });
      setVerifications(data);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const STATUSES: StatusFilter[] = ["pending", "approved", "rejected", "all"];

  return (
    <div className="space-y-3">
      <h1 className="font-display text-2xl">Verifications</h1>

      <div className="flex gap-1 flex-wrap">
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-md text-xs font-bold ${
              statusFilter === s
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-foreground"
            }`}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : verifications.length === 0 ? (
        <p className="text-sm text-muted-foreground">No verifications found.</p>
      ) : (
        <div className="space-y-2">
          {verifications.map((v) => (
            <VerificationRow key={v.id} v={v} onRefresh={load} />
          ))}
        </div>
      )}
    </div>
  );
}
