"use client";

import { useEffect, useState, useTransition } from "react";
import {
  listSellerApplicationsAction,
  reviewSellerApplicationAction,
} from "@/server/actions/admin";
import { GENERIC_STATUS_CLS, dateTime } from "@/lib/format";

type Applications = Awaited<ReturnType<typeof listSellerApplicationsAction>>;
type Application = Applications[number];

const STATUS_CLS: Record<string, string> = {
  ...GENERIC_STATUS_CLS,
  pending: "bg-yellow-500/15 text-yellow-400",
  approved: "bg-accent/15 text-accent",
  rejected: "bg-destructive/15 text-destructive",
  suspended: "bg-destructive/15 text-destructive",
};

function Skeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="bg-card border border-border rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-3">
            <div className="h-3 w-32 rounded bg-secondary" />
            <div className="h-4 w-16 rounded bg-secondary/70" />
          </div>
          <div className="h-2.5 w-48 rounded bg-secondary/50" />
          <div className="h-2.5 w-64 rounded bg-secondary/40" />
          <div className="h-2.5 w-40 rounded bg-secondary/30" />
        </div>
      ))}
    </div>
  );
}

function ApplicationCard({ app, onReviewed }: { app: Application; onReviewed: () => void }) {
  const [note, setNote] = useState(app.admin_note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const statusCls = STATUS_CLS[app.status] ?? "bg-muted text-muted-foreground";

  function review(approve: boolean) {
    if (!approve && !note.trim()) {
      setError("A note is required when rejecting.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await reviewSellerApplicationAction({
          applicationId: app.id,
          approve,
          note: note.trim() || undefined,
        });
        onReviewed();
      } catch (e) {
        setError((e as Error)?.message ?? "Something went wrong.");
      }
    });
  }

  return (
    <div className="bg-card border border-border rounded-lg p-3 space-y-2">
      {/* Header row */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-bold text-sm">{app.username}</span>
        <span className="text-xs text-muted-foreground">{app.email}</span>
        <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${statusCls}`}>
          {app.status.toUpperCase()}
        </span>
        <span className="text-[10px] text-muted-foreground ml-auto">
          Applied {dateTime(app.created_at)}
        </span>
      </div>

      {/* Application details */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1 text-[11px]">
        {app.full_name && (
          <div>
            <span className="text-muted-foreground">Full name: </span>
            <span>{app.full_name}</span>
          </div>
        )}
        {app.display_name && (
          <div>
            <span className="text-muted-foreground">Display name: </span>
            <span>{app.display_name}</span>
          </div>
        )}
        {app.country && (
          <div>
            <span className="text-muted-foreground">Country: </span>
            <span>{app.country}</span>
          </div>
        )}
        {app.years_experience != null && (
          <div>
            <span className="text-muted-foreground">Experience: </span>
            <span>{app.years_experience} yrs</span>
          </div>
        )}
        {app.monthly_volume != null && (
          <div>
            <span className="text-muted-foreground">Monthly volume: </span>
            <span>${(app.monthly_volume / 100).toFixed(2)}</span>
          </div>
        )}
        {app.product_categories && (
          <div>
            <span className="text-muted-foreground">Categories: </span>
            <span>{app.product_categories}</span>
          </div>
        )}
        {app.source_of_goods && (
          <div>
            <span className="text-muted-foreground">Source: </span>
            <span>{app.source_of_goods}</span>
          </div>
        )}
        {app.usdt_network && (
          <div>
            <span className="text-muted-foreground">USDT network: </span>
            <span>{app.usdt_network}</span>
          </div>
        )}
        {app.telegram && (
          <div>
            <span className="text-muted-foreground">Telegram: </span>
            <span>{app.telegram}</span>
          </div>
        )}
        {app.whatsapp && (
          <div>
            <span className="text-muted-foreground">WhatsApp: </span>
            <span>{app.whatsapp}</span>
          </div>
        )}
        {app.wechat && (
          <div>
            <span className="text-muted-foreground">WeChat: </span>
            <span>{app.wechat}</span>
          </div>
        )}
      </div>

      {app.experience && (
        <p className="text-[11px] text-muted-foreground">
          <span className="font-semibold text-foreground">Experience: </span>
          {app.experience}
        </p>
      )}
      {app.usdt_payout_address && (
        <p className="text-[11px] font-mono text-muted-foreground break-all">
          <span className="font-sans font-semibold text-foreground">Payout addr: </span>
          {app.usdt_payout_address}
        </p>
      )}
      {app.portfolio && (
        <p className="text-[11px]">
          <span className="text-muted-foreground">Portfolio: </span>
          <a
            href={app.portfolio}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            {app.portfolio}
          </a>
        </p>
      )}

      {app.admin_note && app.status !== "pending" && (
        <p className="text-[11px] italic text-muted-foreground">Admin note: {app.admin_note}</p>
      )}

      {/* Actions for pending */}
      {app.status === "pending" && (
        <div className="pt-1 space-y-2">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Admin note (required for rejection)…"
            className="w-full bg-secondary border border-border rounded-md px-2 py-1 text-xs"
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={() => review(true)}
              disabled={isPending}
              className="px-3 py-1.5 rounded-md text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {isPending ? "Processing…" : "Approve"}
            </button>
            <button
              onClick={() => review(false)}
              disabled={isPending}
              className="px-3 py-1.5 rounded-md text-xs font-bold bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-60"
            >
              {isPending ? "Processing…" : "Reject"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function AdminSellersClient() {
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function load() {
    startTransition(async () => {
      try {
        const data = await listSellerApplicationsAction();
        setApps(data);
      } catch (e) {
        setError((e as Error)?.message ?? "Failed to load.");
      } finally {
        setLoading(false);
      }
    });
  }

  useEffect(() => {
    load();
  }, []);

  const pending = apps.filter((a) => a.status === "pending");
  const reviewed = apps.filter((a) => a.status !== "pending");

  return (
    <div className="space-y-3">
      <h1 className="font-display text-2xl">SELLER APPLICATIONS</h1>

      {loading ? (
        <Skeleton />
      ) : error ? (
        <p className="py-12 text-center text-sm text-destructive">{error}</p>
      ) : apps.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          No seller applications found.
        </p>
      ) : (
        <div className="space-y-4">
          {pending.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground">
                Pending ({pending.length})
              </p>
              {pending.map((app) => (
                <ApplicationCard key={app.id} app={app} onReviewed={load} />
              ))}
            </div>
          )}
          {reviewed.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground">
                Reviewed ({reviewed.length})
              </p>
              {reviewed.map((app) => (
                <ApplicationCard key={app.id} app={app} onReviewed={load} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
