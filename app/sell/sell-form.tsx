"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { applyForSellerAction } from "@/server/actions/sell";

const YEARS = [
  { v: "new", l: "Just starting out" },
  { v: "lt1", l: "Less than 1 year" },
  { v: "1-2", l: "1–2 years" },
  { v: "3-5", l: "3–5 years" },
  { v: "5+", l: "5+ years" },
] as const;

const VOLUME = [
  { v: "", l: "Prefer not to say" },
  { v: "lt100", l: "Under $100" },
  { v: "100-500", l: "$100 – $500" },
  { v: "500-2000", l: "$500 – $2,000" },
  { v: "2000-10000", l: "$2,000 – $10,000" },
  { v: "10000+", l: "$10,000+" },
] as const;

const inputCls =
  "w-full bg-background border border-border rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50";
const labelCls = "block space-y-1";
const labelText = "text-[10px] font-bold tracking-widest text-muted-foreground";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={labelCls}>
      <span className={labelText}>{label}</span>
      {children}
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </label>
  );
}

export function SellForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    fullName: "",
    displayName: "",
    country: "",
    yearsExperience: "new" as "new" | "lt1" | "1-2" | "3-5" | "5+",
    productCategories: "",
    experience: "",
    sourceOfGoods: "",
    monthlyVolume: "" as "" | "lt100" | "100-500" | "500-2000" | "2000-10000" | "10000+",
    portfolio: "",
    telegram: "",
    whatsapp: "",
    wechat: "",
    usdtPayoutAddress: "",
    usdtNetwork: "TRC20" as "TRC20" | "BEP20" | "ERC20",
  });

  const set =
    (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await applyForSellerAction({
      ...form,
      monthlyVolume: form.monthlyVolume || undefined,
      portfolio: form.portfolio || undefined,
      telegram: form.telegram || undefined,
      whatsapp: form.whatsapp || undefined,
      wechat: form.wechat || undefined,
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.push("/seller");
  }

  return (
    <form onSubmit={submit} className="space-y-6 max-w-2xl">
      <section className="bg-card border border-border rounded-xl p-5 space-y-4">
        <h2 className="text-xs font-bold tracking-widest text-primary">PERSONAL DETAILS</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="FULL NAME">
            <input required value={form.fullName} onChange={set("fullName")} className={inputCls} />
          </Field>
          <Field label="DISPLAY NAME" hint="Shown as your seller handle">
            <input
              required
              value={form.displayName}
              onChange={set("displayName")}
              className={inputCls}
            />
          </Field>
        </div>
        <Field label="COUNTRY">
          <input
            required
            value={form.country}
            onChange={set("country")}
            placeholder="e.g. United States"
            className={inputCls}
          />
        </Field>
      </section>

      <section className="bg-card border border-border rounded-xl p-5 space-y-4">
        <h2 className="text-xs font-bold tracking-widest text-primary">SELLING EXPERIENCE</h2>
        <Field label="YEARS OF EXPERIENCE">
          <select
            value={form.yearsExperience}
            onChange={set("yearsExperience")}
            className={inputCls}
          >
            {YEARS.map((y) => (
              <option key={y.v} value={y.v}>
                {y.l}
              </option>
            ))}
          </select>
        </Field>
        <Field label="PRODUCT CATEGORIES" hint="What categories will you sell in?">
          <input
            required
            value={form.productCategories}
            onChange={set("productCategories")}
            placeholder="e.g. Game Keys, Streaming Accounts"
            className={inputCls}
          />
        </Field>
        <Field label="SELLING EXPERIENCE" hint="Tell us about your background (min 10 characters)">
          <textarea
            required
            rows={4}
            value={form.experience}
            onChange={set("experience")}
            placeholder="Describe your selling background, platforms used, and track record…"
            className={inputCls}
          />
        </Field>
        <Field label="SOURCE OF GOODS" hint="Where do your products come from?">
          <textarea
            required
            rows={3}
            value={form.sourceOfGoods}
            onChange={set("sourceOfGoods")}
            placeholder="Describe how you source your inventory…"
            className={inputCls}
          />
        </Field>
        <Field label="ESTIMATED MONTHLY VOLUME">
          <select value={form.monthlyVolume} onChange={set("monthlyVolume")} className={inputCls}>
            {VOLUME.map((v) => (
              <option key={v.v} value={v.v}>
                {v.l}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label="PORTFOLIO / PROOF OF STOCK"
          hint="Optional URLs to existing listings, shop screenshots, etc."
        >
          <textarea
            rows={2}
            value={form.portfolio}
            onChange={set("portfolio")}
            placeholder="Optional links or notes…"
            className={inputCls}
          />
        </Field>
      </section>

      <section className="bg-card border border-border rounded-xl p-5 space-y-4">
        <h2 className="text-xs font-bold tracking-widest text-primary">CONTACT CHANNELS</h2>
        <p className="text-[11px] text-muted-foreground">
          Provide at least one so our team can reach you for onboarding and compliance checks.
        </p>
        <div className="grid sm:grid-cols-3 gap-3">
          <Field label="TELEGRAM">
            <input
              value={form.telegram}
              onChange={set("telegram")}
              placeholder="@handle"
              className={inputCls}
            />
          </Field>
          <Field label="WHATSAPP">
            <input
              value={form.whatsapp}
              onChange={set("whatsapp")}
              placeholder="+1234567890"
              className={inputCls}
            />
          </Field>
          <Field label="WECHAT">
            <input
              value={form.wechat}
              onChange={set("wechat")}
              placeholder="WeChat ID"
              className={inputCls}
            />
          </Field>
        </div>
      </section>

      <section className="bg-card border border-border rounded-xl p-5 space-y-4">
        <h2 className="text-xs font-bold tracking-widest text-primary">PAYOUT DETAILS</h2>
        <div className="grid sm:grid-cols-[1fr_110px] gap-3">
          <Field label="USDT PAYOUT ADDRESS" hint="Where your earnings will be sent">
            <input
              required
              value={form.usdtPayoutAddress}
              onChange={set("usdtPayoutAddress")}
              placeholder="T... or 0x..."
              className={inputCls}
            />
          </Field>
          <Field label="NETWORK">
            <select value={form.usdtNetwork} onChange={set("usdtNetwork")} className={inputCls}>
              <option>TRC20</option>
              <option>BEP20</option>
              <option>ERC20</option>
            </select>
          </Field>
        </div>
      </section>

      {error && (
        <p className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-lg px-4 py-3">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="w-full py-3 text-sm font-bold bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 disabled:opacity-60"
      >
        {busy ? "Submitting application…" : "Submit seller application"}
      </button>

      <p className="text-[11px] text-muted-foreground text-center">
        Applications are reviewed within 48 hours. You'll receive a notification with the outcome.
      </p>
    </form>
  );
}
