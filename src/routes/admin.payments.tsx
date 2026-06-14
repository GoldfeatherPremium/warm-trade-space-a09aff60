import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bitcoin, CreditCard, Wallet, Smartphone } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { adminListPaymentMethods, adminSetPaymentMethod } from "@/lib/api/payments";

export const Route = createFileRoute("/admin/payments")({
  head: () => ({ meta: [{ title: "Payment methods — Admin" }] }),
  component: AdminPaymentsPage,
});

const KIND_ICON: Record<string, typeof CreditCard> = {
  crypto: Bitcoin,
  card: CreditCard,
  ewallet: Smartphone,
  wallet: Wallet,
};

function AdminPaymentsPage() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["adminPaymentMethods"],
    queryFn: () => adminListPaymentMethods(),
  });
  const toggle = useMutation({
    mutationFn: (vars: { code: string; enabled: boolean }) => adminSetPaymentMethod({ data: vars }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["adminPaymentMethods"] });
      qc.invalidateQueries({ queryKey: ["paymentMethods"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-card p-4">
        <h1 className="font-display text-2xl">Payment methods</h1>
        <p className="text-[11px] text-muted-foreground mt-1">
          Control which checkout rails buyers can use. USDT and on-platform balances are live today.
          Card and e-wallet rails are scaffolded — enable them once their provider credentials are
          configured. Enabling a rail with no configured provider shows it as “coming soon” at
          checkout rather than taking payments.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card divide-y divide-border">
        {data?.methods.map((m) => {
          const Icon = KIND_ICON[m.kind] ?? Wallet;
          const configured = m.kind === "crypto" || m.kind === "wallet";
          return (
            <div key={m.code} className="flex items-center gap-3 px-4 py-3">
              <span className="size-9 rounded-md bg-secondary grid place-items-center shrink-0">
                <Icon className="size-4 text-primary" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold flex items-center gap-2">
                  {m.name}
                  {m.is_default === 1 && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-primary/15 text-primary">
                      DEFAULT
                    </span>
                  )}
                  {!configured && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-500">
                      NEEDS PROVIDER
                    </span>
                  )}
                </p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                  {m.kind}
                </p>
              </div>
              <span
                className={`text-[10px] font-bold ${m.enabled ? "text-accent" : "text-muted-foreground"}`}
              >
                {m.enabled ? "LIVE" : "OFF"}
              </span>
              <Switch
                checked={m.enabled === 1}
                disabled={toggle.isPending || m.is_default === 1}
                onCheckedChange={(v) => toggle.mutate({ code: m.code, enabled: v })}
                aria-label={`Toggle ${m.name}`}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
