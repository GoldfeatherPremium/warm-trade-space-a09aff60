import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Scale, ShieldCheck, PackageSearch } from "lucide-react";
import { listMyDisputes } from "@/lib/api/extras";
import { PageShell } from "@/components/shell";
import { GENERIC_STATUS_CLS, dateTime, usdt } from "@/lib/format";
import { EmptyState } from "@/components/dashboard";
import { useMe } from "@/hooks/use-me";

export const Route = createFileRoute("/disputes")({
  head: () => ({ meta: [{ title: "Dispute Center — X-VAULT" }] }),
  component: DisputeCenter,
});

type Dispute = Record<string, string | number | null>;
type Tab = "all" | "open" | "resolved";

function DisputesSkeleton() {
  return (
    <div className="space-y-2 animate-pulse">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="bg-card border border-border rounded-lg p-3 flex items-center gap-3"
        >
          <div className="flex-1 space-y-2">
            <div className="h-2.5 w-2/3 rounded bg-secondary" />
            <div className="h-2 w-1/2 rounded bg-secondary/70" />
          </div>
          <div className="h-5 w-16 rounded bg-secondary" />
        </div>
      ))}
    </div>
  );
}

function DisputeCenter() {
  const { me, isLoading: meLoading, banner } = useMe();
  const slaHours = banner?.disputeSlaHours ?? 72;
  const { data, isLoading } = useQuery({
    queryKey: ["myDisputes"],
    queryFn: () => listMyDisputes(),
    enabled: !!me,
  });
  const [tab, setTab] = useState<Tab>("all");

  const disputes = useMemo(() => (data?.disputes ?? []) as Dispute[], [data?.disputes]);
  const openCount = useMemo(
    () => disputes.filter((d) => d.status !== "resolved").length,
    [disputes],
  );
  const frozenCents = useMemo(
    () =>
      disputes
        .filter((d) => d.status !== "resolved")
        .reduce((sum, d) => sum + Number(d.total_cents ?? 0), 0),
    [disputes],
  );

  const tabs: Array<{ key: Tab; label: string; n: number }> = [
    { key: "all", label: "All", n: disputes.length },
    { key: "open", label: "Open", n: openCount },
    { key: "resolved", label: "Resolved", n: disputes.length - openCount },
  ];
  const filtered = disputes.filter((d) => {
    if (tab === "open") return d.status !== "resolved";
    if (tab === "resolved") return d.status === "resolved";
    return true;
  });

  return (
    <PageShell>
      <h1 className="font-display text-3xl mb-1 flex items-center gap-2">
        <Scale className="size-6 text-primary" /> DISPUTE CENTER
      </h1>
      <p className="text-[11px] text-muted-foreground mb-4">
        Every dispute you're involved in, as buyer or seller. Funds stay frozen until staff resolve
        it.
      </p>

      {!me && !meLoading ? (
        <EmptyState
          icon={Scale}
          title="Sign in to view your disputes"
          action={{ to: "/auth", label: "Sign in / Register" }}
        />
      ) : isLoading || meLoading ? (
        <DisputesSkeleton />
      ) : disputes.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="No disputes — that's how we like it 🎉"
          description="If an order goes wrong, open a dispute from the order page and it'll show up here."
        />
      ) : (
        <>
          {/* Summary */}
          {openCount > 0 && (
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-card border border-border rounded-lg p-3">
                <p className="text-[9px] font-bold tracking-widest text-muted-foreground">
                  OPEN DISPUTES
                </p>
                <p className="font-mono text-lg mt-1 text-yellow-400">{openCount}</p>
              </div>
              <div className="bg-card border border-border rounded-lg p-3">
                <p className="text-[9px] font-bold tracking-widest text-muted-foreground">
                  FUNDS FROZEN
                </p>
                <p className="font-mono text-lg mt-1">{usdt(frozenCents)}</p>
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-1.5 mb-4">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`text-xs font-bold rounded-md px-3 py-1.5 transition-colors ${
                  tab === t.key
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary/50 text-muted-foreground hover:bg-secondary"
                }`}
              >
                {t.label} ({t.n})
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <EmptyState icon={PackageSearch} title="Nothing in this view" />
          ) : (
            <div className="space-y-2">
              {filtered.map((d) => {
                const iAmBuyer = d.buyer_id === data!.myId;
                return (
                  <Link
                    key={d.id as string}
                    to="/disputes/$orderId"
                    params={{ orderId: d.order_id as string }}
                    className={`bg-card border rounded-lg p-3 flex items-center gap-3 flex-wrap hover:border-primary/50 transition-colors ${
                      d.status !== "resolved" ? "border-yellow-500/30" : "border-border"
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold truncate">
                        {d.order_no} · {d.product_title}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {iAmBuyer
                          ? `vs seller ${d.seller_name}`
                          : `opened by buyer ${d.buyer_name}`}{" "}
                        · {(d.reason as string).replaceAll("_", " ")} ·{" "}
                        {dateTime(d.created_at as number)}
                      </p>
                      {d.resolution && (
                        <p className="text-[10px] text-accent font-bold">
                          Resolved: {(d.resolution as string).replaceAll("_", " ")}
                          {d.resolution_cents ? ` (${usdt(d.resolution_cents as number)})` : ""}
                        </p>
                      )}
                    </div>
                    <span
                      className={`text-[9px] font-bold px-2 py-1 rounded ${GENERIC_STATUS_CLS[d.status as string] ?? "bg-muted"}`}
                    >
                      {(d.status as string).replaceAll("_", " ").toUpperCase()}
                    </span>
                    {d.status !== "resolved" &&
                      (() => {
                        const deadline = (d.created_at as number) + slaHours * 3600_000;
                        const remaining = deadline - Date.now();
                        const overdue = remaining < 0;
                        const hours = Math.round(Math.abs(remaining) / 3600_000);
                        return (
                          <span
                            className={`text-[9px] font-bold px-2 py-1 rounded ${overdue ? "bg-destructive/90 text-white" : "bg-secondary text-foreground/80"}`}
                            title={`Staff target ${slaHours}h from open`}
                          >
                            {overdue ? `SLA +${hours}h` : `SLA ${hours}h left`}
                          </span>
                        );
                      })()}
                    <span className="font-mono text-accent text-sm">
                      {usdt(d.total_cents as number)}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </>
      )}
    </PageShell>
  );
}
