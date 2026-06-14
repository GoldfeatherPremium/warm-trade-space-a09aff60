"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  BookOpen,
  ListChecks,
  Search,
  Send,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import {
  getCatalogForFormAction,
  getCategorySchemaAction,
  listMyProductsAction,
  listProductImagesAction,
  saveProductAction,
  suggestItemAction,
  uploadProductImageAction,
  deleteProductImageAction,
} from "@/server/actions/seller";

type CatalogData = Awaited<ReturnType<typeof getCatalogForFormAction>>;
type CatSchema = Awaited<ReturnType<typeof getCategorySchemaAction>>;

const COUNTRIES = [
  "United States",
  "United Kingdom",
  "Canada",
  "Australia",
  "Germany",
  "France",
  "Spain",
  "Italy",
  "Netherlands",
  "Sweden",
  "Norway",
  "Denmark",
  "Finland",
  "Poland",
  "Portugal",
  "Ireland",
  "Belgium",
  "Austria",
  "Switzerland",
  "Brazil",
  "Mexico",
  "Argentina",
  "Chile",
  "Colombia",
  "Japan",
  "South Korea",
  "China",
  "Singapore",
  "Hong Kong",
  "Taiwan",
  "India",
  "Pakistan",
  "Bangladesh",
  "Indonesia",
  "Philippines",
  "Vietnam",
  "Thailand",
  "Malaysia",
  "Turkey",
  "Saudi Arabia",
  "UAE",
  "Egypt",
  "Israel",
  "South Africa",
  "Nigeria",
  "Kenya",
  "Russia",
  "Ukraine",
  "Czech Republic",
  "Romania",
  "Greece",
  "New Zealand",
];

function DynamicField({
  field,
  value,
  onChange,
}: {
  field: { key: string; label: string; type: string };
  value: string;
  onChange: (v: string) => void;
}) {
  const cls = "w-full bg-secondary border border-border rounded-md px-2 py-1.5 text-xs";
  if (field.type === "textarea")
    return (
      <textarea value={value} onChange={(e) => onChange(e.target.value)} className={cls} rows={3} />
    );
  return (
    <input
      type={field.type === "number" ? "number" : "text"}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cls}
    />
  );
}

export default function NewProductPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit") ?? undefined;
  const fileInput = useRef<HTMLInputElement>(null);

  const [catalog, setCatalog] = useState<CatalogData | null>(null);
  const [catSchema, setCatSchema] = useState<CatSchema | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();

  const [form, setForm] = useState({
    categoryId: "",
    title: "",
    description: "",
    deliveryType: "auto" as "auto" | "manual",
    deliverySlaMinutes: 60,
    warrantyHours: "" as string,
    priceUsdt: "" as string,
    minQty: 1,
    maxQty: 50,
    maxOrdersAtOnce: 10,
    subscriptionDuration: "" as string,
    manualStock: "" as string,
    platform: "",
    requiredInfo: "",
  });
  const [regionMode, setRegionMode] = useState<"global" | "country">("global");
  const [regionCountry, setRegionCountry] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [variants, setVariants] = useState<Array<{ title: string; priceUsdt: string }>>([]);
  const [expiresInDays, setExpiresInDays] = useState(0);
  const [insuranceDays, setInsuranceDays] = useState(0);
  const [categoryAttrs, setCategoryAttrs] = useState<Record<string, string>>({});

  const [itemId, setItemId] = useState("");
  const [itemQuery, setItemQuery] = useState("");
  const [itemOpen, setItemOpen] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestName, setSuggestName] = useState("");
  const [imageIds, setImageIds] = useState<string[]>([]);

  // Load catalog
  useEffect(() => {
    startTransition(async () => {
      const d = await getCatalogForFormAction();
      setCatalog(d);
    });
  }, []);

  // Load category schema when category changes
  useEffect(() => {
    if (!form.categoryId) {
      setCatSchema(null);
      return;
    }
    startTransition(async () => {
      const s = await getCategorySchemaAction(form.categoryId);
      setCatSchema(s);
    });
  }, [form.categoryId]);

  // Hydrate when editing
  useEffect(() => {
    if (!editId) return;
    startTransition(async () => {
      const data = await listMyProductsAction();
      const p = data.products.find((x) => x.id === editId);
      if (!p) return;
      setForm({
        categoryId: p.category_id as string,
        title: p.title as string,
        description: p.description as string,
        deliveryType: p.delivery_type as "auto" | "manual",
        deliverySlaMinutes: p.delivery_sla_minutes as number,
        warrantyHours: p.warranty_hours ? String(p.warranty_hours) : "",
        priceUsdt: String((p.price_cents as number) / 100),
        minQty: p.min_qty as number,
        maxQty: p.max_qty as number,
        maxOrdersAtOnce: (p.max_orders_at_once as number) ?? 10,
        subscriptionDuration: (p.subscription_duration as string) ?? "",
        manualStock: p.manual_stock != null ? String(p.manual_stock) : "",
        platform: (p.platform as string) ?? "",
        requiredInfo: (p.required_info as string) ?? "",
      });
      const region = (p.region as string) ?? "";
      if (!region || region.toLowerCase() === "global") {
        setRegionMode("global");
      } else {
        setRegionMode("country");
        setRegionCountry(region);
      }
      setItemId((p.item_id as string) ?? "");
      const attrs = p.category_attrs as string | null;
      if (attrs) {
        try {
          setCategoryAttrs(JSON.parse(attrs) as Record<string, string>);
        } catch (_) {
          // invalid JSON stored — ignore
        }
      }
      const imgs = await listProductImagesAction(editId);
      setImageIds(imgs.images.map((i) => i.id));
    });
  }, [editId]);

  const selectedItem = catalog?.items.find((i) => i.id === itemId);
  const filteredItems = useMemo(() => {
    const q = itemQuery.trim().toLowerCase();
    const all = catalog?.items ?? [];
    if (!q) return all.slice(0, 40);
    return all.filter((i) => i.name.toLowerCase().includes(q)).slice(0, 40);
  }, [catalog, itemQuery]);

  const allowedCategories = useMemo(() => {
    const all = catalog?.categories ?? [];
    if (!itemId || !selectedItem || selectedItem.categoryIds.length === 0) return all;
    const filtered = all.filter((c) => selectedItem.categoryIds.includes(c.id));
    return filtered.length > 0 ? filtered : all;
  }, [catalog, itemId, selectedItem]);

  const selectedCat = catalog?.categories.find((c) => c.id === form.categoryId);
  const sellerFields = catSchema?.schema?.sellerFields ?? [];
  const requires = !!catSchema?.config?.requiresSubscription;
  const allowedDurations = catSchema?.config?.allowedDurations?.length
    ? catSchema.config.allowedDurations
    : ["7d", "14d", "1m", "3m", "6m", "12m", "lifetime"];

  const uploadImage = async (file: File) => {
    if (file.size > 2 * 1024 * 1024) {
      setError("Image must be under 2 MB.");
      return;
    }
    const dataBase64 = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => {
        const s = String(r.result);
        resolve(s.slice(s.indexOf(",") + 1));
      };
      r.onerror = () => reject(new Error("Could not read file."));
      r.readAsDataURL(file);
    });
    startTransition(async () => {
      try {
        const result = await uploadProductImageAction(file.type, dataBase64);
        setImageIds((prev) => [...prev, result.id]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Upload failed");
      }
    });
  };

  const removeImage = (id: string) => {
    startTransition(async () => {
      try {
        await deleteProductImageAction(id);
        setImageIds((prev) => prev.filter((x) => x !== id));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error");
      }
    });
  };

  const sendSuggest = () => {
    if (suggestName.trim().length < 2) return;
    startTransition(async () => {
      try {
        await suggestItemAction(suggestName.trim());
        setSuggesting(false);
        setSuggestName("");
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error");
      }
    });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (regionMode === "country" && !regionCountry) {
      setError("Select a country or switch to Global.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await saveProductAction({
          productId: editId,
          itemId: itemId || undefined,
          categoryId: form.categoryId,
          title: form.title,
          description: form.description,
          imageIds,
          deliveryType: form.deliveryType,
          deliverySlaMinutes: Number(form.deliverySlaMinutes),
          warrantyHours: form.warrantyHours ? Number(form.warrantyHours) : null,
          priceUsdt: parseFloat(form.priceUsdt),
          minQty: Number(form.minQty),
          maxQty: Number(form.maxQty),
          maxOrdersAtOnce: Number(form.maxOrdersAtOnce),
          subscriptionDuration: form.subscriptionDuration || null,
          manualStock: form.manualStock !== "" ? Number(form.manualStock) : null,
          region: regionMode === "global" ? "Global" : regionCountry || undefined,
          platform: form.platform || undefined,
          requiredInfo: form.requiredInfo || undefined,
          categoryAttrs: Object.keys(categoryAttrs).length ? categoryAttrs : undefined,
          variants: variants
            .filter((v) => v.title.trim() && parseFloat(v.priceUsdt) > 0)
            .map((v) => ({ title: v.title.trim(), priceUsdt: parseFloat(v.priceUsdt) })),
          expiresInDays,
          insuranceDays,
        });
        router.push("/seller/products");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error");
      }
    });
  };

  const inputCls = "w-full bg-secondary border border-border rounded-md px-3 py-2 text-xs";
  const labelCls = "text-[10px] font-bold tracking-widest text-muted-foreground";

  return (
    <form className="max-w-2xl space-y-4" onSubmit={submit}>
      <h1 className="font-display text-2xl">{editId ? "EDIT LISTING" : "CREATE LISTING"}</h1>

      <div className="bg-yellow-500/10 border border-yellow-500/40 rounded-lg p-3 flex gap-2 text-[11px] leading-relaxed">
        <AlertTriangle className="size-4 text-yellow-400 shrink-0 mt-0.5" />
        <span>
          Sellers are prohibited from listing stolen gift cards, hacked accounts, or unauthorized
          credentials. Violations lead to permanent ban. All listings go through staff review.
        </span>
      </div>

      {error && (
        <p className="text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
          {error}
        </p>
      )}

      {/* Item picker */}
      <h2 className="text-sm font-bold flex items-center gap-2 pt-1">
        <BookOpen className="size-4 text-primary" /> 1. Select item
      </h2>
      <div className="space-y-1.5 relative">
        <label className={labelCls}>Search game, brand or service</label>
        {selectedItem ? (
          <div className="flex items-center justify-between bg-secondary border border-primary/50 rounded-md px-3 py-2">
            <span className="text-sm font-bold">{selectedItem.name}</span>
            <button
              type="button"
              onClick={() => {
                setItemId("");
                setItemQuery("");
                setForm({ ...form, categoryId: "" });
              }}
              className="text-[10px] text-muted-foreground hover:text-foreground"
            >
              Change
            </button>
          </div>
        ) : (
          <>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                value={itemQuery}
                onChange={(e) => {
                  setItemQuery(e.target.value);
                  setItemOpen(true);
                }}
                onFocus={() => setItemOpen(true)}
                placeholder="Type to search e.g. Valorant, Steam, Netflix…"
                className="w-full pl-8 bg-secondary border border-border rounded-md px-3 py-2 text-xs"
              />
            </div>
            {itemOpen && filteredItems.length > 0 && (
              <div className="absolute z-20 left-0 right-0 mt-1 bg-card border border-border rounded-md max-h-60 overflow-auto shadow-lg">
                {filteredItems.map((i) => (
                  <button
                    type="button"
                    key={i.id}
                    onClick={() => {
                      setItemId(i.id);
                      setItemQuery("");
                      setItemOpen(false);
                      setForm({ ...form, categoryId: "" });
                    }}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-secondary"
                  >
                    {i.name}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
        <button
          type="button"
          className="text-[10px] text-primary font-bold"
          onClick={() => setSuggesting(!suggesting)}
        >
          Can't find it? Request a new item →
        </button>
        {suggesting && (
          <div className="flex gap-2 pt-1">
            <input
              placeholder="Item name (e.g. LinkedIn, Spotify)"
              value={suggestName}
              onChange={(e) => setSuggestName(e.target.value)}
              className="flex-1 bg-secondary border border-border rounded-md px-3 py-1.5 text-xs"
            />
            <button
              type="button"
              disabled={busy || suggestName.trim().length < 2}
              onClick={sendSuggest}
              className="bg-primary text-primary-foreground text-xs font-bold px-3 py-1.5 rounded-md disabled:opacity-50"
            >
              <Send className="size-3" />
            </button>
          </div>
        )}
      </div>

      {/* Category */}
      <h2 className="text-sm font-bold flex items-center gap-2 pt-1">
        <BookOpen className="size-4 text-primary" /> 2. Category
      </h2>
      <div className="space-y-1.5">
        <label className={labelCls}>Sub-category</label>
        <select
          required
          value={form.categoryId}
          onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
          className={inputCls + " h-9"}
        >
          <option value="">{catalog ? "Select…" : "Loading…"}</option>
          {allowedCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.icon} {c.name} ({c.commission_pct}% fee)
            </option>
          ))}
        </select>
        {selectedCat?.risk_tier === "high" && (
          <p className="text-[10px] text-yellow-400">
            High-risk category: extended warranty recommended.
          </p>
        )}
      </div>

      {/* Region */}
      <h2 className="text-sm font-bold flex items-center gap-2 pt-1">
        <BookOpen className="size-4 text-primary" /> 3. Region
      </h2>
      <div className="space-y-1.5">
        <div className="flex gap-2">
          {["global", "country"].map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setRegionMode(m as "global" | "country")}
              className={`flex-1 px-3 py-2 rounded-md text-xs font-bold border ${regionMode === m ? "border-primary bg-primary/15 text-primary" : "border-border bg-secondary hover:bg-border"}`}
            >
              {m === "global" ? "🌍 Global" : "📍 Specific country"}
            </button>
          ))}
        </div>
        {regionMode === "country" && (
          <select
            required
            value={regionCountry}
            onChange={(e) => setRegionCountry(e.target.value)}
            className={inputCls + " h-9"}
          >
            <option value="">Select country…</option>
            {COUNTRIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Dynamic fields */}
      {sellerFields.length > 0 && (
        <div className="bg-primary/5 border border-primary/30 rounded-lg p-3 space-y-2">
          <p className="text-xs font-bold text-primary">Required for this category</p>
          {sellerFields.map((f) => (
            <label key={f.key} className="block">
              <span className={labelCls}>{f.label}</span>
              <DynamicField
                field={f}
                value={categoryAttrs[f.key] ?? ""}
                onChange={(v) => setCategoryAttrs({ ...categoryAttrs, [f.key]: v })}
              />
            </label>
          ))}
        </div>
      )}

      {/* Details */}
      <h2 className="text-sm font-bold flex items-center gap-2 pt-1">
        <BookOpen className="size-4 text-primary" /> 4. Product details
      </h2>

      <div className="space-y-1.5">
        <label className={labelCls}>Title (min. 8 chars)</label>
        <input
          required
          minLength={8}
          maxLength={120}
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          className={inputCls}
        />
      </div>

      <div className="space-y-1.5">
        <label className={labelCls}>Price (USDT)</label>
        <input
          required
          type="number"
          min="0.5"
          step="0.01"
          value={form.priceUsdt}
          onChange={(e) => setForm({ ...form, priceUsdt: e.target.value })}
          className={inputCls}
        />
      </div>

      <div className="space-y-1.5">
        <label className={labelCls}>Description (min. 30 chars)</label>
        <textarea
          required
          minLength={30}
          rows={5}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="What exactly does the buyer get? Delivery method, region locks, warranty terms…"
          className={inputCls}
        />
      </div>

      {/* Images */}
      <div className="space-y-1.5">
        <label className={labelCls}>Product images (up to 8, max 2 MB each)</label>
        <div className="flex gap-2 flex-wrap">
          {imageIds.map((id) => (
            <div
              key={id}
              className="relative size-20 rounded-md overflow-hidden border border-border"
            >
              <img src={`/api/public/img/${id}`} alt="" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => removeImage(id)}
                className="absolute top-0.5 right-0.5 bg-black/70 rounded-full p-0.5 text-white hover:bg-red-600"
                aria-label="Remove image"
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
          {imageIds.length < 8 && (
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={busy}
              className="size-20 rounded-md border-2 border-dashed border-border hover:border-primary flex flex-col items-center justify-center text-[10px] text-muted-foreground gap-1"
            >
              <Upload className="size-4" />
              {busy ? "Uploading…" : "Add image"}
            </button>
          )}
        </div>
        <input
          ref={fileInput}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) uploadImage(f);
            e.target.value = "";
          }}
        />
        {imageIds.length === 0 && (
          <p className="text-[10px] text-yellow-400">
            Add at least one image — listings with photos sell faster.
          </p>
        )}
      </div>

      {/* Delivery */}
      <h2 className="text-sm font-bold flex items-center gap-2 pt-2">
        <ListChecks className="size-4 text-primary" /> Delivery Option
      </h2>
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className={labelCls}>Delivery type</label>
          <select
            value={form.deliveryType}
            disabled={!!editId}
            onChange={(e) =>
              setForm({ ...form, deliveryType: e.target.value as "auto" | "manual" })
            }
            className={inputCls + " h-9"}
          >
            <option value="auto">⚡ Auto — codes delivered instantly from stock</option>
            <option value="manual">🕐 Manual — you deliver within an SLA</option>
          </select>
        </div>
        {form.deliveryType === "manual" && (
          <div className="space-y-1.5">
            <label className={labelCls}>Delivery ETA (guaranteed)</label>
            <select
              value={form.deliverySlaMinutes}
              onChange={(e) => setForm({ ...form, deliverySlaMinutes: Number(e.target.value) })}
              className={inputCls + " h-9"}
            >
              {[15, 30, 60, 180, 360, 720, 1440, 4320, 10080].map((m) => (
                <option key={m} value={m}>
                  {m < 60
                    ? `${m} minutes`
                    : m < 1440
                      ? `${m / 60} hour${m / 60 > 1 ? "s" : ""}`
                      : `${m / 1440} day${m / 1440 > 1 ? "s" : ""}`}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
      {form.deliveryType === "manual" && (
        <div className="space-y-1.5">
          <label className={labelCls}>Info required from buyer at checkout</label>
          <input
            value={form.requiredInfo}
            onChange={(e) => setForm({ ...form, requiredInfo: e.target.value })}
            placeholder="e.g. game account ID + server region"
            className={inputCls}
          />
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <label className={labelCls}>Min qty</label>
          <input
            type="number"
            min={1}
            value={form.minQty}
            onChange={(e) => setForm({ ...form, minQty: Number(e.target.value) })}
            className={inputCls}
          />
        </div>
        <div className="space-y-1.5">
          <label className={labelCls}>Max qty</label>
          <input
            type="number"
            min={1}
            value={form.maxQty}
            onChange={(e) => setForm({ ...form, maxQty: Number(e.target.value) })}
            className={inputCls}
          />
        </div>
        <div className="space-y-1.5">
          <label className={labelCls}>Platform</label>
          <input
            value={form.platform}
            onChange={(e) => setForm({ ...form, platform: e.target.value })}
            placeholder="PC / PS5 / iOS"
            className={inputCls}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className={labelCls}>Max orders per checkout</label>
          <input
            type="number"
            min={1}
            value={form.maxOrdersAtOnce}
            onChange={(e) => setForm({ ...form, maxOrdersAtOnce: Number(e.target.value) })}
            className={inputCls}
          />
        </div>
        {form.deliveryType === "manual" && (
          <div className="space-y-1.5">
            <label className={labelCls}>Available stock (manual)</label>
            <input
              type="number"
              min={0}
              value={form.manualStock}
              onChange={(e) => setForm({ ...form, manualStock: e.target.value })}
              placeholder="leave blank for unlimited"
              className={inputCls}
            />
          </div>
        )}
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1.5 bg-primary/5 border border-primary/30 rounded-lg p-3">
          <label className="text-xs font-bold text-primary">
            Subscription duration {requires ? "*" : "(optional)"}
          </label>
          <select
            required={requires}
            value={form.subscriptionDuration}
            onChange={(e) => setForm({ ...form, subscriptionDuration: e.target.value })}
            className={inputCls + " h-9"}
          >
            <option value="">{requires ? "Select…" : "Not a subscription"}</option>
            {allowedDurations.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5 bg-accent/5 border border-accent/30 rounded-lg p-3">
          <label className="text-xs font-bold text-accent">Insurance period</label>
          <div className="flex gap-1.5 flex-wrap">
            {[0, 7, 15, 30, 60, 90].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setInsuranceDays(d)}
                className={`px-2.5 py-1.5 rounded-md text-[11px] font-bold border ${insuranceDays === d ? "border-accent bg-accent/15 text-accent" : "border-border bg-secondary hover:bg-border"}`}
              >
                {d === 0 ? "None" : `${d}d`}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className={labelCls}>
          Warranty hours override (blank = category default
          {selectedCat ? `: ${selectedCat.default_warranty_hours}h` : ""})
        </label>
        <input
          type="number"
          min={1}
          value={form.warrantyHours}
          onChange={(e) => setForm({ ...form, warrantyHours: e.target.value })}
          placeholder={selectedCat ? `${selectedCat.default_warranty_hours}` : ""}
          className={inputCls}
        />
      </div>

      {/* Variants */}
      <div className="space-y-1.5">
        <label className={labelCls}>Custom price tiers (optional)</label>
        <p className="text-[10px] text-muted-foreground">
          Offer multiple options e.g. "1 Month" / "3 Months". Buyers pick one at checkout.
        </p>
        {variants.map((v, i) => (
          <div key={i} className="flex gap-2">
            <input
              placeholder={`Option ${i + 1} title`}
              value={v.title}
              onChange={(e) =>
                setVariants(variants.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))
              }
              className={inputCls}
            />
            <input
              type="number"
              min="0.5"
              step="0.01"
              placeholder="USDT"
              className="w-28 bg-secondary border border-border rounded-md px-3 py-2 text-xs"
              value={v.priceUsdt}
              onChange={(e) =>
                setVariants(
                  variants.map((x, j) => (j === i ? { ...x, priceUsdt: e.target.value } : x)),
                )
              }
            />
            <button
              type="button"
              onClick={() => setVariants(variants.filter((_, j) => j !== i))}
              className="text-muted-foreground hover:text-destructive px-2"
            >
              ×
            </button>
          </div>
        ))}
        {variants.length < 20 && (
          <button
            type="button"
            onClick={() => setVariants([...variants, { title: "", priceUsdt: "" }])}
            className="bg-secondary text-xs font-bold px-3 py-1.5 rounded-md hover:bg-border"
          >
            ⊕ Add tier
          </button>
        )}
      </div>

      <div className="space-y-1.5">
        <label className={labelCls}>⏱ Listing expiration</label>
        <div className="flex gap-2 flex-wrap">
          {[0, 7, 15, 30].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setExpiresInDays(d)}
              className={`px-3 py-2 rounded-md text-xs font-bold border ${expiresInDays === d ? "border-primary bg-primary/15 text-primary" : "border-border bg-secondary hover:bg-border"}`}
            >
              {d === 0 ? "No expiry" : `${d} Days`}
            </button>
          ))}
        </div>
      </div>

      {/* Submit */}
      <h2 className="text-sm font-bold flex items-center gap-2 pt-2">
        <Send className="size-4 text-primary" /> Publish
      </h2>
      <label className="flex items-start gap-2 text-[11px] text-muted-foreground leading-relaxed cursor-pointer">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5"
        />
        <span>
          I have read and agree to the seller policy. I confirm this product does not violate any
          terms of service.
        </span>
      </label>
      <button
        type="submit"
        disabled={busy || !agreed}
        className="bg-primary text-primary-foreground text-xs font-bold tracking-widest px-6 py-3 rounded-lg hover:opacity-90 disabled:opacity-50 w-full sm:w-auto"
      >
        {busy ? "Submitting…" : editId ? "Save & resubmit for review" : "Submit for review"}
      </button>
    </form>
  );
}
