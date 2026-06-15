"use client";

import { useEffect, useState, useTransition } from "react";
import { getAdminSettingsAction, updateAdminSettingsAction } from "@/server/actions/admin";

interface FormShape {
  defaultCommissionPct: number;
  withdrawalFeeUsdt: number;
  minWithdrawalUsdt: number;
  autoConfirmHours: number;
  paymentWindowMinutes: number;
  maintenanceMode: boolean;
  announcement: string;
  creditWithdrawalFeePct: number;
  creditWithdrawalMinFeeUsdt: number;
  attachmentMaxMb: number;
  presencePingSeconds: number;
  lowStockThreshold: number;
  disputeSlaHours: number;
  chatRateLimitPerMin: number;
  automodSeverity: "block" | "flag";
}

const DEFAULTS: FormShape = {
  defaultCommissionPct: 8,
  withdrawalFeeUsdt: 1,
  minWithdrawalUsdt: 10,
  autoConfirmHours: 48,
  paymentWindowMinutes: 30,
  maintenanceMode: false,
  announcement: "",
  creditWithdrawalFeePct: 2,
  creditWithdrawalMinFeeUsdt: 1,
  attachmentMaxMb: 5,
  presencePingSeconds: 60,
  lowStockThreshold: 5,
  disputeSlaHours: 72,
  chatRateLimitPerMin: 20,
  automodSeverity: "block",
};

type Tab = "general" | "fees" | "escrow" | "credits" | "chat";

const INPUT =
  "bg-secondary border border-border rounded-md px-2 py-1.5 text-xs w-full focus:outline-none focus:ring-1 focus:ring-primary/50";
const LABEL = "text-xs font-bold text-muted-foreground";

export function SettingsClient() {
  const [form, setForm] = useState<FormShape>(DEFAULTS);
  const [tab, setTab] = useState<Tab>("general");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      try {
        const s = await getAdminSettingsAction();
        setForm({
          defaultCommissionPct: s.default_commission_pct as number,
          withdrawalFeeUsdt: (s.withdrawal_fee_cents as number) / 100,
          minWithdrawalUsdt: (s.min_withdrawal_cents as number) / 100,
          autoConfirmHours: s.auto_confirm_hours as number,
          paymentWindowMinutes: s.payment_window_minutes as number,
          maintenanceMode: !!s.maintenance_mode,
          announcement: (s.announcement as string) ?? "",
          creditWithdrawalFeePct: (s.credit_withdrawal_fee_pct as number) ?? 2,
          creditWithdrawalMinFeeUsdt: ((s.credit_withdrawal_min_fee_cents as number) ?? 100) / 100,
          attachmentMaxMb: (s.attachment_max_mb as number) ?? 5,
          presencePingSeconds: (s.presence_ping_seconds as number) ?? 60,
          lowStockThreshold: (s.low_stock_threshold as number) ?? 5,
          disputeSlaHours: (s.dispute_sla_hours as number) ?? 72,
          chatRateLimitPerMin: (s.chat_rate_limit_per_min as number) ?? 20,
          automodSeverity:
            ((s.automod_severity as string) ?? "block") === "flag" ? "flag" : "block",
        });
      } catch {
        // ignore
      }
    });
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      await updateAdminSettingsAction(form);
      setMsg("Settings saved.");
    } catch (err) {
      setMsg((err as Error).message ?? "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  function num(key: keyof FormShape, label: string, hint?: string, step?: string) {
    return (
      <div className="space-y-1.5">
        <label className={LABEL}>{label}</label>
        <input
          type="number"
          step={step ?? "0.01"}
          value={form[key] as number}
          onChange={(e) => setForm({ ...form, [key]: Number(e.target.value) })}
          className={INPUT}
        />
        {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
      </div>
    );
  }

  const TABS: Array<{ id: Tab; label: string }> = [
    { id: "general", label: "General" },
    { id: "fees", label: "Fees" },
    { id: "escrow", label: "Escrow" },
    { id: "credits", label: "Credits" },
    { id: "chat", label: "Chat & Listings" },
  ];

  return (
    <form className="max-w-2xl space-y-4" onSubmit={save}>
      <h1 className="font-display text-2xl">PLATFORM SETTINGS</h1>
      <p className="text-[11px] text-muted-foreground -mt-2">
        Every value below is read by the live app on the next request — no redeploy needed.
      </p>

      {msg && (
        <p className="text-xs bg-secondary border border-border rounded-md px-3 py-2">{msg}</p>
      )}

      {/* Tab strip */}
      <div className="flex flex-wrap gap-1 bg-secondary rounded-md p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-3 py-1 rounded text-xs font-bold ${
              tab === t.id ? "bg-primary text-primary-foreground" : "text-muted-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "general" && (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className={LABEL}>Site announcement banner</label>
            <input
              value={form.announcement}
              maxLength={300}
              onChange={(e) => setForm({ ...form, announcement: e.target.value })}
              placeholder="e.g. ⚡ Weekend sale — use coupon SAVE10 for 10% off!"
              className={INPUT}
            />
            <p className="text-[10px] text-muted-foreground">
              Shown at the top of every page. Leave empty to hide.
            </p>
          </div>
          <div className="flex items-center justify-between bg-card border border-border rounded-lg p-3">
            <div>
              <p className="text-xs font-bold">Maintenance mode</p>
              <p className="text-[10px] text-muted-foreground">
                Shows a banner; pause before migrations.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setForm({ ...form, maintenanceMode: !form.maintenanceMode })}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
                form.maintenanceMode ? "bg-destructive" : "bg-secondary border border-border"
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
                  form.maintenanceMode ? "translate-x-4" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>
        </div>
      )}

      {tab === "fees" && (
        <div className="space-y-4">
          {num(
            "defaultCommissionPct",
            "Default commission %",
            "Used when a category has no override.",
          )}
          {num("withdrawalFeeUsdt", "Seller withdrawal fee (USDT)")}
          {num("minWithdrawalUsdt", "Minimum seller withdrawal (USDT)")}
        </div>
      )}

      {tab === "escrow" && (
        <div className="space-y-4">
          {num(
            "autoConfirmHours",
            "Auto-confirm window (hours)",
            "Delivered → completed if buyer is silent.",
            "1",
          )}
          {num(
            "paymentWindowMinutes",
            "Payment window (minutes)",
            "Unpaid orders expire after this.",
            "1",
          )}
          {num(
            "disputeSlaHours",
            "Dispute SLA (hours)",
            "Staff target for first response on open disputes.",
            "1",
          )}
        </div>
      )}

      {tab === "credits" && (
        <div className="space-y-4">
          {num(
            "creditWithdrawalFeePct",
            "Credit withdrawal fee (%)",
            "Applied when buyers cash out store credits.",
          )}
          {num("creditWithdrawalMinFeeUsdt", "Credit withdrawal minimum fee (USDT)")}
        </div>
      )}

      {tab === "chat" && (
        <div className="space-y-4">
          {num(
            "presencePingSeconds",
            "Presence ping interval (seconds)",
            "How often browsers refresh 'online' status.",
            "1",
          )}
          {num(
            "attachmentMaxMb",
            "Order attachment max size (MB)",
            "Per-file cap on delivery proof uploads.",
            "1",
          )}
          {num(
            "lowStockThreshold",
            "Low-stock badge threshold",
            "Products at or below this show a low-stock badge.",
            "1",
          )}
          {num(
            "chatRateLimitPerMin",
            "Chat rate limit (messages / minute / user)",
            "Hard cap to stop spam.",
            "1",
          )}
          <div className="space-y-1.5">
            <label className={LABEL}>Automod severity</label>
            <select
              value={form.automodSeverity}
              onChange={(e) =>
                setForm({ ...form, automodSeverity: e.target.value as "block" | "flag" })
              }
              className={INPUT}
            >
              <option value="block">Block — hard-reject violating messages</option>
              <option value="flag">Flag only — let it through, mark for staff review</option>
            </select>
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={saving}
        className="px-4 py-2 rounded-md text-sm font-bold bg-primary text-primary-foreground disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save settings"}
      </button>
    </form>
  );
}
