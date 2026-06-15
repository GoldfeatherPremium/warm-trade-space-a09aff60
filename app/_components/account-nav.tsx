"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, MessageSquare } from "lucide-react";
import { logoutAction } from "@/server/actions/auth";
import { useLiveCounts } from "./live-updates";

type Me = { id: string; username: string; role: string; seller_status: string } | null;

const STAFF = ["admin", "support", "finance"];

function Badge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-0.5 rounded-full bg-accent text-accent-foreground text-[9px] font-bold grid place-items-center leading-none">
      {count > 99 ? "99+" : count}
    </span>
  );
}

/**
 * Header account island. Fetches the session client-side so the public pages
 * it lives in stay statically prerendered (no per-request cookie read).
 * Unread counts are streamed via SSE (LiveUpdatesProvider).
 */
export function AccountNav() {
  const router = useRouter();
  const [me, setMe] = useState<Me | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { unreadMessages, unreadNotifications } = useLiveCounts();

  useEffect(() => {
    let alive = true;
    fetch("/api/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => alive && setMe(d.user ?? null))
      .catch(() => alive && setMe(null));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  if (me === undefined) {
    return <div className="size-9 rounded-md bg-secondary/60 animate-pulse" />;
  }

  if (!me) {
    return (
      <Link
        href="/auth"
        className="text-xs font-bold px-3 py-2 bg-primary text-primary-foreground rounded-md shrink-0"
      >
        SIGN IN
      </Link>
    );
  }

  const isStaff = STAFF.includes(me.role);
  const isSeller = me.seller_status === "approved";

  const links: Array<{ href: string; label: string }> = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/orders", label: "My orders" },
    { href: "/wallet", label: "Wallet" },
    ...(isSeller ? [{ href: "/seller", label: "Seller center" }] : []),
    ...(isStaff ? [{ href: "/admin", label: "Admin" }] : []),
    { href: "/account", label: "Account" },
  ];

  async function signOut() {
    await logoutAction();
    setMe(null);
    setOpen(false);
    router.push("/");
    router.refresh();
  }

  return (
    <div className="flex items-center gap-1 shrink-0">
      {/* Chat */}
      <Link
        href="/chat"
        className="relative size-9 rounded-md grid place-items-center text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
        aria-label="Messages"
      >
        <MessageSquare className="size-4" />
        <Badge count={unreadMessages} />
      </Link>

      {/* Notifications icon */}
      <Link
        href="/notifications"
        className="relative size-9 rounded-md grid place-items-center text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
        aria-label="Notifications"
      >
        <Bell className="size-4" />
        <Badge count={unreadNotifications} />
      </Link>

      {/* Account avatar + dropdown */}
      <div className="relative" ref={ref}>
        <button
          onClick={() => setOpen((v) => !v)}
          className="size-9 rounded-full bg-primary/20 border border-primary/40 grid place-items-center text-xs font-bold text-primary uppercase hover:bg-primary/30 transition-colors"
          aria-label="Account menu"
          aria-expanded={open}
        >
          {me.username.slice(0, 2)}
        </button>
        {open && (
          <div className="absolute right-0 mt-2 w-48 bg-card border border-border rounded-lg shadow-xl overflow-hidden z-50">
            <div className="px-3 py-2 border-b border-border">
              <p className="text-xs font-bold truncate">{me.username}</p>
              <p className="text-[10px] text-muted-foreground capitalize">{me.role}</p>
            </div>
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="block px-3 py-2 text-xs hover:bg-secondary/60"
              >
                {l.label}
              </Link>
            ))}
            <button
              onClick={signOut}
              className="block w-full text-left px-3 py-2 text-xs text-destructive hover:bg-secondary/60 border-t border-border"
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
