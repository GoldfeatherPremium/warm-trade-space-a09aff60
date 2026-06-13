import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getAdminSettings, updateAdminSettings } from "@/lib/api/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/admin/settings")({
  head: () => ({ meta: [{ title: "Platform Settings — Admin" }] }),
  component: AdminSettings,
});

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

function AdminSettings() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["adminSettings"], queryFn: () => getAdminSettings() });
  const [form, setForm] = useState<FormShape>(DEFAULTS);

  useEffect(() => {
    if (!data?.settings) return;
    const s = data.settings;
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
      automodSeverity: ((s.automod_severity as string) ?? "block") === "flag" ? "flag" : "block",
    });
  }, [data]);

  const save = useMutation({
    mutationFn: () => updateAdminSettings({ data: form }),
    onSuccess: () => {
      toast.success("Settings saved");
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  type Field = { key: keyof FormShape; label: string; hint?: string; step?: string };

  const num = (f: Field) => (
    <div key={f.key} className="space-y-1.5">
      <Label className="text-xs">{f.label}</Label>
      <Input
        type="number"
        step={f.step ?? "0.01"}
        value={form[f.key] as number}
        onChange={(e) => setForm({ ...form, [f.key]: Number(e.target.value) })}
      />
      {f.hint && <p className="text-[10px] text-muted-foreground">{f.hint}</p>}
    </div>
  );

  return (
    <form
      className="max-w-2xl space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <h1 className="font-display text-2xl">PLATFORM SETTINGS</h1>
      <p className="text-[11px] text-muted-foreground -mt-2">
        Every value below is read by the live app on the next request — no redeploy needed.
      </p>

      <Tabs defaultValue="general">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="fees">Fees</TabsTrigger>
          <TabsTrigger value="escrow">Escrow</TabsTrigger>
          <TabsTrigger value="credits">Credits</TabsTrigger>
          <TabsTrigger value="chat">Chat & Listings</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4 pt-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Site announcement banner</Label>
            <Input
              value={form.announcement}
              maxLength={300}
              onChange={(e) => setForm({ ...form, announcement: e.target.value })}
              placeholder="e.g. ⚡ Weekend sale — use coupon SAVE10 for 10% off!"
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
            <Switch
              checked={form.maintenanceMode}
              onCheckedChange={(v) => setForm({ ...form, maintenanceMode: v })}
            />
          </div>
        </TabsContent>

        <TabsContent value="fees" className="space-y-4 pt-3">
          {num({
            key: "defaultCommissionPct",
            label: "Default commission %",
            hint: "Used when a category has no override.",
          })}
          {num({ key: "withdrawalFeeUsdt", label: "Seller withdrawal fee (USDT)" })}
          {num({ key: "minWithdrawalUsdt", label: "Minimum seller withdrawal (USDT)" })}
        </TabsContent>

        <TabsContent value="escrow" className="space-y-4 pt-3">
          {num({
            key: "autoConfirmHours",
            label: "Auto-confirm window (hours)",
            hint: "Delivered → completed if buyer is silent.",
            step: "1",
          })}
          {num({
            key: "paymentWindowMinutes",
            label: "Payment window (minutes)",
            hint: "Unpaid orders expire after this.",
            step: "1",
          })}
          {num({
            key: "disputeSlaHours",
            label: "Dispute SLA (hours)",
            hint: "Staff target for first response on open disputes.",
            step: "1",
          })}
        </TabsContent>

        <TabsContent value="credits" className="space-y-4 pt-3">
          {num({
            key: "creditWithdrawalFeePct",
            label: "Credit withdrawal fee (%)",
            hint: "Applied when buyers cash out store credits to crypto.",
          })}
          {num({
            key: "creditWithdrawalMinFeeUsdt",
            label: "Credit withdrawal minimum fee (USDT)",
          })}
        </TabsContent>

        <TabsContent value="chat" className="space-y-4 pt-3">
          {num({
            key: "presencePingSeconds",
            label: "Presence ping interval (seconds)",
            hint: "How often signed-in browsers refresh their 'online' status.",
            step: "1",
          })}
          {num({
            key: "attachmentMaxMb",
            label: "Order attachment max size (MB)",
            hint: "Per-file cap on delivery proof / evidence uploads.",
            step: "1",
          })}
          {num({
            key: "lowStockThreshold",
            label: "Low-stock badge threshold",
            hint: "Products with stock at or below this number show a low-stock badge.",
            step: "1",
          })}
          {num({
            key: "chatRateLimitPerMin",
            label: "Chat rate limit (messages / minute / user)",
            hint: "Hard cap to stop spam. 20 is a sane default.",
            step: "1",
          })}
          <div className="space-y-1.5">
            <Label className="text-xs">Automod severity</Label>
            <select
              value={form.automodSeverity}
              onChange={(e) =>
                setForm({ ...form, automodSeverity: e.target.value as "block" | "flag" })
              }
              className="w-full h-9 rounded-md border border-border bg-background px-2 text-xs"
            >
              <option value="block">Block — hard-reject violating messages</option>
              <option value="flag">Flag only — let it through, mark for staff review</option>
            </select>
            <p className="text-[10px] text-muted-foreground">
              Controls what happens when a buyer↔seller message trips an automod pattern (PII,
              off-platform payment, external links).
            </p>
          </div>
        </TabsContent>
      </Tabs>

      <Button type="submit" disabled={save.isPending}>
        {save.isPending ? "Saving…" : "Save settings"}
      </Button>
    </form>
  );
}
