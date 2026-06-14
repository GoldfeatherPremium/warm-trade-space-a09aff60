"use client";

import { useEffect, useState, useTransition } from "react";
import { listVerifications, reviewVerification } from "@/server/actions/admin";
import { Button } from "@/components/ui/button";
import { VerificationBadge } from "@/components/seller-badge";
import { timeAgo } from "@/lib/format";

export default function VerificationsAdmin() {
  const [status, setStatus] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [data, setData] = useState<Awaited<ReturnType<typeof listVerifications>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const load = () =>
    listVerifications({ status })
      .then((d) => setData(d))
      .catch(() => {});

  useEffect(() => {
    let alive = true;
    listVerifications({ status })
      .then((d) => {
        if (alive) setData(d);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [status]);

  const review = (vars: { id: string; decision: "approved" | "rejected"; adminNote?: string }) => {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      try {
        await reviewVerification(vars);
        setSuccess("Decision recorded");
        load();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error");
      }
    });
  };

  const isLoading = !data;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="font-display text-2xl">SELLER VERIFICATIONS</h1>
        <div className="flex gap-1">
          {(["pending", "approved", "rejected", "all"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`px-3 py-1.5 text-[11px] font-bold rounded-md uppercase ${
                status === s ? "bg-primary text-primary-foreground" : "bg-secondary hover:bg-border"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

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

      {isLoading && <div className="py-10 text-center text-xs text-muted-foreground">Loading…</div>}
      {data?.rows.length === 0 && (
        <div className="py-10 text-center text-xs text-muted-foreground">
          No {status} applications.
        </div>
      )}

      <div className="space-y-2">
        {data?.rows.map((r) => (
          <VerificationRow
            key={r.id}
            row={r}
            onReview={(decision, adminNote) => review({ id: r.id, decision, adminNote })}
            disabled={isPending || r.status !== "pending"}
          />
        ))}
      </div>
    </div>
  );
}

function VerificationRow({
  row,
  onReview,
  disabled,
}: {
  row: Awaited<ReturnType<typeof listVerifications>>["rows"][number];
  onReview: (decision: "approved" | "rejected", adminNote?: string) => void;
  disabled: boolean;
}) {
  const [note, setNote] = useState("");
  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-bold text-sm">{row.username}</span>
            <VerificationBadge tier={row.tier_requested} size="xs" />
            <span
              className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                row.status === "pending"
                  ? "bg-yellow-500/15 text-yellow-400"
                  : row.status === "approved"
                    ? "bg-emerald-500/15 text-emerald-400"
                    : "bg-destructive/15 text-destructive"
              }`}
            >
              {row.status}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {row.legal_name} · {row.country} · submitted {timeAgo(row.created_at)}
          </p>
        </div>
        {row.status === "pending" && (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={disabled}
              onClick={() => onReview("rejected", note || undefined)}
            >
              Reject
            </Button>
            <Button
              size="sm"
              disabled={disabled}
              onClick={() => onReview("approved", note || undefined)}
            >
              Approve
            </Button>
          </div>
        )}
      </div>

      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
        {row.business_name && <Field label="Business">{row.business_name}</Field>}
        {row.business_registration && (
          <Field label="Registration #">{row.business_registration}</Field>
        )}
        {row.id_doc_ref && <Field label="ID document ref">{row.id_doc_ref}</Field>}
        {row.contact_phone && <Field label="Phone (staff-only)">{row.contact_phone}</Field>}
        {row.contact_whatsapp && (
          <Field label="WhatsApp (staff-only)">{row.contact_whatsapp}</Field>
        )}
        {row.contact_telegram && (
          <Field label="Telegram (staff-only)">{row.contact_telegram}</Field>
        )}
        {row.notes && <Field label="Notes">{row.notes}</Field>}
        {row.admin_note && <Field label="Admin note">{row.admin_note}</Field>}
      </dl>

      {row.status === "pending" && (
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional note shown to seller"
          className="w-full bg-secondary border border-border rounded-md px-3 py-1.5 text-xs"
        />
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-muted-foreground uppercase tracking-wider text-[9px] font-bold">
        {label}
      </dt>
      <dd className="text-foreground">{children}</dd>
    </div>
  );
}
