"use client";

import { useEffect, useState, useTransition } from "react";
import {
  adminListCategoriesAction,
  adminSaveCategoryAction,
  adminEnsureBaseCategoriesAction,
} from "@/server/actions/admin";

type Category = Awaited<ReturnType<typeof adminListCategoriesAction>>[number];

const DURATION_OPTIONS = ["7d", "14d", "1m", "3m", "6m", "12m", "lifetime"] as const;
type Duration = (typeof DURATION_OPTIONS)[number];

const DELIVERY_KINDS = [
  { value: "code", label: "Code / gift card code (bulk codes)" },
  { value: "credentials", label: "Account credentials (email + password)" },
  { value: "invite", label: "Invite sent to buyer email" },
  { value: "giftcard_image", label: "Gift card image upload" },
  { value: "manual_text", label: "Manual text delivery (per-order)" },
] as const;

const EMPTY = {
  categoryId: undefined as string | undefined,
  name: "",
  slug: "",
  icon: "📦",
  sort: undefined as number | undefined,
  defaultWarrantyHours: 72,
  commissionPct: 8,
  riskTier: "normal" as "normal" | "high",
  isActive: true,
  submissionSchema: "",
  requiresSubscription: false,
  allowedDurations: [] as Duration[],
  adminDescription: "",
  deliveryKind: "code" as string,
};

const SCHEMA_EXAMPLE = `{
  "sellerFields": [
    { "key": "subscription_length", "label": "Subscription length", "type": "select",
      "options": ["1 month", "3 months", "12 months"], "required": true }
  ],
  "deliveryMethods": [
    { "value": "instant", "label": "Instant delivery" }
  ]
}`;

const BTN = "px-3 py-1.5 rounded-md text-xs font-bold disabled:opacity-50";
const INPUT =
  "bg-secondary border border-border rounded-md px-2 py-1.5 text-xs w-full focus:outline-none focus:ring-1 focus:ring-primary/50";

export function CategoriesClient() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function load() {
    startTransition(async () => {
      try {
        const data = await adminListCategoriesAction();
        setCategories(data as Category[]);
      } finally {
        setLoading(false);
      }
    });
  }

  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      await adminSaveCategoryAction({
        ...form,
        submissionSchema: form.submissionSchema || undefined,
        adminDescription: form.adminDescription || undefined,
      });
      setMsg("Category saved.");
      setForm(EMPTY);
      load();
    } catch (err) {
      setMsg((err as Error).message ?? "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function ensureBase() {
    setSaving(true);
    setMsg(null);
    try {
      const r = await adminEnsureBaseCategoriesAction();
      setMsg(r.added > 0 ? `Added ${r.added} base categories.` : "All base categories exist.");
      load();
    } catch (err) {
      setMsg((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-2xl">CATEGORIES</h1>
          <p className="text-[11px] text-muted-foreground mt-1 max-w-xl">
            Per-category commission %, warranty defaults, and JSON submission schema for dynamic
            seller / buyer fields. {categories.length} configured.
          </p>
        </div>
        <button
          onClick={ensureBase}
          disabled={saving}
          className={`${BTN} bg-secondary text-foreground`}
        >
          Add missing base categories
        </button>
      </div>

      {msg && (
        <p className="text-xs bg-secondary border border-border rounded-md px-3 py-2">{msg}</p>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="space-y-2">
          {categories.map((c) => (
            <div
              key={c.id as string}
              className="bg-card border border-border rounded-lg p-3 flex items-center gap-3 text-xs flex-wrap"
            >
              <span className="text-lg">{c.icon as string}</span>
              <span className="font-bold">{c.name as string}</span>
              <span className="text-muted-foreground font-mono">/{c.slug as string}</span>
              <span className="text-[10px] text-muted-foreground">
                #{c.sort as number} · warranty {c.default_warranty_hours as number}h · fee{" "}
                {c.commission_pct as number}% · {c.product_count as number} live products
              </span>
              {c.submission_schema && (
                <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-primary/15 text-primary">
                  CUSTOM SCHEMA
                </span>
              )}
              {c.risk_tier === "high" && (
                <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-yellow-500/15 text-yellow-400">
                  HIGH RISK
                </span>
              )}
              {!c.is_active && (
                <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-muted">DISABLED</span>
              )}
              <button
                className={`${BTN} ml-auto bg-secondary text-foreground`}
                onClick={() =>
                  setForm({
                    categoryId: c.id as string,
                    name: c.name as string,
                    slug: c.slug as string,
                    icon: (c.icon as string) ?? "📦",
                    sort: c.sort as number,
                    defaultWarrantyHours: c.default_warranty_hours as number,
                    commissionPct: c.commission_pct as number,
                    riskTier: c.risk_tier as "normal" | "high",
                    isActive: !!c.is_active,
                    submissionSchema: (c.submission_schema as string) ?? "",
                    requiresSubscription: !!c.requires_subscription,
                    allowedDurations: ((c.allowed_durations as string) ?? "")
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean) as Duration[],
                    adminDescription: (c.admin_description as string) ?? "",
                    deliveryKind: (c.delivery_kind as string) ?? "code",
                  })
                }
              >
                Edit
              </button>
            </div>
          ))}
        </div>
      )}

      <form
        className="bg-card border border-border rounded-lg p-4 space-y-3 max-w-3xl"
        onSubmit={save}
      >
        <h2 className="text-xs font-bold tracking-widest">
          {form.categoryId ? "EDIT CATEGORY" : "NEW CATEGORY"}
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <input
            required
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className={INPUT}
          />
          <input
            required
            placeholder="slug"
            pattern="[a-z0-9-]+"
            value={form.slug}
            onChange={(e) => setForm({ ...form, slug: e.target.value })}
            className={INPUT}
          />
          <input
            placeholder="Icon (emoji)"
            value={form.icon}
            onChange={(e) => setForm({ ...form, icon: e.target.value })}
            className={INPUT}
          />
          <input
            type="number"
            min={0}
            placeholder="Sort order"
            value={form.sort ?? ""}
            onChange={(e) =>
              setForm({ ...form, sort: e.target.value === "" ? undefined : Number(e.target.value) })
            }
            className={INPUT}
          />
          <input
            type="number"
            min={1}
            placeholder="Warranty h"
            value={form.defaultWarrantyHours}
            onChange={(e) => setForm({ ...form, defaultWarrantyHours: Number(e.target.value) })}
            className={INPUT}
          />
          <input
            type="number"
            min={0}
            max={50}
            step="0.5"
            placeholder="Fee %"
            value={form.commissionPct}
            onChange={(e) => setForm({ ...form, commissionPct: Number(e.target.value) })}
            className={INPUT}
          />
          <select
            value={form.riskTier}
            onChange={(e) => setForm({ ...form, riskTier: e.target.value as "normal" | "high" })}
            className={INPUT}
          >
            <option value="normal">normal risk</option>
            <option value="high">high risk</option>
          </select>
        </div>
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
          />
          Active (visible to buyers and sellers)
        </label>
        <div className="space-y-1.5 pt-2 border-t border-border">
          <p className="text-xs font-bold">Delivery kind</p>
          <select
            value={form.deliveryKind}
            onChange={(e) => setForm({ ...form, deliveryKind: e.target.value })}
            className={INPUT}
          >
            {DELIVERY_KINDS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={form.requiresSubscription}
            onChange={(e) => setForm({ ...form, requiresSubscription: e.target.checked })}
          />
          Subscription-based
        </label>
        {form.requiresSubscription && (
          <div className="flex flex-wrap gap-1.5">
            {DURATION_OPTIONS.map((d) => {
              const on = form.allowedDurations.includes(d);
              return (
                <button
                  type="button"
                  key={d}
                  onClick={() =>
                    setForm({
                      ...form,
                      allowedDurations: on
                        ? form.allowedDurations.filter((x) => x !== d)
                        : [...form.allowedDurations, d],
                    })
                  }
                  className={`text-[10px] font-bold px-2 py-1 rounded border ${on ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border text-muted-foreground"}`}
                >
                  {d}
                </button>
              );
            })}
          </div>
        )}
        <div className="space-y-1.5 pt-2 border-t border-border">
          <label className="text-xs font-bold flex items-center justify-between">
            <span>Submission schema (JSON, optional)</span>
            <button
              type="button"
              className="text-[10px] text-primary"
              onClick={() => setForm({ ...form, submissionSchema: SCHEMA_EXAMPLE })}
            >
              Insert example →
            </button>
          </label>
          <textarea
            rows={8}
            placeholder={SCHEMA_EXAMPLE}
            value={form.submissionSchema}
            onChange={(e) => setForm({ ...form, submissionSchema: e.target.value })}
            className={`${INPUT} font-mono resize-y`}
          />
        </div>
        <div className="space-y-1.5 pt-2 border-t border-border">
          <label className="text-xs font-bold">Admin description (SEO copy)</label>
          <textarea
            rows={3}
            value={form.adminDescription}
            onChange={(e) => setForm({ ...form, adminDescription: e.target.value })}
            className={`${INPUT} resize-y`}
          />
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className={`${BTN} bg-primary text-primary-foreground`}
          >
            {form.categoryId ? "Save changes" : "Create category"}
          </button>
          {form.categoryId && (
            <button
              type="button"
              onClick={() => setForm(EMPTY)}
              className={`${BTN} bg-secondary text-foreground`}
            >
              Cancel edit
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
