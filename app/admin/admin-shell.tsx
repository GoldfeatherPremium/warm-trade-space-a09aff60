"use client";

import React, { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  BarChart3,
  ShoppingBag,
  Swords,
  ShieldAlert,
  MessageSquareWarning,
  MessageSquare,
  Star,
  Package,
  Tag,
  Ticket,
  DollarSign,
  CreditCard,
  CreditCard as PaymentIcon,
  Globe,
  UserCheck,
  BadgeCheck,
  Users,
  Settings,
  ScrollText,
  Search,
  X,
} from "lucide-react";
import { getAdminPulseAction } from "@/server/actions/admin";

// ---------------------------------------------------------------------------
// Nav definition
// ---------------------------------------------------------------------------

type NavItem = { label: string; href: string; icon: React.ElementType; exact?: boolean };
type NavGroup = { group: string; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  {
    group: "Operations",
    items: [
      { label: "Dashboard", href: "/admin", icon: LayoutDashboard, exact: true },
      { label: "Analytics", href: "/admin/analytics", icon: BarChart3 },
      { label: "Orders", href: "/admin/orders", icon: ShoppingBag },
      { label: "Disputes", href: "/admin/disputes", icon: Swords },
      { label: "Risk & fraud", href: "/admin/risk", icon: ShieldAlert },
      { label: "Chat moderation", href: "/admin/moderation", icon: MessageSquareWarning },
      { label: "Chat monitor", href: "/admin/chats", icon: MessageSquare },
    ],
  },
  {
    group: "Catalog",
    items: [
      { label: "Product reviews", href: "/admin/products", icon: Star },
      { label: "Selling items", href: "/admin/items", icon: Package },
      { label: "Categories", href: "/admin/categories", icon: Tag },
      { label: "Coupons", href: "/admin/coupons", icon: Ticket },
    ],
  },
  {
    group: "Finance",
    items: [
      { label: "Finance", href: "/admin/finance", icon: DollarSign },
      { label: "Buyer credits", href: "/admin/credits", icon: CreditCard },
      { label: "Payment methods", href: "/admin/payments", icon: PaymentIcon },
      { label: "FX & currency", href: "/admin/fx", icon: Globe },
    ],
  },
  {
    group: "People",
    items: [
      { label: "Seller approvals", href: "/admin/sellers", icon: UserCheck },
      { label: "Verifications", href: "/admin/verifications", icon: BadgeCheck },
      { label: "Users", href: "/admin/users", icon: Users },
    ],
  },
  {
    group: "Config",
    items: [
      { label: "Settings", href: "/admin/settings", icon: Settings },
      { label: "Audit log", href: "/admin/audit", icon: ScrollText },
    ],
  },
];

// Flat list for command palette
const ALL_NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

// ---------------------------------------------------------------------------
// Pulse types
// ---------------------------------------------------------------------------

type PulseData = Awaited<ReturnType<typeof getAdminPulseAction>>;

// ---------------------------------------------------------------------------
// PulseHeader
// ---------------------------------------------------------------------------

function PillTone({ tone }: { tone: "ok" | "warn" | "alert" | "neutral" }) {
  if (tone === "alert") return "bg-destructive/20 text-destructive border-destructive/30";
  if (tone === "warn") return "bg-yellow-500/15 text-yellow-400 border-yellow-500/30";
  if (tone === "ok") return "bg-accent/15 text-accent border-accent/30";
  return "bg-muted/40 text-muted-foreground border-border";
}

function Pill({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "ok" | "warn" | "alert" | "neutral";
}) {
  const cls = PillTone({ tone });
  return (
    <div className={`flex flex-col items-center px-3 py-1.5 rounded-lg border ${cls} min-w-[90px]`}>
      <span className="text-[8px] font-bold tracking-widest uppercase leading-tight opacity-70">
        {label}
      </span>
      <span className="text-sm font-mono font-semibold leading-tight mt-0.5">{value}</span>
    </div>
  );
}

function PulseHeader({ role }: { role: string }) {
  const [pulse, setPulse] = useState<PulseData | null>(null);
  const [, startTransition] = useTransition();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchPulse = () => {
    startTransition(async () => {
      try {
        const data = await getAdminPulseAction();
        setPulse(data);
      } catch {
        // silent — stale data is fine
      }
    });
  };

  useEffect(() => {
    fetchPulse();
    intervalRef.current = setInterval(fetchPulse, 20_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const fmt = (n: number | undefined) => (n == null ? "—" : n.toLocaleString("en-US"));
  const fmtMoney = (cents: number | undefined) =>
    cents == null ? "—" : `$${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

  const pills: Array<{ label: string; value: string; tone: "ok" | "warn" | "alert" | "neutral" }> =
    pulse
      ? [
          {
            label: "Orders 24h",
            value: fmt(pulse.orders24h?.c),
            tone: (pulse.orders24h?.c ?? 0) > 0 ? "ok" : "neutral",
          },
          {
            label: "GMV 24h",
            value: fmtMoney(pulse.gmv24h),
            tone: "neutral",
          },
          {
            label: "Refunds 24h",
            value: fmt(pulse.refunds24h?.c),
            tone: (pulse.refunds24h?.c ?? 0) > 0 ? "warn" : "neutral",
          },
          {
            label: "Funds on hold",
            value: fmtMoney(pulse.escrowOnHold),
            tone: (pulse.escrowOnHold ?? 0) > 0 ? "alert" : "neutral",
          },
          {
            label: "Open disputes",
            value: fmt(pulse.activeDisputes),
            tone: (pulse.activeDisputes ?? 0) > 0 ? "warn" : "neutral",
          },
          {
            label: "New users 24h",
            value: fmt(pulse.newUsers24h),
            tone: "neutral",
          },
          {
            label: "Withdrawals pending",
            value: fmtMoney(pulse.pendingWithdrawalAmt),
            tone: (pulse.pendingWithdrawalAmt ?? 0) > 0 ? "warn" : "neutral",
          },
          {
            label: "Avg trust",
            value: pulse.avgTrust != null ? pulse.avgTrust.toFixed(1) : "—",
            tone: "neutral",
          },
        ]
      : Array.from({ length: 8 }, (_, i) => ({
          label: [
            "Orders 24h",
            "GMV 24h",
            "Refunds 24h",
            "Funds on hold",
            "Open disputes",
            "New users 24h",
            "Withdrawals pending",
            "Avg trust",
          ][i],
          value: "…",
          tone: "neutral" as const,
        }));

  return (
    <div className="border-b border-border bg-background/80 backdrop-blur sticky top-0 z-30">
      <div className="flex items-center gap-2 px-4 py-2 overflow-x-auto no-scrollbar">
        <span className="text-[9px] font-bold tracking-widest uppercase text-muted-foreground shrink-0 mr-1">
          PULSE
        </span>
        {pills.map((p) => (
          <Pill key={p.label} label={p.label} value={p.value} tone={p.tone} />
        ))}
        <span className="text-[9px] text-muted-foreground shrink-0 ml-2 capitalize">{role}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Command palette
// ---------------------------------------------------------------------------

function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const pathname = usePathname();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const filtered = query.trim()
    ? ALL_NAV_ITEMS.filter((item) => item.label.toLowerCase().includes(query.toLowerCase()))
    : ALL_NAV_ITEMS;

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <Search className="size-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Jump to…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="size-4" />
          </button>
        </div>

        {/* Results */}
        <ul className="max-h-72 overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <li className="px-4 py-3 text-sm text-muted-foreground">No results.</li>
          ) : (
            filtered.map((item) => {
              const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onClose}
                    className={`flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-secondary transition-colors ${
                      active ? "text-primary font-semibold" : "text-foreground"
                    }`}
                  >
                    <item.icon className="size-4 text-muted-foreground shrink-0" />
                    {item.label}
                  </Link>
                </li>
              );
            })
          )}
        </ul>

        <div className="px-4 py-2 border-t border-border">
          <span className="text-[10px] text-muted-foreground">
            Press <kbd className="font-mono bg-muted px-1 rounded">Esc</kbd> to close
          </span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AdminShell
// ---------------------------------------------------------------------------

export function AdminShell({ children, role }: { children: React.ReactNode; role: string }) {
  const pathname = usePathname();
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Cmd+K / Ctrl+K opens palette
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <PulseHeader role={role} />

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="hidden lg:flex flex-col w-52 shrink-0 border-r border-border bg-card overflow-y-auto">
          {/* Logo area */}
          <div className="h-14 flex items-center px-4 border-b border-border shrink-0">
            <span className="font-display text-lg tracking-tight">X-VAULT Admin</span>
          </div>

          {/* Cmd+K hint */}
          <button
            onClick={() => setPaletteOpen(true)}
            className="mx-3 mt-3 mb-1 flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary hover:bg-border text-xs text-muted-foreground transition-colors"
          >
            <Search className="size-3.5" />
            <span className="flex-1 text-left">Jump to…</span>
            <kbd className="text-[9px] font-mono bg-muted px-1 rounded">⌘K</kbd>
          </button>

          {/* Nav groups */}
          <nav className="flex-1 px-3 pb-4 space-y-4 mt-2">
            {NAV_GROUPS.map((group) => (
              <div key={group.group}>
                <p className="text-[9px] font-bold tracking-widest uppercase text-muted-foreground px-1 mb-1">
                  {group.group}
                </p>
                <ul className="space-y-0.5">
                  {group.items.map((item) => {
                    const active = item.exact
                      ? pathname === item.href
                      : pathname.startsWith(item.href);
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                            active
                              ? "bg-primary text-primary-foreground"
                              : "bg-secondary hover:bg-border text-foreground"
                          }`}
                        >
                          <item.icon className="size-3.5 shrink-0" />
                          {item.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>
        </aside>

        {/* Mobile top nav */}
        <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-card border-t border-border flex overflow-x-auto no-scrollbar px-2 py-1 gap-1">
          {ALL_NAV_ITEMS.map((item) => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-md text-[9px] font-bold whitespace-nowrap shrink-0 ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary hover:bg-border text-foreground"
                }`}
              >
                <item.icon className="size-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-6xl mx-auto px-4 py-6 pb-20 lg:pb-6">{children}</div>
        </main>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
