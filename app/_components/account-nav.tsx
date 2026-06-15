"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { logoutAction } from "@/server/actions/auth";
import { useLiveCounts } from "./live-updates";

type Me = { id: string; username: string; role: string; seller_status: string } | null;

const STAFF = ["admin", "support", "finance"];

/**
 * Header account island. Fetches the session client-side so the public pages
 * it lives in stay statically prerendered (no per-request cookie read).
 */
export function AccountNav() {
  const router = useRouter();
  const [me, setMe] = useState<Me | undefined>(undefined); // undefined = loading
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
    return <div className="ml-auto sm:ml-0 size-9 rounded-md bg-secondary/60 animate-pulse" />;
  }

  if (!me) {
    return (
      <Link
        href="/auth"
        className="ml-auto sm:ml-0 text-xs font-bold px-3 py-2 bg-primary text-primary-foreground rounded-md shrink-0"
      >
        SIGN IN
      </Link>
    );
  }

  const isStaff = STAFF.includes(me.role);
  const isSeller = me.seller_status === "approved";
  const totalUnread = unreadMessages + unreadNotifications;

  const links: Array<{ href: string; label: string; badge?: number }> = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/orders", label: "My orders" },
    { href: "/wallet", label: "Wallet" },
    { href: "/chat", label: "Messages", badge: unreadMessages },
    ...(isSeller ? [{ href: "/seller", label: "Seller center" }] : []),
    ...(isStaff ? [{ href: "/admin", label: "Admin" }] : []),
    { href: "/notifications", label: "Notifications", badge: unreadNotifications },
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
    <div className="ml-auto sm:ml-0 relative shrink-0" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative size-9 rounded-full bg-primary/20 border border-primary/40 grid place-items-center text-xs font-bold text-primary uppercase"
        aria-label="Account menu"
        aria-expanded={open}
      >
        {me.username.slice(0, 2)}
        {totalUnread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 size-4 rounded-full bg-destructive text-[9px] font-bold text-white grid place-items-center leading-none">
            {totalUnread > 99 ? "99+" : totalUnread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-52 bg-card border border-border rounded-lg shadow-xl overflow-hidden z-50">
          <div className="px-3 py-2 border-b border-border">
            <p className="text-xs font-bold truncate">{me.username}</p>
            <p className="text-[10px] text-muted-foreground capitalize">{me.role}</p>
          </div>
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="flex items-center justify-between px-3 py-2 text-xs hover:bg-secondary/60"
            >
              <span>{l.label}</span>
              {l.badge && l.badge > 0 ? (
                <span className="size-4 rounded-full bg-destructive text-[9px] font-bold text-white grid place-items-center">
                  {l.badge > 99 ? "99+" : l.badge}
                </span>
              ) : null}
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
  );
}
