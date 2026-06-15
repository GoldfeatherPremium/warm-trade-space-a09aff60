"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { adminUpdateProductAction, adminGetCategorySchemaAction } from "@/server/actions/admin";

type InitialData = Awaited<
  ReturnType<typeof import("@/server/actions/admin").adminGetProductAction>
>;
type SchemaField = {
  key: string;
  label: string;
  type: string;
  required?: boolean;
  help?: string;
  options?: string[];
};

const INPUT =
  "w-full bg-secondary border border-border rounded-md px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary/50";

function DynamicFields({
  fields,
  values,
  onChange,
}: {
  fields: SchemaField[];
  values: Record<string, string>;
  onChange: (v: Record<string, string>) => void;
}) {
  if (!fields.length) return null;
  const set = (key: string, v: string) => onChange({ ...values, [key]: v });
  return (
    <div className="bg-primary/5 border border-primary/30 rounded-lg p-3 space-y-3">
      <p className="text-xs font-bold text-primary">Category attributes</p>
      {fields.map((f) => (
        <div key={f.key} className="space-y-1">
          <label className="text-xs font-medium">
            {f.label}
            {f.required && <span className="text-destructive"> *</span>}
          </label>
          {f.type === "textarea" ? (
            <textarea
              required={!!f.required}
              rows={3}
              value={values[f.key] ?? ""}
              onChange={(e) => set(f.key, e.target.value)}
              className={INPUT}
            />
          ) : f.type === "select" ? (
            <select
              required={!!f.required}
              value={values[f.key] ?? ""}
              onChange={(e) => set(f.key, e.target.value)}
              className={INPUT}
            >
              <option value="">Select…</option>
              {(f.options ?? []).map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          ) : (
            <input
              required={!!f.required}
              type={f.type === "number" ? "number" : "text"}
              value={values[f.key] ?? ""}
              onChange={(e) => set(f.key, e.target.value)}
              className={INPUT}
            />
          )}
          {f.help && <p className="text-[10px] text-muted-foreground">{f.help}</p>}
        </div>
      ))}
    </div>
  );
}

export function EditProductClient({
  productId,
  initial,
}: {
  productId: string;
  initial: InitialData;
}) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const p = initial.product;

  const [form, setForm] = useState({
    title: (p.title as string) ?? "",
    description: (p.description as string) ?? "",
    categoryId: (p.category_id as string) ?? "",
    itemId: (p.item_id as string) ?? "",
    priceUsdt: String(((p.price_cents as number) ?? 0) / 100),
    warrantyHours: p.warranty_hours ? String(p.warranty_hours) : "",
    minQty: (p.min_qty as number) ?? 1,
    maxQty: (p.max_qty as number) ?? 50,
    maxOrdersAtOnce: (p.max_orders_at_once as number) ?? 10,
    subscriptionDuration: ((p.subscription_duration as string) ?? "") as
      | ""
      | "7d"
      | "14d"
      | "1m"
      | "3m"
      | "6m"
      | "12m"
      | "lifetime",
    region: (p.region as string) ?? "",
    platform: (p.platform as string) ?? "",
    requiredInfo: (p.required_info as string) ?? "",
    adminSeoDescription: (p.admin_seo_description as string) ?? "",
    status: ((p.status as string) ?? "active") as
      | "active"
      | "paused"
      | "rejected"
      | "out_of_stock"
      | "pending_review",
  });

  const [categoryAttrs, setCategoryAttrs] = useState<Record<string, string>>(() => {
    try {
      return JSON.parse((p.category_attrs as string) ?? "{}") as Record<string, string>;
    } catch {
      return {};
    }
  });

  const [sellerFields, setSellerFields] = useState<SchemaField[]>([]);
  const [allowedDurations, setAllowedDurations] = useState<string[]>([]);
  const [requiresSubscription, setRequiresSubscription] = useState(false);

  useEffect(() => {
    if (!form.categoryId) return;
    adminGetCategorySchemaAction(form.categoryId)
      .then((r) => {
        setSellerFields(r.schema?.sellerFields ?? []);
        setAllowedDurations(r.config?.allowedDurations ?? []);
        setRequiresSubscription(r.config?.requiresSubscription ?? false);
      })
      .catch(() => {});
  }, [form.categoryId]);

  const allowedItemIds = new Set(
    initial.itemCategories.filter((m) => m.category_id === form.categoryId).map((m) => m.item_id),
  );
  const mappedItemIds = new Set(initial.itemCategories.map((m) => m.item_id));
  const visibleItems = initial.items.filter(
    (i) => !mappedItemIds.has(i.id) || allowedItemIds.has(i.id),
  );

  function save(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    startTransition(async () => {
      try {
        await adminUpdateProductAction({
          productId,
          title: form.title,
          description: form.description,
          categoryId: form.categoryId,
          itemId: form.itemId || null,
          priceUsdt: parseFloat(form.priceUsdt),
          warrantyHours: form.warrantyHours ? Number(form.warrantyHours) : null,
          minQty: Number(form.minQty),
          maxQty: Number(form.maxQty),
          maxOrdersAtOnce: Number(form.maxOrdersAtOnce),
          subscriptionDuration: form.subscriptionDuration || null,
          region: form.region || undefined,
          platform: form.platform || undefined,
          requiredInfo: form.requiredInfo || undefined,
          adminSeoDescription: form.adminSeoDescription || undefined,
          categoryAttrs: Object.keys(categoryAttrs).length ? categoryAttrs : undefined,
          status: form.status,
        });
        router.push("/admin/products");
        router.refresh();
      } catch (err) {
        setMsg((err as Error).message);
      }
    });
  }

  return (
    <form className="max-w-2xl space-y-4" onSubmit={save}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl">EDIT PRODUCT</h1>
          <p className="text-[11px] text-muted-foreground">
            Seller: {p.seller_name as string} · ID: {productId}
          </p>
        </div>
        <Link
          href="/admin/products"
          className="text-[10px] text-muted-foreground hover:text-foreground"
        >
          ← Back to queue
        </Link>
      </div>

      {msg && (
        <p className="text-xs bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2 text-destructive">
          {msg}
        </p>
      )}

      <div className="space-y-1">
        <label className="text-xs font-medium">Title</label>
        <input
          required
          minLength={8}
          maxLength={120}
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          className={INPUT}
        />
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium">Category</label>
          <select
            required
            value={form.categoryId}
            onChange={(e) => setForm({ ...form, categoryId: e.target.value, itemId: "" })}
            className={INPUT}
          >
            {initial.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.commission_pct}% fee)
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium">Sub-category (item)</label>
          <select
            value={form.itemId}
            onChange={(e) => setForm({ ...form, itemId: e.target.value })}
            className={INPUT}
          >
            <option value="">— None —</option>
            {visibleItems.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium">Price (USDT)</label>
          <input
            type="number"
            min="0.5"
            step="0.01"
            required
            value={form.priceUsdt}
            onChange={(e) => setForm({ ...form, priceUsdt: e.target.value })}
            className={INPUT}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium">Status</label>
          <select
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value as typeof form.status })}
            className={INPUT}
          >
            <option value="active">active</option>
            <option value="paused">paused</option>
            <option value="out_of_stock">out_of_stock</option>
            <option value="pending_review">pending_review</option>
            <option value="rejected">rejected</option>
          </select>
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium">Description</label>
        <textarea
          rows={5}
          required
          minLength={30}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className={INPUT}
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium">
          Admin SEO description (keyword-rich, used in meta tags)
        </label>
        <textarea
          rows={4}
          value={form.adminSeoDescription}
          onChange={(e) => setForm({ ...form, adminSeoDescription: e.target.value })}
          placeholder="Optional. Rendered below seller copy and used for search engines."
          className={INPUT}
        />
      </div>

      {sellerFields.length > 0 && (
        <DynamicFields fields={sellerFields} values={categoryAttrs} onChange={setCategoryAttrs} />
      )}

      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium">Warranty hours (blank = category default)</label>
          <input
            type="number"
            min={1}
            value={form.warrantyHours}
            onChange={(e) => setForm({ ...form, warrantyHours: e.target.value })}
            className={INPUT}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium">Region</label>
          <input
            value={form.region}
            onChange={(e) => setForm({ ...form, region: e.target.value })}
            className={INPUT}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium">Platform</label>
          <input
            value={form.platform}
            onChange={(e) => setForm({ ...form, platform: e.target.value })}
            className={INPUT}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium">Required info from buyer</label>
          <input
            value={form.requiredInfo}
            onChange={(e) => setForm({ ...form, requiredInfo: e.target.value })}
            className={INPUT}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium">Min qty</label>
          <input
            type="number"
            min={1}
            value={form.minQty}
            onChange={(e) => setForm({ ...form, minQty: Number(e.target.value) })}
            className={INPUT}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium">Max qty</label>
          <input
            type="number"
            min={1}
            value={form.maxQty}
            onChange={(e) => setForm({ ...form, maxQty: Number(e.target.value) })}
            className={INPUT}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium">Max orders per checkout</label>
          <input
            type="number"
            min={1}
            value={form.maxOrdersAtOnce}
            onChange={(e) => setForm({ ...form, maxOrdersAtOnce: Number(e.target.value) })}
            className={INPUT}
          />
        </div>
        {requiresSubscription && allowedDurations.length > 0 && (
          <div className="space-y-1">
            <label className="text-xs font-medium">Subscription duration</label>
            <select
              value={form.subscriptionDuration}
              onChange={(e) =>
                setForm({
                  ...form,
                  subscriptionDuration: e.target.value as typeof form.subscriptionDuration,
                })
              }
              className={INPUT}
            >
              <option value="">— Use seller's pick —</option>
              {allowedDurations.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <button
        type="submit"
        disabled={busy}
        className="px-4 py-2 rounded-md text-sm font-bold bg-primary text-primary-foreground disabled:opacity-50"
      >
        {busy ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
