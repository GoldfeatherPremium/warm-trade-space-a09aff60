"use client";

/**
 * Phase 0 design proof — renders the dual-theme system on representative
 * marketplace components so both palettes can be signed off before the
 * full rollout. Has its own light/dark toggle (independent of the global
 * switcher, which is wired in Phase 2). View at /theme-preview.
 */

import { useEffect, useState } from "react";
import {
  ShieldCheck,
  Zap,
  Star,
  Moon,
  Sun,
  TrendingUp,
  Lock,
  BadgeCheck,
  Search,
  CheckCircle2,
  Clock,
  XCircle,
} from "lucide-react";

export default function ThemePreview() {
  const [dark, setDark] = useState(true);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  return (
    <div
      className="min-h-screen px-6 py-10 sm:px-10"
      style={{ background: "var(--gradient-hero)" }}
    >
      <div className="max-w-5xl mx-auto space-y-10">
        {/* Header + toggle */}
        <header className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold tracking-widest text-primary mb-1">
              X-VAULT · THEME PREVIEW
            </p>
            <h1 className="font-display text-3xl sm:text-4xl text-gradient-brand">
              {dark ? "Cyber Luxury — Dark" : "Stripe Fintech — Light"}
            </h1>
          </div>
          <button
            onClick={() => setDark((d) => !d)}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold hover:border-primary/50 transition-colors shadow-card"
          >
            {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
            Switch to {dark ? "Light" : "Dark"}
          </button>
        </header>

        {/* Color tokens */}
        <Section title="Color tokens">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            <Swatch name="background" varName="--background" />
            <Swatch name="card" varName="--card" />
            <Swatch name="primary" varName="--primary" />
            <Swatch name="accent" varName="--accent" />
            <Swatch name="secondary" varName="--secondary" />
            <Swatch name="muted" varName="--muted" />
            <Swatch name="success" varName="--success" />
            <Swatch name="warning" varName="--warning" />
            <Swatch name="destructive" varName="--destructive" />
            <Swatch name="border" varName="--border" />
            <Swatch name="chart-3" varName="--chart-3" />
            <Swatch name="chart-6" varName="--chart-6" />
          </div>
        </Section>

        {/* Buttons */}
        <Section title="Buttons & badges">
          <div className="flex flex-wrap gap-3 mb-4">
            <button className="rounded-lg bg-primary text-primary-foreground px-4 py-2.5 text-sm font-bold hover:bg-primary/90 active:scale-[0.98] transition-all">
              Buy Now
            </button>
            <button className="rounded-lg bg-secondary text-secondary-foreground px-4 py-2.5 text-sm font-semibold hover:bg-secondary/70 transition-colors">
              Add to Cart
            </button>
            <button
              className="rounded-lg px-4 py-2.5 text-sm font-bold text-primary-foreground transition-transform hover:scale-[1.02]"
              style={{ background: "var(--gradient-primary)" }}
            >
              Become a Seller
            </button>
            <button className="rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-semibold hover:border-primary/50 transition-colors">
              Outline
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone="primary" icon={ShieldCheck} label="Buyer Protected" />
            <Badge tone="accent" icon={Zap} label="Instant Delivery" />
            <Badge tone="success" icon={CheckCircle2} label="Completed" />
            <Badge tone="warning" icon={Clock} label="Pending" />
            <Badge tone="destructive" icon={XCircle} label="Failed" />
          </div>
        </Section>

        {/* Search bar */}
        <Section title="Search">
          <div className="relative max-w-xl">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              placeholder="Search for games, accounts, software, gift cards…"
              className="w-full rounded-xl border border-input bg-card pl-10 pr-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring/40 focus:border-primary/50 transition-all placeholder:text-muted-foreground/70"
            />
          </div>
        </Section>

        {/* Product cards */}
        <Section title="Product cards">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {PRODUCTS.map((p) => (
              <div
                key={p.title}
                className="rounded-2xl border border-border bg-card overflow-hidden card-hover"
              >
                <div
                  className="h-28 grid place-items-center text-4xl"
                  style={{ background: "var(--gradient-aurora), var(--secondary)" }}
                >
                  {p.emoji}
                </div>
                <div className="p-3">
                  <p className="text-sm font-semibold leading-tight truncate">{p.title}</p>
                  <p className="text-[11px] text-muted-foreground mb-2">{p.brand}</p>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-base font-bold text-primary">{p.price}</span>
                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Star className="size-3 fill-warning text-warning" />
                      {p.rating}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* Glass panel + stats */}
        <Section title="Glass panel & stats">
          <div className="glass rounded-2xl p-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
            {STATS.map((s) => (
              <div key={s.label}>
                <p className="font-display text-2xl text-gradient-brand">{s.value}</p>
                <p className="text-[11px] text-muted-foreground mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* Table */}
        <Section title="Table">
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/50 text-left text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Order</th>
                  <th className="px-4 py-3 font-medium">Item</th>
                  <th className="px-4 py-3 font-medium">Price</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {ORDERS.map((o, i) => (
                  <tr key={o.id} className={i ? "border-t border-border" : ""}>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{o.id}</td>
                    <td className="px-4 py-3 font-medium">{o.item}</td>
                    <td className="px-4 py-3 font-mono text-primary">{o.price}</td>
                    <td className="px-4 py-3">
                      <Badge tone={o.tone} icon={o.icon} label={o.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {/* Chart */}
        <Section title="Chart palette">
          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="flex items-end gap-3 h-40">
              {[60, 85, 45, 95, 70, 110, 80].map((h, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-2">
                  <div
                    className="w-full rounded-t-md transition-all"
                    style={{
                      height: `${h}px`,
                      background: `var(--chart-${(i % 6) + 1})`,
                    }}
                  />
                  <span className="text-[9px] text-muted-foreground">D{i + 1}</span>
                </div>
              ))}
            </div>
          </div>
        </Section>

        {/* Trust grid */}
        <Section title="Trust signals">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { icon: ShieldCheck, label: "Escrow Protected" },
              { icon: Lock, label: "Secure Payments" },
              { icon: BadgeCheck, label: "Verified Sellers" },
              { icon: TrendingUp, label: "99.8% Success" },
            ].map((t) => (
              <div
                key={t.label}
                className="rounded-xl border border-border bg-card p-4 flex flex-col items-center gap-2 text-center"
              >
                <t.icon className="size-5 text-primary" />
                <span className="text-xs font-medium">{t.label}</span>
              </div>
            ))}
          </div>
        </Section>

        <footer className="text-center text-xs text-muted-foreground pt-6 pb-12">
          Phase 0 design proof · toggle above to compare both themes
        </footer>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-xs font-bold tracking-widest text-muted-foreground mb-3 uppercase">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Swatch({ name, varName }: { name: string; varName: string }) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="h-12" style={{ background: `var(${varName})` }} />
      <div className="px-2 py-1.5">
        <p className="text-[10px] font-medium truncate">{name}</p>
      </div>
    </div>
  );
}

const TONES = {
  primary: "bg-primary/10 text-primary border-primary/25",
  accent: "bg-accent/10 text-accent border-accent/25",
  success: "bg-success/10 text-success border-success/25",
  warning: "bg-warning/15 text-warning border-warning/30",
  destructive: "bg-destructive/10 text-destructive border-destructive/25",
} as const;

function Badge({
  tone,
  icon: Icon,
  label,
}: {
  tone: keyof typeof TONES;
  icon: React.ElementType;
  label: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[11px] font-bold tracking-wide rounded-full border px-2.5 py-1 ${TONES[tone]}`}
    >
      <Icon className="size-3" />
      {label}
    </span>
  );
}

const PRODUCTS = [
  { title: "Windows 11 Pro", brand: "Microsoft", price: "$15.99", rating: "5.0", emoji: "🪟" },
  { title: "Discord Nitro", brand: "Discord", price: "$8.99", rating: "5.0", emoji: "🎮" },
  { title: "Netflix Premium", brand: "Netflix", price: "$5.99", rating: "4.9", emoji: "🎬" },
  { title: "Steam Account", brand: "Steam", price: "$24.99", rating: "5.0", emoji: "🕹️" },
];

const STATS = [
  { value: "100K+", label: "Happy Customers" },
  { value: "1M+", label: "Products Sold" },
  { value: "50K+", label: "Verified Sellers" },
  { value: "24/7", label: "Support" },
];

const ORDERS = [
  {
    id: "#A1042",
    item: "Windows 11 Pro Key",
    price: "$15.99",
    status: "Completed",
    tone: "success" as const,
    icon: CheckCircle2,
  },
  {
    id: "#A1043",
    item: "Netflix Premium",
    price: "$5.99",
    status: "Pending",
    tone: "warning" as const,
    icon: Clock,
  },
  {
    id: "#A1044",
    item: "Steam Account",
    price: "$24.99",
    status: "Failed",
    tone: "destructive" as const,
    icon: XCircle,
  },
];
