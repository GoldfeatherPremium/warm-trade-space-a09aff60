import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Scale } from "lucide-react";
import { listMyDisputes } from "@/lib/api/extras";
import { PageShell } from "@/components/shell";
import { GENERIC_STATUS_CLS, dateTime, usdt } from "@/lib/format";
import { useMe } from "@/hooks/use-me";

export const Route = createFileRoute("/disputes")({
  head: () => ({ meta: [{ title: "Dispute Center — X-VAULT" }] }),
  component: DisputeCenter,
});

function DisputeCenter() {
  const { me, isLoading, banner } = useMe();
  const slaHours = banner?.disputeSlaHours ?? 72;
  const { data } = useQuery({
    queryKey: ["myDisputes"],
    queryFn: () => listMyDisputes(),
    enabled: !!me,
  });

  return (
    <PageShell>
      <h1 className="font-display text-3xl mb-1 flex items-center gap-2">
        <Scale className="size-6 text-primary" /> DISPUTE CENTER
      </h1>
      <p className="text-[11px] text-muted-foreground mb-4">
        Every dispute you're involved in, as buyer or seller. Escrow stays frozen until staff
        resolve it.
      </p>
      {!me && !isLoading && (
        <p className="py-16 text-center text-sm text-muted-foreground">
          Sign in to view your disputes.
        </p>
      )}
      {me && data?.disputes.length === 0 && (
        <p className="py-16 text-center text-sm text-muted-foreground">
          No disputes — that's how we like it. 🎉
        </p>
      )}
      <div className="space-y-2">
        {data?.disputes.map((d) => {
          const iAmBuyer = d.buyer_id === data.myId;
          return (
            <Link
              key={d.id as string}
              to="/disputes/$orderId"
              params={{ orderId: d.order_id as string }}

              className="bg-card border border-border rounded-lg p-3 flex items-center gap-3 flex-wrap hover:border-primary/50"
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold truncate">
                  {d.order_no} · {d.product_title}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {iAmBuyer ? `vs seller ${d.seller_name}` : `opened by buyer ${d.buyer_name}`} ·{" "}
                  {(d.reason as string).replaceAll("_", " ")} · {dateTime(d.created_at as number)}
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
              {d.status !== "resolved" && (() => {
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
              <span className="font-mono text-accent text-sm">{usdt(d.total_cents as number)}</span>
            </Link>
          );
        })}
      </div>
    </PageShell>
  );
}
