import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  adminAdjustCredits,
  adminGetUserCredits,
  adminListCredits,
} from "@/lib/api/credits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { usdt } from "@/lib/format";

export const Route = createFileRoute("/admin/credits")({
  head: () => ({ meta: [{ title: "Buyer Credits — Admin" }] }),
  component: AdminCredits,
});

function AdminCredits() {
  const [q, setQ] = useState("");
  const [withBalanceOnly, setWB] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: ["adminCredits", q, withBalanceOnly],
    queryFn: () => adminListCredits({ data: { q, withBalanceOnly } }),
  });
  const detail = useQuery({
    queryKey: ["adminUserCredits", selected],
    queryFn: () => adminGetUserCredits({ data: { userId: selected! } }),
    enabled: !!selected,
  });
  const [adj, setAdj] = useState({ amount: "", note: "" });
  const adjust = useMutation({
    mutationFn: () =>
      adminAdjustCredits({
        data: {
          userId: selected!,
          amountCents: Math.round(Number(adj.amount || 0) * 100),
          note: adj.note,
        },
      }),
    onSuccess: () => {
      toast.success("Adjustment recorded.");
      setAdj({ amount: "", note: "" });
      qc.invalidateQueries({ queryKey: ["adminCredits"] });
      qc.invalidateQueries({ queryKey: ["adminUserCredits", selected] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="grid md:grid-cols-[1fr_1.2fr] gap-4">
      <section className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-3 py-2.5 border-b border-border flex items-center gap-2">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search username / email…"
            className="h-8 text-xs"
          />
          <label className="flex items-center gap-2 shrink-0 text-[10px] font-bold uppercase tracking-wider">
            <Switch checked={withBalanceOnly} onCheckedChange={setWB} /> >0
          </label>
        </div>
        <div className="divide-y divide-border max-h-[70vh] overflow-y-auto">
          {(list.data?.rows ?? []).map((r) => (
            <button
              key={r.user_id}
              onClick={() => setSelected(r.user_id)}
              className={`w-full text-left px-3 py-2 hover:bg-secondary flex items-center justify-between gap-3 ${
                selected === r.user_id ? "bg-secondary" : ""
              }`}
            >
              <div className="min-w-0">
                <p className="text-xs font-bold truncate">{r.username}</p>
                <p className="text-[10px] text-muted-foreground truncate">{r.email}</p>
              </div>
              <p className="text-sm font-mono text-accent shrink-0">{usdt(r.balance_cents)}</p>
            </button>
          ))}
          {(list.data?.rows.length ?? 0) === 0 && (
            <p className="text-xs text-muted-foreground p-6 text-center">No matches.</p>
          )}
        </div>
      </section>

      <section className="bg-card border border-border rounded-lg">
        {!selected ? (
          <p className="text-xs text-muted-foreground p-10 text-center">
            Select a user to view ledger and adjust.
          </p>
        ) : (
          <div className="p-4 space-y-4">
            <div>
              <p className="text-[10px] font-bold tracking-widest text-muted-foreground">USER</p>
              <p className="font-bold">{detail.data?.user?.username}</p>
              <p className="text-[10px] text-muted-foreground">{detail.data?.user?.email}</p>
              <p className="font-display text-2xl text-accent mt-2">
                {usdt(detail.data?.balance ?? 0)}
              </p>
            </div>
            <div className="grid grid-cols-[1fr_2fr_auto] gap-2 items-end bg-secondary/40 rounded-md p-3">
              <div>
                <Label className="text-[10px]">Amount (USDT, negative to revoke)</Label>
                <Input
                  value={adj.amount}
                  onChange={(e) => setAdj({ ...adj, amount: e.target.value })}
                  placeholder="e.g. 5 or -3.50"
                  className="h-8"
                />
              </div>
              <div>
                <Label className="text-[10px]">Reason (audit log)</Label>
                <Input
                  value={adj.note}
                  onChange={(e) => setAdj({ ...adj, note: e.target.value })}
                  placeholder="Goodwill, contest win, etc."
                  className="h-8"
                />
              </div>
              <Button
                size="sm"
                disabled={adjust.isPending || !adj.amount || !adj.note}
                onClick={() => adjust.mutate()}
              >
                Apply
              </Button>
            </div>
            <div className="border border-border rounded-md max-h-[55vh] overflow-y-auto divide-y divide-border">
              {(detail.data?.ledger ?? []).map((row) => (
                <div key={row.id} className="px-3 py-2 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-bold truncate">
                      {row.note ?? row.type}{" "}
                      <span className="text-[10px] font-normal text-muted-foreground uppercase tracking-widest">
                        {row.source ?? row.type}
                      </span>
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(row.created_at).toLocaleString()}
                    </p>
                  </div>
                  <p
                    className={`text-sm font-mono font-bold shrink-0 ${
                      row.amount_cents > 0 ? "text-accent" : ""
                    }`}
                  >
                    {row.amount_cents > 0 ? "+" : ""}
                    {usdt(row.amount_cents)}
                  </p>
                </div>
              ))}
              {(detail.data?.ledger.length ?? 0) === 0 && (
                <p className="text-xs text-muted-foreground p-6 text-center">No history.</p>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
