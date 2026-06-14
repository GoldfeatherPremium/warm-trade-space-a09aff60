"use client";

import { useEffect, useState, useTransition } from "react";
import { Globe, Twitter, MessageCircle, Send, Youtube, Store } from "lucide-react";
import { getMyStorefrontAction, saveStorefrontAction } from "@/server/actions/seller";

type StorefrontData = Awaited<ReturnType<typeof getMyStorefrontAction>>;
type Socials = {
  website?: string;
  twitter?: string;
  discord?: string;
  telegram?: string;
  youtube?: string;
};

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
    <label className="block">
      <span className="text-[11px] font-bold tracking-widest text-muted-foreground">
        {label.toUpperCase()}
      </span>
      {hint && <span className="block text-[10px] text-muted-foreground/80 mb-1">{hint}</span>}
      <div className="mt-1">{children}</div>
    </label>
  );
}

export default function StorefrontPage() {
  const [data, setData] = useState<StorefrontData | null>(null);
  const [form, setForm] = useState({
    bannerUrl: "",
    logoUrl: "",
    description: "",
    announcement: "",
    socials: {} as Socials,
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const d = await getMyStorefrontAction();
      setData(d);
      setForm({
        bannerUrl: d.bannerUrl,
        logoUrl: d.logoUrl,
        description: d.description,
        announcement: d.announcement,
        socials: d.socials as Socials,
      });
    });
  }, []);

  const save = () => {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      try {
        await saveStorefrontAction(form);
        setSuccess("Storefront updated");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error");
      }
    });
  };

  const socialFields: Array<{
    k: keyof Socials;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    placeholder: string;
  }> = [
    { k: "website", label: "Website", icon: Globe, placeholder: "https://your-site.com" },
    { k: "twitter", label: "Twitter / X", icon: Twitter, placeholder: "https://x.com/handle" },
    { k: "discord", label: "Discord", icon: MessageCircle, placeholder: "https://discord.gg/..." },
    { k: "telegram", label: "Telegram", icon: Send, placeholder: "https://t.me/handle" },
    { k: "youtube", label: "YouTube", icon: Youtube, placeholder: "https://youtube.com/@channel" },
  ];

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center gap-2">
        <Store className="size-5 text-primary" />
        <h2 className="font-display text-2xl">Storefront branding</h2>
      </div>
      <p className="text-xs text-muted-foreground -mt-3">
        How your public store at <span className="font-mono">/s/{data?.username ?? "…"}</span> looks
        to buyers.
      </p>

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

      {/* Live preview */}
      <div className="rounded-xl overflow-hidden border border-border bg-card">
        <div
          className="h-32 bg-secondary bg-center bg-cover"
          style={form.bannerUrl ? { backgroundImage: `url(${form.bannerUrl})` } : undefined}
        />
        <div className="p-4 flex items-center gap-3">
          {form.logoUrl ? (
            <img
              src={form.logoUrl}
              alt=""
              className="size-14 rounded-xl object-cover border border-border -mt-10 bg-background"
            />
          ) : (
            <div className="size-14 rounded-xl bg-primary/20 border border-primary/40 grid place-items-center text-lg font-bold text-primary uppercase -mt-10">
              {data?.username?.slice(0, 2)}
            </div>
          )}
          <div className="text-xs text-muted-foreground line-clamp-2">
            {form.description || "Add a short description to introduce your store."}
          </div>
        </div>
      </div>

      <Field label="Banner image URL" hint="Recommended 1600 × 400">
        <input
          className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-xs"
          placeholder="https://…"
          value={form.bannerUrl}
          onChange={(e) => setForm({ ...form, bannerUrl: e.target.value })}
        />
      </Field>

      <Field label="Logo / avatar URL" hint="Recommended square, 256 × 256">
        <input
          className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-xs"
          placeholder="https://…"
          value={form.logoUrl}
          onChange={(e) => setForm({ ...form, logoUrl: e.target.value })}
        />
      </Field>

      <Field label="Store description" hint={`${form.description.length} / 1500`}>
        <textarea
          rows={4}
          className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-xs"
          maxLength={1500}
          placeholder="Tell buyers what you specialise in…"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
      </Field>

      <Field
        label="Store announcement"
        hint={`${form.announcement.length} / 280 — shown at the top of your store`}
      >
        <input
          className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-xs"
          maxLength={280}
          placeholder="e.g. ⚡ Restocked all Steam keys today"
          value={form.announcement}
          onChange={(e) => setForm({ ...form, announcement: e.target.value })}
        />
      </Field>

      <div>
        <p className="text-xs font-bold tracking-widest text-muted-foreground mb-2">SOCIAL LINKS</p>
        <div className="grid sm:grid-cols-2 gap-3">
          {socialFields.map(({ k, label, icon: Icon, placeholder }) => (
            <label key={k} className="block">
              <span className="text-[11px] text-muted-foreground flex items-center gap-1.5 mb-1">
                <Icon className="size-3.5" /> {label}
              </span>
              <input
                className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-xs"
                placeholder={placeholder}
                value={form.socials[k] ?? ""}
                onChange={(e) =>
                  setForm({ ...form, socials: { ...form.socials, [k]: e.target.value } })
                }
              />
            </label>
          ))}
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <button
          onClick={save}
          className="bg-primary text-primary-foreground text-xs font-bold tracking-widest px-5 py-2.5 rounded-lg hover:opacity-90 disabled:opacity-50"
        >
          SAVE STOREFRONT
        </button>
      </div>
    </div>
  );
}
