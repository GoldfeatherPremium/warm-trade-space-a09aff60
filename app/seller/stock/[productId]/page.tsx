"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import {
  getProductStockAction,
  removeStockItemAction,
  setManualStockAction,
  uploadStockAction,
} from "@/server/actions/seller";
import { dateTime } from "@/lib/format";

type StockData = Awaited<ReturnType<typeof getProductStockAction>>;

const STATUS_CLS: Record<string, string> = {
  available: "bg-accent/15 text-accent",
  reserved: "bg-warning/15 text-warning",
  delivered: "bg-success/15 text-success",
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
    placeholder: "One account per line, format email:password\nuser1@mail.com:P@ssw0rd",
    hint: 'Format must be "email:password". Encrypted at rest.',
  },
  giftcard_image: {
    label: "GIFT CARD IMAGE URLS",
    placeholder: "One URL per line",
    hint: "Paste signed URLs here, one per line.",
  },
};

export default function StockManagerPage({ params }: { params: Promise<{ productId: string }> }) {
  const [productId, setProductId] = useState<string | null>(null);
  const [data, setData] = useState<StockData | null>(null);
  const [codes, setCodes] = useState("");
  const [manual, setManual] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    params.then(({ productId: pid }) => {
      setProductId(pid);
      startTransition(async () => {
        const d = await getProductStockAction(pid);
        setData(d);
        if (d.product.manual_stock != null) setManual(String(d.product.manual_stock));
      });
    });
    // params is a stable Promise resolved once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reload = () => {
    if (!productId) return;
    startTransition(async () => {
      const d = await getProductStockAction(productId);
      setData(d);
      if (d.product.manual_stock != null) setManual(String(d.product.manual_stock));
    });
  };

  const upload = () => {
    if (!productId) return;
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      try {
        const r = await uploadStockAction(productId, codes);
        setSuccess(
          `Added ${r.added} entries${r.duplicates ? ` · ${r.duplicates} duplicates skipped` : ""}`,
        );
        setCodes("");
        reload();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error");
      }
    });
  };

  const removeItem = (stockItemId: string) => {
    setError(null);
    startTransition(async () => {
      try {
        await removeStockItemAction(stockItemId);
        reload();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error");
      }
    });
  };

  const saveManual = () => {
    if (!productId) return;
    setError(null);
    startTransition(async () => {
      try {
        await setManualStockAction(productId, Math.max(0, Number(manual) || 0));
        setSuccess("Stock updated");
        reload();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error");
      }
    });
  };

  if (!data) return <div className="py-16 text-center text-sm text-muted-foreground">Loading…</div>;

  const kind = data.product.delivery_kind || "code";
  const isManualKind = kind === "invite" || kind === "manual_text";
  const meta = KIND_META[kind] ?? KIND_META.code;

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <Link href="/seller/products" className="text-[10px] text-primary font-bold">
          ← BACK TO PRODUCTS
        </Link>
        <h1 className="font-display text-2xl mt-1">STOCK · {data.product.title}</h1>
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

      {error && (
        <p className="text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
          {error}
        </p>
      )}
      {success && (
        <p className="text-xs text-accent bg-accent/10 border border-accent/30 rounded-md px-3 py-2">
          {success}
        </p>
      )}

      {isManualKind ? (
        <div className="bg-card border border-border rounded-lg p-4 space-y-3">
          <h2 className="text-xs font-bold tracking-widest">AVAILABLE STOCK</h2>
          <div className="flex gap-2 items-center">
            <input
              type="number"
              min={0}
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              className="w-32 bg-secondary border border-border rounded-md px-3 py-2 text-xs"
            />
            <button
              onClick={saveManual}
              className="bg-primary text-primary-foreground text-xs font-bold px-4 py-2 rounded-md hover:opacity-90"
            >
              Save stock
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg p-4 space-y-3">
          <h2 className="text-xs font-bold tracking-widest">BULK UPLOAD · {meta.label}</h2>
          <textarea
            rows={6}
            value={codes}
            onChange={(e) => setCodes(e.target.value)}
            placeholder={meta.placeholder}
            className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-xs font-mono"
          />
          <div className="flex items-center gap-3">
            <button
              onClick={upload}
              disabled={!codes.trim()}
              className="bg-primary text-primary-foreground text-xs font-bold px-4 py-2 rounded-md hover:opacity-90 disabled:opacity-50"
            >
              Upload {codes.split("\n").filter((l) => l.trim()).length || ""} entries
            </button>
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
                    onClick={() => removeItem(s.id)}
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
