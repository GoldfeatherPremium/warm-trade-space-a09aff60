import { Link, useRouterState } from "@tanstack/react-router";
import { Home, LayoutGrid, Package, User, Trophy } from "lucide-react";
import { useMe } from "@/hooks/use-me";

/**
 * Mobile-first persistent bottom nav. Hidden on >=sm so desktop keeps the
 * standard top nav. PageShell adds bottom padding via a spacer so content
 * doesn't render behind this bar.
 */
export function MobileBottomNav() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { me, unreadNotifications } = useMe();

  const items: Array<{
    to: string;
    label: string;
    Icon: typeof Home;
    match: (p: string) => boolean;
    badge?: number;
  }> = [
    { to: "/", label: "Home", Icon: Home, match: (p) => p === "/" },
    { to: "/browse", label: "Browse", Icon: LayoutGrid, match: (p) => p.startsWith("/browse") },
    { to: "/sellers", label: "Top", Icon: Trophy, match: (p) => p.startsWith("/sellers") },
    {
      to: me ? "/orders" : "/auth",
      label: "Orders",
      Icon: Package,
      match: (p) => p.startsWith("/orders"),
    },
    {
      to: me ? "/menu" : "/auth",
      label: me ? "Me" : "Sign in",
      Icon: User,
      match: (p) => p.startsWith("/menu") || p.startsWith("/account"),
      badge: unreadNotifications,
    },
  ];

  return (
    <nav
      aria-label="Mobile navigation"
      className="sm:hidden fixed bottom-0 inset-x-0 z-40 bg-background/95 backdrop-blur border-t border-border pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="grid grid-cols-5">
        {items.map(({ to, label, Icon, match, badge }) => {
          const active = match(path);
          return (
            <li key={label}>
              <Link
                to={to}
                className={`flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-bold tracking-wide ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <span className="relative">
                  <Icon className="size-5" strokeWidth={active ? 2.5 : 2} />
                  {badge && badge > 0 ? (
                    <span className="absolute -top-1 -right-2 bg-destructive text-destructive-foreground text-[9px] font-bold rounded-full min-w-4 h-4 px-1 grid place-items-center">
                      {badge > 9 ? "9+" : badge}
                    </span>
                  ) : null}
                </span>
                {label.toUpperCase()}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
