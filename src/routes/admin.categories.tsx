import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { adminListCategories, adminSaveCategory } from "@/lib/api/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/admin/categories")({
  component: AdminCategories,
});

const SCHEMA_EXAMPLE = `{
  "sellerFields": [
    { "key": "subscription_length", "label": "Subscription length", "type": "select",
      "options": ["1 month", "3 months", "12 months"], "required": true },
    { "key": "delivery_method", "label": "Delivery method", "type": "select",
      "options": ["Instant code", "Manual invite", "Shared account"], "required": true }
  ],
  "buyerFields": [
    { "key": "game_username", "label": "Your in-game username", "type": "text", "required": true },
    { "key": "server_region", "label": "Server region", "type": "select",
      "options": ["EU", "NA", "Asia"], "required": true }
  ],
  "deliveryMethods": [
    { "value": "instant", "label": "Instant delivery" },
    { "value": "manual", "label": "Manual delivery" }
  ]
}`;

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
  defaultWarrantyHours: 72,
  commissionPct: 8,
  riskTier: "normal" as "normal" | "high",
  isActive: true,
  submissionSchema: "",
  requiresSubscription: false,
  allowedDurations: [] as Duration[],
  adminDescription: "",
  deliveryKind: "code" as (typeof DELIVERY_KINDS)[number]["value"],
};


function AdminCategories() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["adminCategories"],
    queryFn: () => adminListCategories(),
  });
  const [form, setForm] = useState(EMPTY);

  const save = useMutation({
    mutationFn: () => adminSaveCategory({ data: form }),
    onSuccess: () => {
      toast.success("Category saved");
      setForm(EMPTY);
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl">CATEGORIES</h1>
      <p className="text-[11px] text-muted-foreground -mt-2">
        Per-category commission %, warranty defaults, and a JSON submission schema for dynamic
        seller / buyer fields and delivery methods.
      </p>
      <div className="space-y-2">
        {data?.categories.map((c) => (
          <div
            key={c.id as string}
            className="bg-card border border-border rounded-lg p-3 flex items-center gap-3 text-xs flex-wrap"
          >
            <span className="text-lg">{c.icon}</span>
            <span className="font-bold">{c.name}</span>
            <span className="text-muted-foreground font-mono">/{c.slug}</span>
            <span className="text-[10px] text-muted-foreground">
              warranty {c.default_warranty_hours}h · fee {c.commission_pct}% · {c.product_count}{" "}
              live products
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
            <Button
              size="sm"
              variant="secondary"
              className="ml-auto h-7 text-[10px]"
              onClick={() =>
                setForm({
                  categoryId: c.id as string,
                  name: c.name as string,
                  slug: c.slug as string,
                  icon: (c.icon as string) ?? "📦",
                  defaultWarrantyHours: c.default_warranty_hours as number,
                  commissionPct: c.commission_pct as number,
                  riskTier: c.risk_tier as never,
                  isActive: !!c.is_active,
                  submissionSchema: (c.submission_schema as string) ?? "",
                  requiresSubscription: !!c.requires_subscription,
                  allowedDurations: ((c.allowed_durations as string) ?? "")
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean) as Duration[],
                  adminDescription: (c.admin_description as string) ?? "",
                  deliveryKind: (c.delivery_kind as never) ?? "code",
                })

              }
            >
              Edit
            </Button>
          </div>
        ))}
      </div>

      <form
        className="bg-card border border-border rounded-lg p-4 space-y-3 max-w-3xl"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <h2 className="text-xs font-bold tracking-widest">
          {form.categoryId ? "EDIT CATEGORY" : "NEW CATEGORY"}
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <Input
            required
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <Input
            required
            placeholder="slug"
            pattern="[a-z0-9-]+"
            value={form.slug}
            onChange={(e) => setForm({ ...form, slug: e.target.value })}
          />
          <Input
            placeholder="Icon (emoji)"
            value={form.icon}
            onChange={(e) => setForm({ ...form, icon: e.target.value })}
          />
          <Input
            type="number"
            min={1}
            placeholder="Warranty h"
            value={form.defaultWarrantyHours}
            onChange={(e) => setForm({ ...form, defaultWarrantyHours: Number(e.target.value) })}
          />
          <Input
            type="number"
            min={0}
            max={50}
            step="0.5"
            placeholder="Fee %"
            value={form.commissionPct}
            onChange={(e) => setForm({ ...form, commissionPct: Number(e.target.value) })}
          />
          <select
            value={form.riskTier}
            onChange={(e) => setForm({ ...form, riskTier: e.target.value as never })}
            className="bg-secondary border border-border rounded-md px-2 text-xs h-9"
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
          <p className="text-[10px] text-muted-foreground">
            Add custom seller fields, buyer-required fields at checkout, and delivery methods for
            this category. Leave blank to use the global defaults.
          </p>
          <Textarea
            rows={10}
            placeholder={SCHEMA_EXAMPLE}
            value={form.submissionSchema}
            onChange={(e) => setForm({ ...form, submissionSchema: e.target.value })}
            className="font-mono text-[11px]"
          />
        </div>

        <div className="flex gap-2">
          <Button size="sm" type="submit" disabled={save.isPending}>
            {form.categoryId ? "Save changes" : "Create category"}
          </Button>
          {form.categoryId && (
            <Button size="sm" variant="ghost" type="button" onClick={() => setForm(EMPTY)}>
              Cancel edit
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
