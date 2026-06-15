"use client";

import { useEffect, useState, useTransition } from "react";
import { adminListPaymentMethodsAction, adminSetPaymentMethodAction } from "@/server/actions/admin";

type Method = Awaited<ReturnType<typeof adminListPaymentMethodsAction>>[number];

export function PaymentsClient() {
  const [methods, setMethods] = useState<Method[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function load() {
    startTransition(async () => {
      try {
        const data = await adminListPaymentMethodsAction();
        setMethods(data);
      } finally {
        setLoading(false);
      }
    });
  }

  useEffect(() => {
    load();
  }, []);

  async function toggle(code: string, enabled: boolean) {
    setBusy(true);
    setMsg(null);
    try {
      await adminSetPaymentMethodAction({ code, enabled });
      setMethods((prev) =>
        prev.map((m) => (m.code === code ? { ...m, enabled: enabled ? 1 : 0 } : m)),
      );
    } catch (err) {
      setMsg((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-card p-4">
        <h1 className="font-display text-2xl">Payment methods</h1>
        <p className="text-[11px] text-muted-foreground mt-1">
          Control which checkout rails buyers can use. Enabling a rail with no configured provider
          shows it as "coming soon" at checkout.
        </p>
      </div>

      {msg && (
        <p className="text-xs bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2 text-destructive">
          {msg}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="rounded-lg border border-border bg-card divide-y divide-border">
          {methods.map((m) => (
            <div key={m.code} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold flex items-center gap-2">
                  {m.name}
                  {m.is_default === 1 && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-primary/15 text-primary">
                      DEFAULT
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
              <button
                disabled={busy || m.is_default === 1}
                onClick={() => toggle(m.code, !m.enabled)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors disabled:opacity-50 ${
                  m.enabled ? "bg-primary" : "bg-secondary border border-border"
                }`}
                aria-label={`Toggle ${m.name}`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
                    m.enabled ? "translate-x-4" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
