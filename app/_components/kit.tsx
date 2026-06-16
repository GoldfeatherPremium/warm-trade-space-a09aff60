/**
 * X-VAULT buyer-flow UI kit.
 *
 * Small, server-safe presentational primitives (no hooks, no "use client") that
 * consolidate the patterns previously hand-rolled with inline Tailwind across
 * the home, browse, product and storefront pages. Defining each once removes
 * duplication and the class of bug where an icon/global was used inconsistently.
 *
 * All components read from the design tokens in globals.css so they track the
 * dark / light themes automatically.
 */
import Link from "next/link";
import { Star, Zap, Clock, ShieldCheck, RefreshCw, Lock, ChevronRight } from "lucide-react";
import { usdt, usdtShort } from "@/lib/format";

type Size = "sm" | "md" | "lg";

/* ── Rating stars ─────────────────────────────────────────────────────────── */
export function RatingStars({
  rating,
  count,
  size = "sm",
  showValue = true,
}: {
  rating: number;
  count?: number;
  size?: Size;
  showValue?: boolean;
}) {
  const star = size === "lg" ? "size-4" : size === "md" ? "size-3.5" : "size-3";
  const text = size === "lg" ? "text-sm" : "text-xs";
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <Star
            key={n}
            className={`${star} ${n <= Math.round(rating) ? "fill-warning text-warning" : "text-border"}`}
          />
        ))}
      </div>
      {showValue && (
        <span className={`${text} font-bold tabular-nums`}>
          {rating > 0 ? rating.toFixed(1) : "—"}
        </span>
      )}
      {count != null && count > 0 && (
        <span className="text-[11px] text-muted-foreground">({count.toLocaleString()})</span>
      )}
    </div>
  );
}

/* ── Price ────────────────────────────────────────────────────────────────── */
export function PriceTag({
  cents,
  size = "md",
  short = false,
  className = "",
}: {
  cents: number;
  size?: Size;
  short?: boolean;
  className?: string;
}) {
  const cls = size === "lg" ? "text-3xl" : size === "md" ? "text-base" : "text-sm";
  return (
    <span className={`font-mono font-bold text-accent leading-none ${cls} ${className}`}>
      {short ? usdtShort(cents) : usdt(cents)}
    </span>
  );
}

/* ── Delivery badge (instant / manual) ────────────────────────────────────── */
export function DeliveryBadge({
  deliveryType,
  slaMinutes,
  className = "",
}: {
  deliveryType: "auto" | "manual";
  slaMinutes?: number;
  className?: string;
}) {
  const auto = deliveryType === "auto";
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
        auto
          ? "bg-primary/10 text-primary border-primary/25"
          : "bg-accent/10 text-accent border-accent/25"
      } ${className}`}
    >
      {auto ? <Zap className="size-2.5" /> : <Clock className="size-2.5" />}
      {auto ? "Instant delivery" : slaMinutes ? `~${slaMinutes}min` : "Manual"}
    </span>
  );
}

/* ── Stock pill ───────────────────────────────────────────────────────────── */
const LOW_STOCK = 5;
export function StockPill({
  deliveryType,
  stockCount,
  className = "",
}: {
  deliveryType: "auto" | "manual";
  stockCount: number;
  className?: string;
}) {
  // Manual-delivery listings are made-to-order: stock is not meaningful.
  if (deliveryType !== "auto") return null;
  if (stockCount === 0)
    return (
      <span
        className={`text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground ${className}`}
      >
        Sold out
      </span>
    );
  if (stockCount <= LOW_STOCK)
    return (
      <span
        className={`text-[10px] font-bold px-2 py-0.5 rounded-full bg-destructive/15 text-destructive ${className}`}
      >
        {stockCount} left
      </span>
    );
  return (
    <span
      className={`text-[10px] font-bold px-2 py-0.5 rounded-full bg-success/15 text-success ${className}`}
    >
      In stock
    </span>
  );
}

/* ── Trust strip ──────────────────────────────────────────────────────────── */
export function TrustStrip({ warrantyHours }: { warrantyHours: number }) {
  const items = [
    { icon: Lock, label: "Escrow secured" },
    { icon: ShieldCheck, label: "Buyer protected" },
    { icon: RefreshCw, label: `${warrantyHours}h warranty` },
  ];
  return (
    <div className="grid grid-cols-3 gap-2 text-center">
      {items.map(({ icon: Icon, label }) => (
        <div key={label} className="flex flex-col items-center gap-1">
          <Icon className="size-4 text-primary" />
          <span className="text-[9px] text-muted-foreground leading-tight">{label}</span>
        </div>
      ))}
    </div>
  );
}

/* ── Compact stat ─────────────────────────────────────────────────────────── */
export function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="text-base font-bold tabular-nums">{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}

/* ── Section heading with optional "see all" link ─────────────────────────── */
export function SectionHeading({
  title,
  href,
  linkLabel = "See all",
  className = "",
}: {
  title: string;
  href?: string;
  linkLabel?: string;
  className?: string;
}) {
  return (
    <div className={`flex items-end justify-between gap-3 mb-4 ${className}`}>
      <h2 className="font-display text-xl sm:text-2xl tracking-tight">{title}</h2>
      {href && (
        <Link
          href={href}
          className="group inline-flex items-center gap-0.5 text-xs font-semibold text-primary hover:text-primary/80 transition-colors shrink-0"
        >
          {linkLabel}
          <ChevronRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
        </Link>
      )}
    </div>
  );
}

/* ── Empty state ──────────────────────────────────────────────────────────── */
export function EmptyState({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="py-16 text-center">
      <div className="size-12 rounded-2xl bg-secondary/70 border border-border/60 grid place-items-center mx-auto mb-4">
        <Icon className="size-6 text-muted-foreground" />
      </div>
      <p className="font-semibold mb-1">{title}</p>
      {description && (
        <p className="text-sm text-muted-foreground mb-4 max-w-sm mx-auto">{description}</p>
      )}
      {children && <div className="flex flex-wrap justify-center gap-2">{children}</div>}
    </div>
  );
}
