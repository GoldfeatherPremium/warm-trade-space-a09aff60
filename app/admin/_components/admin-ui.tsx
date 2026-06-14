// Next-native copies of the dashboard primitives (the shared
// `@/components/dashboard` versions use TanStack `Link`, which can't be used
// inside the Next App Router). Visually identical; `to` → `href` via next/link.
import Link from "next/link";
import { TrendingUp, TrendingDown } from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import { cn } from "@/lib/utils";

type Tone = "up" | "down" | "neutral";

const toneText: Record<Tone, string> = {
  up: "text-accent",
  down: "text-destructive",
  neutral: "text-muted-foreground",
};

export function StatCard({
  label,
  value,
  icon: Icon,
  sub,
  delta,
  tone = "neutral",
  to,
  valueCls,
  highlight,
}: {
  label: string;
  value: ReactNode;
  icon?: ComponentType<{ className?: string }>;
  sub?: ReactNode;
  delta?: string;
  tone?: Tone;
  to?: string;
  valueCls?: string;
  highlight?: boolean;
}) {
  const TrendIcon = tone === "up" ? TrendingUp : tone === "down" ? TrendingDown : null;
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[9px] font-bold tracking-widest text-muted-foreground flex items-center gap-1.5 min-w-0">
          {Icon && <Icon className="size-3.5 shrink-0" />}
          <span className="truncate">{label}</span>
        </p>
        {delta && (
          <span className={cn("text-[9px] font-bold flex items-center gap-0.5", toneText[tone])}>
            {TrendIcon && <TrendIcon className="size-2.5" />}
            {delta}
          </span>
        )}
      </div>
      <p className={cn("font-mono text-lg mt-1.5 leading-none", valueCls)}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-1 truncate">{sub}</p>}
    </>
  );
  const base = cn(
    "block bg-card border rounded-lg p-4 transition-colors",
    highlight ? "border-yellow-500/40" : "border-border",
    to && "hover:border-primary/50",
  );
  return to ? (
    <Link href={to} className={base}>
      {body}
    </Link>
  ) : (
    <div className={base}>{body}</div>
  );
}

export function SectionCard({
  title,
  icon: Icon,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode;
  icon?: ComponentType<{ className?: string }>;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("bg-card border border-border rounded-lg p-4", className)}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-2 mb-3">
          {title && (
            <h2 className="text-xs font-bold tracking-widest text-muted-foreground flex items-center gap-1.5">
              {Icon && <Icon className="size-3.5" />}
              {title}
            </h2>
          )}
          {action}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

export function SectionAction({ to, label }: { to: string; label: string }) {
  return (
    <Link
      href={to}
      className="text-[10px] font-bold text-primary hover:underline whitespace-nowrap"
    >
      {label} →
    </Link>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: { to: string; label: string };
  className?: string;
}) {
  return (
    <div className={cn("grid place-items-center text-center py-10 px-4", className)}>
      <div className="max-w-xs">
        {Icon && <Icon className="size-8 text-muted-foreground/40 mx-auto mb-2.5" />}
        <p className="text-sm font-bold">{title}</p>
        {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
        {action && (
          <Link
            href={action.to}
            className="inline-block mt-3 text-xs font-bold text-primary hover:underline"
          >
            {action.label} →
          </Link>
        )}
      </div>
    </div>
  );
}

export function StatGridSkeleton({ count = 4, cols = 4 }: { count?: number; cols?: number }) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-3",
        cols === 3 ? "lg:grid-cols-3" : cols === 4 ? "lg:grid-cols-4" : "lg:grid-cols-5",
      )}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-card border border-border rounded-lg p-4 animate-pulse">
          <div className="h-2 w-2/3 rounded bg-secondary" />
          <div className="h-5 w-1/2 rounded bg-secondary mt-3" />
        </div>
      ))}
    </div>
  );
}
