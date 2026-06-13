import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { adminGetProduct, adminUpdateProduct } from "@/lib/api/admin";
import { getCategorySchema } from "@/lib/api/catalog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DynamicFields } from "@/components/dynamic-fields";

export const Route = createFileRoute("/admin/products_/$id/edit")({
  validateSearch: z.object({}).passthrough(),
  component: AdminProductEdit,
});

function AdminProductEdit() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["adminProduct", id],
    queryFn: () => adminGetProduct({ data: { productId: id } }),
  });

  const [form, setForm] = useState({
    title: "",
    description: "",
    categoryId: "",
    itemId: "",
    priceUsdt: "",
    warrantyHours: "",
    minQty: 1,
    maxQty: 50,
    maxOrdersAtOnce: 10,
    subscriptionDuration: "" as "" | "7d" | "14d" | "1m" | "3m" | "6m" | "12m" | "lifetime",
    region: "",
    platform: "",
    requiredInfo: "",
    adminSeoDescription: "",
    status: "active" as "active" | "paused" | "rejected" | "out_of_stock" | "pending_review",
  });

  const [categoryAttrs, setCategoryAttrs] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!data?.product) return;
    const p = data.product as Record<string, unknown>;
    setForm({
      title: (p.title as string) ?? "",
      description: (p.description as string) ?? "",
      categoryId: (p.category_id as string) ?? "",
      itemId: (p.item_id as string) ?? "",
      priceUsdt: String(((p.price_cents as number) ?? 0) / 100),
      warrantyHours: p.warranty_hours ? String(p.warranty_hours) : "",
      minQty: (p.min_qty as number) ?? 1,
      maxQty: (p.max_qty as number) ?? 50,
      region: (p.region as string) ?? "",
      platform: (p.platform as string) ?? "",
      requiredInfo: (p.required_info as string) ?? "",
      adminSeoDescription: (p.admin_seo_description as string) ?? "",
      status: (p.status as never) ?? "active",
    });
    if (p.category_attrs) {
      try {
        setCategoryAttrs(JSON.parse(p.category_attrs as string) as Record<string, string>);
      } catch {
        /* ignore */
      }
    }
  }, [data]);

  const { data: schema } = useQuery({
    queryKey: ["catSchema", form.categoryId],
    queryFn: () => getCategorySchema({ data: { categoryId: form.categoryId } }),
    enabled: !!form.categoryId,
  });
  const sellerFields = schema?.schema?.sellerFields ?? [];

  const save = useMutation({
    mutationFn: () =>
      adminUpdateProduct({
        data: {
          productId: id,
          title: form.title,
          description: form.description,
          categoryId: form.categoryId,
          itemId: form.itemId || null,
          priceUsdt: parseFloat(form.priceUsdt),
          warrantyHours: form.warrantyHours ? Number(form.warrantyHours) : null,
          minQty: Number(form.minQty),
          maxQty: Number(form.maxQty),
          region: form.region || undefined,
          platform: form.platform || undefined,
          requiredInfo: form.requiredInfo || undefined,
          adminSeoDescription: form.adminSeoDescription || undefined,
          categoryAttrs: Object.keys(categoryAttrs).length ? categoryAttrs : undefined,
          status: form.status,
        },
      }),
    onSuccess: () => {
      toast.success("Product updated.");
      qc.invalidateQueries();
      navigate({ to: "/admin/products" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || !data?.product) {
    return <div className="py-10 text-center text-muted-foreground text-sm">Loading…</div>;
  }
  const p = data.product as Record<string, unknown>;

  return (
    <form
      className="max-w-2xl space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl">EDIT PRODUCT</h1>
          <p className="text-[11px] text-muted-foreground">
            Seller: {p.seller_name as string} · ID: {p.id as string}
          </p>
        </div>
        <Link
          to="/admin/products"
          className="text-[10px] text-muted-foreground hover:text-foreground"
        >
          ← Back to queue
        </Link>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Title</Label>
        <Input
          required
          minLength={8}
          maxLength={120}
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
        />
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Category</Label>
          <select
            required
            value={form.categoryId}
            onChange={(e) => setForm({ ...form, categoryId: e.target.value, itemId: "" })}
            className="w-full bg-secondary border border-border rounded-md px-2 py-2 text-xs h-9"
          >
            {data.categories.map((c) => (
              <option key={c.id as string} value={c.id as string}>
                {c.name as string} ({c.commission_pct}% fee)
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Sub-category (selling item)</Label>
          <select
            value={form.itemId}
            onChange={(e) => setForm({ ...form, itemId: e.target.value })}
            className="w-full bg-secondary border border-border rounded-md px-2 py-2 text-xs h-9"
          >
            <option value="">— None —</option>
            {(() => {
              const allowedIds = new Set(
                data.itemCategories
                  .filter((m) => m.category_id === form.categoryId)
                  .map((m) => m.item_id),
              );
              const mappedItemIds = new Set(data.itemCategories.map((m) => m.item_id));
              return data.items
                .filter((i) => !mappedItemIds.has(i.id) || allowedIds.has(i.id))
                .map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ));
            })()}
          </select>
          <p className="text-[10px] text-muted-foreground">
            Items restricted to other categories are hidden.
          </p>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Price (USDT)</Label>
          <Input
            type="number"
            min="0.5"
            step="0.01"
            value={form.priceUsdt}
            onChange={(e) => setForm({ ...form, priceUsdt: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Status</Label>
          <select
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value as never })}
            className="w-full bg-secondary border border-border rounded-md px-2 py-2 text-xs h-9"
          >
            <option value="active">active</option>
            <option value="paused">paused</option>
            <option value="out_of_stock">out_of_stock</option>
            <option value="pending_review">pending_review</option>
            <option value="rejected">rejected</option>
          </select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Description</Label>
        <Textarea
          rows={5}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">
          Admin SEO description (long-form, shown below seller copy, used in meta tags)
        </Label>
        <Textarea
          rows={6}
          value={form.adminSeoDescription}
          onChange={(e) => setForm({ ...form, adminSeoDescription: e.target.value })}
          placeholder="Optional. Keyword-rich long-form copy used for search engines and rendered as a 'More about this listing' panel."
        />
      </div>

      {sellerFields.length > 0 && (
        <div className="bg-primary/5 border border-primary/30 rounded-lg p-3 space-y-2">
          <p className="text-xs font-bold text-primary">Category-specific attributes</p>
          <DynamicFields fields={sellerFields} values={categoryAttrs} onChange={setCategoryAttrs} />
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Warranty hours (blank = category default)</Label>
          <Input
            type="number"
            min={1}
            value={form.warrantyHours}
            onChange={(e) => setForm({ ...form, warrantyHours: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Region</Label>
          <Input
            value={form.region}
            onChange={(e) => setForm({ ...form, region: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Platform</Label>
          <Input
            value={form.platform}
            onChange={(e) => setForm({ ...form, platform: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Required info from buyer</Label>
          <Input
            value={form.requiredInfo}
            onChange={(e) => setForm({ ...form, requiredInfo: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Min qty</Label>
          <Input
            type="number"
            min={1}
            value={form.minQty}
            onChange={(e) => setForm({ ...form, minQty: Number(e.target.value) })}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Max qty</Label>
          <Input
            type="number"
            min={1}
            value={form.maxQty}
            onChange={(e) => setForm({ ...form, maxQty: Number(e.target.value) })}
          />
        </div>
      </div>

      <Button type="submit" disabled={save.isPending}>
        {save.isPending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}
