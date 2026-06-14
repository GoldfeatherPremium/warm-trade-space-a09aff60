import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Store, ShieldCheck, Banknote, TrendingUp, Send, MessageCircle } from "lucide-react";
import { applyForSeller, getMyApplication } from "@/lib/api/seller";
import { useMe } from "@/hooks/use-me";
import { PageShell } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/sell")({
  head: () => ({ meta: [{ title: "Become a Seller — X-VAULT" }] }),
  component: SellPage,
});

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

function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label className="text-xs">{label}</Label>
      {children}
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Section({ title, desc, children }: { title: string; desc?: string; children: ReactNode }) {
  return (
    <section className="bg-card border border-border rounded-xl p-5 space-y-4">
      <div>
        <h2 className="text-xs font-bold tracking-widest text-primary">{title}</h2>
        {desc && <p className="text-[11px] text-muted-foreground mt-0.5">{desc}</p>}
      </div>
      {children}
    </section>
  );
}

const selectCls =
  "w-full bg-secondary border border-border rounded-md px-2 py-2 text-xs h-9 focus:outline-none focus:ring-1 focus:ring-primary";

function SellPage() {
  const { me, isLoading } = useMe();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["myApplication"],
    queryFn: () => getMyApplication(),
    enabled: !!me,
  });
  const [form, setForm] = useState({
    fullName: "",
    displayName: "",
    country: "",
    yearsExperience: "1-2",
    productCategories: "",
    experience: "",
    sourceOfGoods: "",
    monthlyVolume: "",
    portfolio: "",
    telegram: "",
    whatsapp: "",
    wechat: "",
    usdtPayoutAddress: "",
    usdtNetwork: "TRC20" as "TRC20" | "BEP20" | "ERC20",
  });
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  const apply = useMutation({
    mutationFn: () =>
      applyForSeller({
        data: {
          fullName: form.fullName,
          displayName: form.displayName,
          country: form.country,
          yearsExperience: form.yearsExperience as "new" | "lt1" | "1-2" | "3-5" | "5+",
          productCategories: form.productCategories,
          experience: form.experience,
          sourceOfGoods: form.sourceOfGoods,
          monthlyVolume:
            (form.monthlyVolume as "lt100" | "100-500" | "500-2000" | "2000-10000" | "10000+") ||
            undefined,
          portfolio: form.portfolio || undefined,
          telegram: form.telegram || undefined,
          whatsapp: form.whatsapp || undefined,
          wechat: form.wechat || undefined,
          usdtPayoutAddress: form.usdtPayoutAddress,
          usdtNetwork: form.usdtNetwork,
        },
      }),
    onSuccess: () => {
      toast.success("Application submitted — our team will review it shortly.");
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <PageShell>
      <div className="max-w-2xl mx-auto py-6 space-y-6">
        <div className="text-center space-y-3">
          <h1 className="font-display text-4xl">SELL ON X-VAULT</h1>
          <p className="text-sm text-muted-foreground">
            Reach thousands of verified buyers and get paid in USDT. Buyer protection is built in,
            so you trade with confidence.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3 text-center">
          {[
            { icon: Banknote, t: "From 8% fee", d: "lower as you level up" },
            { icon: ShieldCheck, t: "Protected payments", d: "no chargebacks" },
            { icon: TrendingUp, t: "Level up", d: "higher limits as you sell" },
          ].map((x) => (
            <div key={x.t} className="bg-card border border-border rounded-lg p-3 space-y-1">
              <x.icon className="size-5 text-primary mx-auto" />
              <p className="text-[11px] font-bold">{x.t}</p>
              <p className="text-[9px] text-muted-foreground">{x.d}</p>
            </div>
          ))}
        </div>

        {!me && !isLoading && (
          <div className="bg-card border border-border rounded-lg p-6 text-center space-y-3">
            <p className="text-sm">Create an account first, then apply for seller status.</p>
            <Button onClick={() => navigate({ to: "/auth", search: { redirect: "/sell" } })}>
              Sign in / Register
            </Button>
          </div>
        )}

        {me && me.seller_status === "approved" && (
          <div className="bg-card border border-accent/40 rounded-lg p-6 text-center space-y-3">
            <Store className="size-8 text-accent mx-auto" />
            <p className="text-sm font-bold">You're an approved seller!</p>
            <Link to="/seller" className="text-primary text-sm font-bold">
              Open your dashboard →
            </Link>
          </div>
        )}

        {me && me.seller_status === "pending" && (
          <div className="bg-card border border-yellow-500/40 rounded-lg p-6 text-center space-y-2">
            <p className="text-sm font-bold text-yellow-400">Application under review</p>
            <p className="text-xs text-muted-foreground">
              Submitted{" "}
              {data?.application ? new Date(data.application.created_at).toLocaleString() : ""}.
              You'll get a notification once our team decides — typically within 24 hours.
            </p>
          </div>
        )}

        {me && (me.seller_status === "none" || me.seller_status === "rejected") && (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              apply.mutate();
            }}
          >
            {me.seller_status === "rejected" && (
              <p className="text-xs bg-destructive/10 border border-destructive/30 text-destructive rounded-md p-3">
                Your previous application was rejected
                {data?.application?.admin_note ? `: ${data.application.admin_note}` : "."} You may
                update your details and re-apply below.
              </p>
            )}

            <Section title="ABOUT YOU" desc="Your identity for payouts and compliance.">
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="Full legal name">
                  <Input
                    required
                    value={form.fullName}
                    onChange={(e) => set({ fullName: e.target.value })}
                    placeholder="As on your government ID"
                  />
                </Field>
                <Field label="Country">
                  <Input
                    required
                    value={form.country}
                    onChange={(e) => set({ country: e.target.value })}
                    placeholder="Country of residence"
                  />
                </Field>
                <Field label="Years selling digital goods">
                  <select
                    className={selectCls}
                    value={form.yearsExperience}
                    onChange={(e) => set({ yearsExperience: e.target.value })}
                  >
                    {YEARS.map((y) => (
                      <option key={y.v} value={y.v}>
                        {y.l}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Store / display name" hint="Shown publicly on your listings.">
                  <Input
                    required
                    value={form.displayName}
                    onChange={(e) => set({ displayName: e.target.value })}
                    placeholder="e.g. Vault Cards"
                  />
                </Field>
              </div>
            </Section>

            <Section
              title="YOUR BUSINESS"
              desc="Help us understand what you sell and how you operate."
            >
              <Field
                label="What will you sell?"
                hint="Categories / products, e.g. streaming subscriptions, software keys, game accounts."
              >
                <Input
                  required
                  value={form.productCategories}
                  onChange={(e) => set({ productCategories: e.target.value })}
                  placeholder="Subscriptions, software keys, accounts…"
                />
              </Field>
              <Field
                label="Tell us about your experience"
                hint="Your background, team, and what makes you a reliable seller."
              >
                <Textarea
                  required
                  minLength={10}
                  rows={3}
                  value={form.experience}
                  onChange={(e) => set({ experience: e.target.value })}
                  placeholder="E.g. authorized reseller for 3 years, run a small team, 2,000+ orders fulfilled elsewhere…"
                />
              </Field>
              <Field
                label="How do you source your stock?"
                hint="Where your inventory comes from — this protects buyers and your account."
              >
                <Textarea
                  required
                  minLength={10}
                  rows={2}
                  value={form.sourceOfGoods}
                  onChange={(e) => set({ sourceOfGoods: e.target.value })}
                  placeholder="E.g. official distributor invoices, direct provider partnership…"
                />
              </Field>
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="Expected monthly volume">
                  <select
                    className={selectCls}
                    value={form.monthlyVolume}
                    onChange={(e) => set({ monthlyVolume: e.target.value })}
                  >
                    {VOLUME.map((v) => (
                      <option key={v.v} value={v.v}>
                        {v.l}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Portfolio / track record (optional)" hint="Links to other profiles.">
                  <Input
                    value={form.portfolio}
                    onChange={(e) => set({ portfolio: e.target.value })}
                    placeholder="G2G / Eldorado / reviews link…"
                  />
                </Field>
              </div>
            </Section>

            <Section
              title="CONTACT CHANNELS"
              desc="At least one is required so support can always reach you."
            >
              <div className="grid sm:grid-cols-3 gap-3">
                <Field label="Telegram">
                  <div className="relative">
                    <Send className="size-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      className="pl-7"
                      value={form.telegram}
                      onChange={(e) => set({ telegram: e.target.value })}
                      placeholder="@handle"
                    />
                  </div>
                </Field>
                <Field label="WhatsApp">
                  <div className="relative">
                    <MessageCircle className="size-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      className="pl-7"
                      value={form.whatsapp}
                      onChange={(e) => set({ whatsapp: e.target.value })}
                      placeholder="+1…"
                    />
                  </div>
                </Field>
                <Field label="WeChat">
                  <Input
                    value={form.wechat}
                    onChange={(e) => set({ wechat: e.target.value })}
                    placeholder="WeChat ID"
                  />
                </Field>
              </div>
            </Section>

            <Section title="PAYOUTS" desc="Where we send your USDT earnings.">
              <div className="grid sm:grid-cols-[1fr_120px] gap-3">
                <Field label="USDT payout address">
                  <Input
                    required
                    minLength={20}
                    value={form.usdtPayoutAddress}
                    onChange={(e) => set({ usdtPayoutAddress: e.target.value })}
                    placeholder="T…"
                  />
                </Field>
                <Field label="Network">
                  <select
                    className={selectCls}
                    value={form.usdtNetwork}
                    onChange={(e) =>
                      set({ usdtNetwork: e.target.value as typeof form.usdtNetwork })
                    }
                  >
                    <option>TRC20</option>
                    <option>BEP20</option>
                    <option>ERC20</option>
                  </select>
                </Field>
              </div>
            </Section>

            <p className="text-[10px] text-muted-foreground px-1">
              By applying you agree to the prohibited items policy: no stolen/carded goods, no
              unauthorized credentials, no listings violating the underlying service's terms.
              Violations = permanent ban + frozen funds.
            </p>
            <Button type="submit" className="w-full font-bold h-11" disabled={apply.isPending}>
              {apply.isPending ? "Submitting…" : "Submit application"}
            </Button>
          </form>
        )}
      </div>
    </PageShell>
  );
}
