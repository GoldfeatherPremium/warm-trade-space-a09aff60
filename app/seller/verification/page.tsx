"use client";

import { useEffect, useState, useTransition } from "react";
import { applyForVerificationAction, getMyVerificationAction } from "@/server/actions/seller";
import { timeAgo } from "@/lib/format";

type VerData = Awaited<ReturnType<typeof getMyVerificationAction>>;
type Tier = "verified" | "business" | "premium";

const TIER_INFO: Record<Tier, { title: string; bullet: string[] }> = {
  verified: {
    title: "Verified",
    bullet: ["Government ID confirmed", "Verified badge on every listing", "+5 trust score boost"],
  },
  business: {
    title: "Business",
    bullet: [
      "Registered business documentation",
      "Business badge + storefront highlight",
      "+10 trust score boost",
    ],
  },
  premium: {
    title: "Premium",
    bullet: [
      "Manual vetting by trust & safety",
      "Premium crown badge + priority placement",
      "+15 trust score boost",
    ],
  },
};

function TierBadge({ tier, size = "sm" }: { tier: string; size?: "xs" | "sm" }) {
  const colors: Record<string, string> = {
    verified: "bg-accent/15 text-accent border-accent/30",
    business: "bg-warning/15 text-warning border-warning/30",
    premium: "bg-primary/15 text-primary border-primary/30",
  };
  const cls = colors[tier] ?? "bg-muted text-muted-foreground border-border";
  const text = size === "xs" ? "text-[9px]" : "text-[11px]";
  return (
    <span
      className={`inline-flex items-center border px-2 py-0.5 rounded-full font-bold ${text} ${cls}`}
    >
      {tier.toUpperCase()}
    </span>
  );
}

function FieldInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
        {label}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full mt-1 bg-secondary border border-border rounded-md px-3 py-2 text-xs"
      />
    </label>
  );
}

export default function VerificationPage() {
  const [data, setData] = useState<VerData | null>(null);
  const [tier, setTier] = useState<Tier>("verified");
  const [fields, setFields] = useState({
    legalName: "",
    country: "",
    businessName: "",
    registration: "",
    idRef: "",
    notes: "",
    contactPhone: "",
    contactWhatsapp: "",
    contactTelegram: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const load = () => {
    startTransition(async () => {
      const d = await getMyVerificationAction();
      setData(d);
    });
  };

  useEffect(() => {
    load();
  }, []);

  const apply = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await applyForVerificationAction({
          tierRequested: tier,
          legalName: fields.legalName,
          country: fields.country,
          businessName: fields.businessName || undefined,
          businessRegistration: fields.registration || undefined,
          idDocRef: fields.idRef || undefined,
          notes: fields.notes || undefined,
          contactPhone: fields.contactPhone,
          contactWhatsapp: fields.contactWhatsapp || undefined,
          contactTelegram: fields.contactTelegram || undefined,
        });
        setSuccess("Application submitted — we'll review within 48h");
        setFields({
          legalName: "",
          country: "",
          businessName: "",
          registration: "",
          idRef: "",
          notes: "",
          contactPhone: "",
          contactWhatsapp: "",
          contactTelegram: "",
        });
        load();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error");
      }
    });
  };

  const application = data?.application ?? null;
  const pending = application?.status === "pending";

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl">VERIFICATION</h1>
        <p className="text-xs text-muted-foreground mt-1">
          Verified sellers convert more, rank higher, and receive priority support.
        </p>
      </div>

      {application && (
        <div className="bg-card border border-border rounded-lg p-4 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] uppercase font-bold text-muted-foreground">
              Latest application:
            </span>
            <TierBadge tier={application.tier_requested} size="xs" />
            <span
              className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${application.status === "pending" ? "bg-warning/15 text-warning" : application.status === "approved" ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}
            >
              {application.status}
            </span>
            <span className="text-[10px] text-muted-foreground ml-auto">
              {timeAgo(application.created_at)}
            </span>
          </div>
          {application.admin_note && (
            <p className="text-xs text-muted-foreground">
              <b className="text-foreground">Note:</b> {application.admin_note}
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {(Object.keys(TIER_INFO) as Tier[]).map((t) => (
          <button
            key={t}
            type="button"
            disabled={pending}
            onClick={() => setTier(t)}
            className={`text-left rounded-lg border p-3 transition ${tier === t ? "border-primary bg-primary/10" : "border-border bg-card hover:border-primary/40"} ${pending ? "opacity-60 cursor-not-allowed" : ""}`}
          >
            <div className="mb-2">
              <TierBadge tier={t} />
            </div>
            <p className="font-display text-sm mb-2">{TIER_INFO[t].title}</p>
            <ul className="text-[11px] text-muted-foreground space-y-1">
              {TIER_INFO[t].bullet.map((b) => (
                <li key={b}>• {b}</li>
              ))}
            </ul>
          </button>
        ))}
      </div>

      <form onSubmit={apply} className="bg-card border border-border rounded-lg p-4 space-y-3">
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
        <fieldset disabled={pending} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FieldInput
              label="Legal name *"
              value={fields.legalName}
              onChange={(v) => setFields({ ...fields, legalName: v })}
            />
            <FieldInput
              label="Country *"
              value={fields.country}
              onChange={(v) => setFields({ ...fields, country: v })}
            />
          </div>
          {(tier === "business" || tier === "premium") && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FieldInput
                label="Business name *"
                value={fields.businessName}
                onChange={(v) => setFields({ ...fields, businessName: v })}
              />
              <FieldInput
                label="Registration number"
                value={fields.registration}
                onChange={(v) => setFields({ ...fields, registration: v })}
              />
            </div>
          )}
          <FieldInput
            label="ID document reference"
            value={fields.idRef}
            onChange={(v) => setFields({ ...fields, idRef: v })}
            placeholder="e.g. upload link, passport number prefix"
          />
          <div className="rounded-md border border-primary/30 bg-primary/5 p-3 space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-primary">
              Staff-only contact channels
            </p>
            <p className="text-[10px] text-muted-foreground -mt-2">
              Used by X-VAULT trust & safety. Never shown to buyers.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <FieldInput
                label="Phone *"
                value={fields.contactPhone}
                onChange={(v) => setFields({ ...fields, contactPhone: v })}
                placeholder="+1 555 123 4567"
              />
              <FieldInput
                label="WhatsApp"
                value={fields.contactWhatsapp}
                onChange={(v) => setFields({ ...fields, contactWhatsapp: v })}
                placeholder="+1 555 123 4567"
              />
              <FieldInput
                label="Telegram"
                value={fields.contactTelegram}
                onChange={(v) => setFields({ ...fields, contactTelegram: v })}
                placeholder="@handle"
              />
            </div>
          </div>
          <label className="block">
            <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
              Notes for reviewer
            </span>
            <textarea
              value={fields.notes}
              onChange={(e) => setFields({ ...fields, notes: e.target.value })}
              rows={3}
              className="w-full mt-1 bg-secondary border border-border rounded-md px-3 py-2 text-xs"
            />
          </label>
          <button
            type="submit"
            className="w-full bg-primary text-primary-foreground text-xs font-bold tracking-widest py-2.5 rounded-lg hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Application under review" : `Apply for ${TIER_INFO[tier].title}`}
          </button>
        </fieldset>
      </form>
    </div>
  );
}
