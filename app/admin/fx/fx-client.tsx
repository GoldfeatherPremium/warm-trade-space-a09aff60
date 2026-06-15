"use client";

import { useEffect, useState, useTransition } from "react";
import {
  getI18nBootstrapAction,
  adminUpsertFxRateAction,
  adminDeleteFxRateAction,
  adminSetBaseCurrencyAction,
} from "@/server/actions/admin";

type Bootstrap = Awaited<ReturnType<typeof getI18nBootstrapAction>>;

export function FxClient() {
  const [data, setData] = useState<Bootstrap | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [form, setForm] = useState({ currency: "", rate_to_base: "", symbol: "" });
  const [, startTransition] = useTransition();

  function load() {
    startTransition(async () => {
      try {
        const result = await getI18nBootstrapAction();
        setData(result);
      } finally {
        setLoading(false);
      }
    });
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function upsert(e: React.FormEvent) {
    e.preventDefault();
    const rate = parseFloat(form.rate_to_base);
    if (!form.currency || !isFinite(rate) || rate <= 0) {
      setMsg("Provide a currency code and positive rate.");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      await adminUpsertFxRateAction({
        currency: form.currency.toUpperCase().trim(),
        rate_to_base: rate,
        symbol: form.symbol || undefined,
      });
      setMsg("Rate saved.");
      setForm({ currency: "", rate_to_base: "", symbol: "" });
      load();
    } catch (err) {
      setMsg((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function del(currency: string) {
    setBusy(true);
    setMsg(null);
    try {
      await adminDeleteFxRateAction({ currency });
      load();
    } catch (err) {
      setMsg((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function setBase(currency: string) {
    setBusy(true);
    setMsg(null);
    try {
      await adminSetBaseCurrencyAction({ currency });
      load();
    } catch (err) {
      setMsg((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const INPUT =
    "bg-secondary border border-border rounded-md px-2 py-1.5 text-xs w-full focus:outline-none focus:ring-1 focus:ring-primary/50";
  const BTN = "px-3 py-1.5 rounded-md text-xs font-bold disabled:opacity-50";

  if (loading) return <p className="text-xs text-muted-foreground py-10">Loading…</p>;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-[10px] font-bold tracking-widest text-muted-foreground">BASE CURRENCY</p>
        <p className="text-2xl font-display mt-1">{data.baseCurrency}</p>
        <p className="text-[10px] text-muted-foreground mt-1">
          Catalog prices are stored in this currency. Buyers see prices converted using the rates
          below.
        </p>
      </div>

      {msg && (
        <p className="text-xs bg-secondary border border-border rounded-md px-3 py-2">{msg}</p>
      )}

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="px-4 py-2 border-b border-border flex items-center justify-between">
          <h2 className="text-xs font-bold tracking-widest">FX RATES (relative to base)</h2>
          <span className="text-[10px] text-muted-foreground">1 {data.baseCurrency} = rate × foreign</span>
        </div>
        <table className="w-full text-xs">
          <thead className="bg-secondary/40 text-[10px] tracking-widest text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-2">CURRENCY</th>
              <th className="text-left px-3 py-2">SYMBOL</th>
              <th className="text-right px-3 py-2">RATE / BASE</th>
              <th className="text-left px-3 py-2">UPDATED</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {data.rates.map((r) => {
              const isBase = r.currency === data.baseCurrency;
              return (
                <tr key={r.currency} className="border-t border-border">
                  <td className="px-3 py-2 font-mono">
                    {r.currency}
                    {isBase && (
                      <span className="ml-2 text-[9px] px-1.5 py-0.5 rounded bg-primary/20 text-primary">
                        BASE
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">{r.symbol ?? "—"}</td>
                  <td className="px-3 py-2 text-right font-mono">{r.rate_to_base}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {new Date(r.updated_at).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-2 text-right space-x-1">
                    {!isBase && (
                      <>
                        <button
                          disabled={busy}
                          onClick={() => setBase(r.currency)}
                          className={`${BTN} bg-secondary text-foreground`}
                        >
                          Make base
                        </button>
                        <button
                          disabled={busy}
                          onClick={() => del(r.currency)}
                          className={`${BTN} bg-secondary text-muted-foreground`}
                        >
                          Remove
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <form
        className="rounded-lg border border-border bg-card p-4 space-y-3 max-w-lg"
        onSubmit={upsert}
      >
        <h2 className="text-xs font-bold tracking-widest">ADD / UPDATE RATE</h2>
        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-muted-foreground">Code (e.g. EUR)</label>
            <input
              maxLength={4}
              value={form.currency}
              onChange={(e) =>
                setForm({ ...form, currency: e.target.value.toUpperCase().replace(/[^A-Z]/g, "") })
              }
              className={INPUT}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-muted-foreground">Rate / base</label>
            <input
              inputMode="decimal"
              value={form.rate_to_base}
              onChange={(e) => setForm({ ...form, rate_to_base: e.target.value })}
              className={INPUT}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-muted-foreground">Symbol</label>
            <input
              maxLength={3}
              value={form.symbol}
              onChange={(e) => setForm({ ...form, symbol: e.target.value })}
              className={INPUT}
            />
          </div>
        </div>
        <button type="submit" disabled={busy} className={`${BTN} bg-primary text-primary-foreground`}>
          Save rate
        </button>
      </form>
    </div>
  );
}
