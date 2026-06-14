import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { getProductStock, removeStockItem, setManualStock, uploadStock } from "@/lib/api/seller";
import { dateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/seller/stock/$productId")({
  component: StockManager,
});

const STATUS_CLS: Record<string, string> = {
  available: "bg-accent/15 text-accent",
  reserved: "bg-yellow-500/15 text-yellow-400",
  delivered: "bg-blue-500/15 text-blue-400",
  invalid: "bg-muted text-muted-foreground",
};

const KIND_META: Record<string, { label: string; placeholder: string; hint: string }> = {
  code: {
    label: "GIFT CARD / REDEMPTION CODES",
    placeholder: "One code per line:\nXXXX-YYYY-ZZZZ\nAAAA-BBBB-CCCC",
    hint: "Encrypted at rest (AES-256) · duplicates auto-skipped · revealed only to the buyer on delivery.",
  },
  credentials: {
    label: "ACCOUNT CREDENTIALS",
    placeholder:
      "One account per line, format email:password\nuser1@mail.com:P@ssw0rd\nuser2@mail.com:Hunter2",
    hint: 'Format must be "email:password". Encrypted at rest, revealed only to the buyer on delivery.',
  },
  giftcard_image: {
    label: "GIFT CARD IMAGE URLS",
    placeholder: "One URL per line (uploaded gift-card images / PDFs)",
    hint: "Upload your card images elsewhere and paste signed URLs here, one per line.",
  },
};

function StockManager() {
  const { productId } = Route.useParams();
  const qc = useQueryClient();
  const [codes, setCodes] = useState("");
  const [manual, setManual] = useState<string>("");
  const { data } = useQuery({
    queryKey: ["stock", productId],
    queryFn: () => getProductStock({ data: { productId } }),
  });

  useEffect(() => {
    if (data?.product?.manual_stock != null) setManual(String(data.product.manual_stock));
  }, [data?.product?.manual_stock]);

  const upload = useMutation({
    mutationFn: () => uploadStock({ data: { productId, codes } }),
    onSuccess: (r) => {
      toast.success(
        `Added ${r.added} entries${r.duplicates ? ` · ${r.duplicates} duplicates skipped` : ""}`,
      );
      setCodes("");
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (stockItemId: string) => removeStockItem({ data: { stockItemId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["stock", productId] }),
    onError: (e: Error) => toast.error(e.message),
  });
  const saveManual = useMutation({
    mutationFn: () =>
      setManualStock({ data: { productId, manualStock: Math.max(0, Number(manual) || 0) } }),
    onSuccess: () => {
      toast.success("Stock updated");
      qc.invalidateQueries({ queryKey: ["stock", productId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!data) return <div className="py-16 text-center text-sm text-muted-foreground">Loading…</div>;

  const kind = data.product.delivery_kind || "code";
  const isManualKind = kind === "invite" || kind === "manual_text";
  const meta = KIND_META[kind] ?? KIND_META.code;

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <Link to="/seller/products" className="text-[10px] text-primary font-bold">
          ← BACK TO PRODUCTS
        </Link>
        <h1 className="font-display text-2xl mt-1">STOCK · {data.product.title}</h1>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          Delivery kind: <span className="font-bold text-foreground">{kind.toUpperCase()}</span>
        </p>
        <div className="flex gap-2 mt-2 flex-wrap">
          {data.counts.map((c) => (
            <span
              key={c.status}
              className={`text-[10px] font-bold px-2 py-1 rounded ${STATUS_CLS[c.status] ?? "bg-muted"}`}
            >
              {c.status.toUpperCase()}: {c.c}
            </span>
          ))}
        </div>
      </div>

      {isManualKind ? (
        <div className="bg-card border border-border rounded-lg p-4 space-y-3">
          <h2 className="text-xs font-bold tracking-widest">AVAILABLE STOCK</h2>
          <p className="text-[11px] text-muted-foreground">
            This category is fulfilled per-order (
            {kind === "invite"
              ? "you'll send an invite to the buyer's email after each order"
              : "you'll enter delivery details in a free-form box after each order"}
            ). Set how many units you can still fulfil.
          </p>
          <div className="flex gap-2 items-center">
            <Input
              type="number"
              min={0}
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              className="w-32"
            />
            <Button size="sm" onClick={() => saveManual.mutate()} disabled={saveManual.isPending}>
              Save stock
            </Button>
          </div>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg p-4 space-y-3">
          <h2 className="text-xs font-bold tracking-widest">BULK UPLOAD · {meta.label}</h2>
          <Textarea
            rows={6}
            value={codes}
            onChange={(e) => setCodes(e.target.value)}
            placeholder={meta.placeholder}
            className="font-mono text-xs"
          />
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              onClick={() => upload.mutate()}
              disabled={upload.isPending || !codes.trim()}
            >
              Upload {codes.split("\n").filter((l) => l.trim()).length || ""} entries
            </Button>
            <p className="text-[10px] text-muted-foreground">{meta.hint}</p>
          </div>
        </div>
      )}

      {!isManualKind && (
        <div className="bg-card border border-border rounded-lg p-4">
          <h2 className="text-xs font-bold tracking-widest mb-2">
            INVENTORY ({data.items.length})
          </h2>
          <div className="space-y-1 max-h-96 overflow-y-auto">
            {data.items.map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-2 text-xs border-b border-border/50 pb-1 last:border-0"
              >
                <span className="font-mono text-muted-foreground">#{s.id.slice(0, 8)}</span>
                <span
                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${STATUS_CLS[s.status] ?? "bg-muted"}`}
                >
                  {s.status.toUpperCase()}
                </span>
                <span className="text-[10px] text-muted-foreground flex-1">
                  added {dateTime(s.created_at)}
                  {s.delivered_at ? ` · delivered ${dateTime(s.delivered_at)}` : ""}
                </span>
                {s.status === "available" && (
                  <button
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => remove.mutate(s.id)}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
