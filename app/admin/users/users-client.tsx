"use client";

import { useEffect, useState, useTransition } from "react";
import {
  adminListUsersAction,
  adminUserActionAction,
  adminAdjustWalletAction,
  adminSetUserRoleAction,
  adminSetSellerLevelAction,
} from "@/server/actions/admin";
import { dateTime, usdt } from "@/lib/format";

type Users = Awaited<ReturnType<typeof adminListUsersAction>>;
type User = Users[number];

const STATUS_CLS: Record<string, string> = {
  buyer: "bg-secondary text-muted-foreground",
  seller: "bg-accent/15 text-accent",
  support: "bg-blue-500/15 text-blue-400",
  finance: "bg-purple-500/15 text-purple-400",
  admin: "bg-destructive/15 text-destructive",
};

function Skeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="bg-card border border-border rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-3">
            <div className="h-3 w-28 rounded bg-secondary" />
            <div className="h-4 w-14 rounded bg-secondary/70" />
          </div>
          <div className="h-2.5 w-52 rounded bg-secondary/50" />
          <div className="h-2.5 w-40 rounded bg-secondary/40" />
        </div>
      ))}
    </div>
  );
}

function UserCard({ user, onRefresh }: { user: User; onRefresh: () => void }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Adjust balance form state
  const [adjOpen, setAdjOpen] = useState(false);
  const [adjAmount, setAdjAmount] = useState("");
  const [adjNote, setAdjNote] = useState("");
  const [adjError, setAdjError] = useState<string | null>(null);

  const roleCls = STATUS_CLS[user.role] ?? "bg-secondary text-muted-foreground";

  function doAction(action: "ban" | "unban" | "freeze_wallet" | "unfreeze_wallet") {
    setError(null);
    startTransition(async () => {
      try {
        await adminUserActionAction({ userId: user.id, action });
        onRefresh();
      } catch (e) {
        setError((e as Error)?.message ?? "Action failed.");
      }
    });
  }

  function doSetRole(role: string) {
    setError(null);
    startTransition(async () => {
      try {
        await adminSetUserRoleAction({
          userId: user.id,
          role: role as "buyer" | "seller" | "support" | "finance" | "admin",
        });
        onRefresh();
      } catch (e) {
        setError((e as Error)?.message ?? "Failed to update role.");
      }
    });
  }

  function doSetLevel(level: number) {
    setError(null);
    startTransition(async () => {
      try {
        await adminSetSellerLevelAction({ userId: user.id, level });
        onRefresh();
      } catch (e) {
        setError((e as Error)?.message ?? "Failed to update level.");
      }
    });
  }

  function doAdjust() {
    const cents = Math.round(parseFloat(adjAmount) * 100);
    if (isNaN(cents)) {
      setAdjError("Enter a valid USDT amount (positive to add, negative to deduct).");
      return;
    }
    if (!adjNote.trim()) {
      setAdjError("Note is required.");
      return;
    }
    setAdjError(null);
    startTransition(async () => {
      try {
        await adminAdjustWalletAction({ userId: user.id, cents, note: adjNote.trim() });
        setAdjOpen(false);
        setAdjAmount("");
        setAdjNote("");
        onRefresh();
      } catch (e) {
        setAdjError((e as Error)?.message ?? "Adjustment failed.");
      }
    });
  }

  return (
    <div className="bg-card border border-border rounded-lg p-3 space-y-2">
      {/* Header */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-bold text-sm">{user.username}</span>
        <span className="text-xs text-muted-foreground">{user.email}</span>
        <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${roleCls}`}>
          {user.role.toUpperCase()}
        </span>
        {user.seller_level != null && user.role === "seller" && (
          <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-accent/10 text-accent">
            LVL {user.seller_level}
          </span>
        )}
        {user.is_banned ? (
          <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-destructive/15 text-destructive">
            BANNED
          </span>
        ) : null}
        {user.wallet_frozen ? (
          <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-yellow-500/15 text-yellow-400">
            FROZEN
          </span>
        ) : null}
        <span className="text-[10px] text-muted-foreground ml-auto">
          Joined {dateTime(user.created_at)}
        </span>
      </div>

      {/* Wallet info */}
      <div className="flex gap-4 text-[11px] flex-wrap">
        <span>
          <span className="text-muted-foreground">Available: </span>
          <span className="font-mono text-accent">{usdt(user.available_cents ?? 0)}</span>
        </span>
        <span>
          <span className="text-muted-foreground">Pending: </span>
          <span className="font-mono">{usdt(user.pending_cents ?? 0)}</span>
        </span>
        <span>
          <span className="text-muted-foreground">Frozen: </span>
          <span className="font-mono">{usdt(user.frozen_cents ?? 0)}</span>
        </span>
        <span>
          <span className="text-muted-foreground">Total sales: </span>
          <span className="font-mono">{usdt(user.total_sales ?? 0)}</span>
        </span>
      </div>

      {/* Actions */}
      <div className="flex gap-2 flex-wrap items-center pt-1">
        {/* Ban / Unban */}
        {user.is_banned ? (
          <button
            onClick={() => doAction("unban")}
            disabled={isPending}
            className="px-3 py-1.5 rounded-md text-xs font-bold bg-secondary hover:bg-border disabled:opacity-60"
          >
            Unban
          </button>
        ) : (
          <button
            onClick={() => doAction("ban")}
            disabled={isPending}
            className="px-3 py-1.5 rounded-md text-xs font-bold bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-60"
          >
            Ban
          </button>
        )}

        {/* Freeze / Unfreeze wallet */}
        {user.wallet_frozen ? (
          <button
            onClick={() => doAction("unfreeze_wallet")}
            disabled={isPending}
            className="px-3 py-1.5 rounded-md text-xs font-bold bg-secondary hover:bg-border disabled:opacity-60"
          >
            Unfreeze wallet
          </button>
        ) : (
          <button
            onClick={() => doAction("freeze_wallet")}
            disabled={isPending}
            className="px-3 py-1.5 rounded-md text-xs font-bold bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 disabled:opacity-60"
          >
            Freeze wallet
          </button>
        )}

        {/* Role select */}
        <select
          value={user.role}
          disabled={isPending}
          onChange={(e) => doSetRole(e.target.value)}
          className="bg-secondary border border-border rounded-md px-2 py-1 text-xs disabled:opacity-60"
        >
          {["buyer", "seller", "support", "finance", "admin"].map((r) => (
            <option key={r} value={r}>
              Role: {r}
            </option>
          ))}
        </select>

        {/* Seller level — only for approved sellers */}
        {user.role === "seller" && (
          <select
            value={user.seller_level ?? 1}
            disabled={isPending}
            onChange={(e) => doSetLevel(Number(e.target.value))}
            className="bg-secondary border border-border rounded-md px-2 py-1 text-xs disabled:opacity-60"
          >
            {[1, 2, 3, 4, 5].map((l) => (
              <option key={l} value={l}>
                Level {l}
              </option>
            ))}
          </select>
        )}

        {/* Adjust balance */}
        <button
          onClick={() => setAdjOpen((v) => !v)}
          className="px-3 py-1.5 rounded-md text-xs font-bold bg-secondary hover:bg-border"
        >
          Adjust balance
        </button>
      </div>

      {/* Inline adjust form */}
      {adjOpen && (
        <div className="pt-1 space-y-2 border-t border-border">
          <p className="text-[10px] text-muted-foreground">
            Enter positive USDT to credit, negative to deduct.
          </p>
          <div className="flex gap-2 flex-wrap">
            <input
              type="number"
              step="0.01"
              value={adjAmount}
              onChange={(e) => setAdjAmount(e.target.value)}
              placeholder="±USDT amount"
              className="bg-secondary border border-border rounded-md px-2 py-1 text-xs w-36"
            />
            <input
              value={adjNote}
              onChange={(e) => setAdjNote(e.target.value)}
              placeholder="Note (required)"
              className="bg-secondary border border-border rounded-md px-2 py-1 text-xs flex-1 min-w-[160px]"
            />
            <button
              onClick={doAdjust}
              disabled={isPending}
              className="px-3 py-1.5 rounded-md text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {isPending ? "Saving…" : "Apply"}
            </button>
          </div>
          {adjError && <p className="text-xs text-destructive">{adjError}</p>}
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

export function AdminUsersClient() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function load(query: string) {
    startTransition(async () => {
      try {
        const data = await adminListUsersAction({ q: query });
        setUsers(data);
      } catch (e) {
        setError((e as Error)?.message ?? "Failed to load users.");
      } finally {
        setLoading(false);
      }
    });
  }

  useEffect(() => {
    load(q);
  }, [q]);

  return (
    <div className="space-y-3">
      <h1 className="font-display text-2xl">USERS</h1>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search username or email…"
        className="bg-secondary border border-border rounded-md px-2 py-1 text-xs w-full max-w-sm"
      />

      {loading ? (
        <Skeleton />
      ) : error ? (
        <p className="py-12 text-center text-sm text-destructive">{error}</p>
      ) : users.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">No users found.</p>
      ) : (
        <div className="space-y-2">
          {users.map((user) => (
            <UserCard key={user.id} user={user} onRefresh={() => load(q)} />
          ))}
        </div>
      )}
    </div>
  );
}
