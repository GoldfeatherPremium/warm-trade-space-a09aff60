"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, LayoutGrid, MessageSquare, Bell, User } from "lucide-react";
import { useLiveCounts } from "./live-updates";

const ITEMS = [
  { href: "/", label: "Home", icon: Home, match: (p: string) => p === "/" },
  {
    href: "/browse",
    label: "Browse",
    icon: LayoutGrid,
    match: (p: string) => p.startsWith("/browse"),
  },
  {
    href: "/chat",
    label: "Chat",
    icon: MessageSquare,
    match: (p: string) => p.startsWith("/chat"),
    badge: "messages" as const,
  },
  {
    href: "/notifications",
    label: "Alerts",
    icon: Bell,
    match: (p: string) => p.startsWith("/notifications"),
    badge: "notifications" as const,
  },
  {
    href: "/account",
    label: "Account",
    icon: User,
    match: (p: string) => p.startsWith("/account") || p.startsWith("/dashboard"),
  },
];

/**
 * Native-feel mobile bottom navigation. Hidden on >= md (desktop uses the
 * header). Sits above the iOS home indicator via safe-area padding.
 */
export function BottomNav() {
  const pathname = usePathname();
  const { unreadMessages, unreadNotifications } = useLiveCounts();

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-40 glass border-x-0 border-b-0"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Primary"
    >
      <div className="grid grid-cols-5 h-14">
        {ITEMS.map((it) => {
          const active = it.match(pathname);
          const count =
            it.badge === "messages"
              ? unreadMessages
              : it.badge === "notifications"
                ? unreadNotifications
                : 0;
          return (
            <Link
              key={it.href}
              href={it.href}
              className={`relative flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors ${
                active ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="relative">
                <it.icon
                  className={`size-5 ${active ? "drop-shadow-[0_0_6px_var(--primary-glow)]" : ""}`}
                />
                {count > 0 && (
                  <span className="absolute -top-1.5 -right-2 min-w-[15px] h-[15px] px-0.5 rounded-full bg-accent text-accent-foreground text-[8px] font-bold grid place-items-center leading-none">
                    {count > 99 ? "99+" : count}
                  </span>
                )}
              </span>
              {it.label}
              {active && (
                <span className="absolute top-0 h-0.5 w-8 rounded-full bg-primary" aria-hidden />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
