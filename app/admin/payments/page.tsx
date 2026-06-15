"use client";

import { useEffect, useState, useTransition } from "react";
import { Bitcoin, CreditCard, Wallet, Smartphone } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { adminListPaymentMethods, adminSetPaymentMethod } from "@/server/actions/admin";

const KIND_ICON: Record<string, typeof CreditCard> = {
  crypto: Bitcoin,
  card: CreditCard,
  ewallet: Smartphone,
  wallet: Wallet,
};

export default function AdminPaymentsPage() {
  const [data, setData] = useState<Awaited<ReturnType<typeof adminListPaymentMethods>> | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const load = () => {
    adminListPaymentMethods()
      .then((d) => setData(d))
      .catch(() => {});
  };

  useEffect(() => {
    load();
  }, []);

  const toggle = (vars: { code: string; enabled: boolean }) => {
    setError(null);
    startTransition(async () => {
      try {
        await adminSetPaymentMethod(vars);
        load();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error");
      }
    });
  };

  return (
    <div className="space-y-6">
      {error && (
        <p className="text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
          {error}
        </p>
      )}
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
                disabled={isPending || m.is_default === 1}
                onCheckedChange={(v) => toggle({ code: m.code, enabled: v })}
                aria-label={`Toggle ${m.name}`}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
