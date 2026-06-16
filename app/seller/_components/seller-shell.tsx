"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  ListOrdered,
  Wallet,
  Star,
  ShieldCheck,
  Repeat,
  BarChart3,
  Tag,
  Store,
  ExternalLink,
} from "lucide-react";
import { PublicShell } from "../../_components/site-shell";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
};

// Grouped so the sidebar reads as a real dashboard rather than a flat strip.
const NAV_GROUPS: Array<{ heading: string; items: NavItem[] }> = [
  {
    heading: "Overview",
    items: [
      { href: "/seller", label: "Dashboard", icon: LayoutDashboard, exact: true },
      { href: "/seller/analytics", label: "Analytics", icon: BarChart3 },
    ],
  },
  {
    heading: "Catalog",
    items: [
      { href: "/seller/products", label: "Products", icon: Package },
      { href: "/seller/orders", label: "Orders", icon: ListOrdered },
      { href: "/seller/promotions", label: "Promotions", icon: Tag },
      { href: "/seller/subscriptions", label: "Subscriptions", icon: Repeat },
    ],
  },
  {
    heading: "Store & account",
    items: [
      { href: "/seller/storefront", label: "Storefront", icon: Store },
      { href: "/seller/wallet", label: "Wallet", icon: Wallet },
      { href: "/seller/reviews", label: "Reviews", icon: Star },
      { href: "/seller/verification", label: "Verification", icon: ShieldCheck },
    ],
  },
];

const FLAT_NAV: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

export function SellerShell({
  username,
  children,
}: {
  username: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isActive = (n: NavItem) => (n.exact ? pathname === n.href : pathname.startsWith(n.href));

  return (
    <PublicShell>
      <div className="lg:grid lg:grid-cols-[210px_1fr] lg:gap-6">
        {/* ── Sidebar (desktop) ── */}
        <aside className="hidden lg:block">
          <div className="sticky top-24 space-y-5">
            <div className="px-2">
              <p className="text-[10px] font-bold tracking-widest text-muted-foreground">
                SELLER CENTER
              </p>
              <p className="font-display text-lg leading-tight truncate">{username}</p>
              <Link
                href={`/s/${username}`}
                className="mt-1 inline-flex items-center gap-1 text-[11px] text-primary hover:text-primary/80 transition-colors"
              >
                View public store <ExternalLink className="size-3" />
              </Link>
            </div>
            <nav className="space-y-4">
              {NAV_GROUPS.map((group) => (
                <div key={group.heading}>
                  <p className="px-2 mb-1 text-[10px] font-bold tracking-widest text-muted-foreground/70 uppercase">
                    {group.heading}
                  </p>
                  <div className="space-y-0.5">
                    {group.items.map((n) => {
                      const active = isActive(n);
                      return (
                        <Link
                          key={n.href}
                          href={n.href}
                          aria-current={active ? "page" : undefined}
                          className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[13px] font-medium transition-colors ${
                            active
                              ? "bg-primary/10 text-primary border border-primary/25"
                              : "border border-transparent text-muted-foreground hover:bg-secondary/70 hover:text-foreground"
                          }`}
                        >
                          <n.icon className="size-4 shrink-0" />
                          {n.label}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>
          </div>
        </aside>

        {/* ── Mobile tab strip ── */}
        <div className="-mx-4 mb-4 border-b border-border/60 px-4 lg:hidden">
          <div className="flex gap-1 overflow-x-auto no-scrollbar pb-2">
            {FLAT_NAV.map((n) => {
              const active = isActive(n);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3.5 py-2 text-[12px] font-semibold transition-all ${
                    active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground"
                  }`}
                >
                  <n.icon className="size-3.5 shrink-0" /> {n.label}
                </Link>
              );
            })}
          </div>
        </div>

        {/* ── Content ── */}
        <div className="min-w-0">{children}</div>
      </div>
    </PublicShell>
  );
}
