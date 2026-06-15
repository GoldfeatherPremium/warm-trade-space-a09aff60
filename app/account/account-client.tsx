"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateProfileAction, updatePreferencesAction } from "@/server/actions/account";
import { PushOptIn } from "../_components/live-updates";

type User = {
  username: string;
  email: string;
  locale: string;
  preferred_currency: string;
  country: string | null;
};

const LOCALES = ["en", "es", "fr", "de", "pt", "ar", "zh", "ja", "ko", "ru"];
const CURRENCIES = ["USD", "EUR", "GBP", "BTC", "ETH", "USDT"];

export function AccountClient({ user }: { user: User }) {
  const router = useRouter();
  const [username, setUsername] = useState(user.username);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [locale, setLocale] = useState(user.locale || "en");
  const [currency, setCurrency] = useState(user.preferred_currency || "USD");
  const [country, setCountry] = useState(user.country || "");
  const [prefBusy, setPrefBusy] = useState(false);
  const [prefMsg, setPrefMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const inputCls =
    "w-full bg-background border border-border rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50";

  async function saveProfile() {
    setBusy(true);
    setMsg(null);
    const res = await updateProfileAction({
      username: username !== user.username ? username : undefined,
      currentPassword: currentPw || undefined,
      newPassword: newPw || undefined,
    });
    setBusy(false);
    if (res.ok) {
      setMsg({ ok: true, text: "Saved successfully." });
      setCurrentPw("");
      setNewPw("");
      router.refresh();
    } else {
      setMsg({ ok: false, text: res.error });
    }
  }

  async function savePrefs() {
    setPrefBusy(true);
    setPrefMsg(null);
    const res = await updatePreferencesAction({ locale, preferred_currency: currency, country });
    setPrefBusy(false);
    setPrefMsg(
      res.ok ? { ok: true, text: "Preferences updated." } : { ok: false, text: res.error },
    );
    if (res.ok) router.refresh();
  }

  return (
    <div className="max-w-lg space-y-5">
      {/* Profile */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <h2 className="text-xs font-bold tracking-widest">PROFILE</h2>
        <div className="text-[11px] text-muted-foreground space-y-0.5">
          <p>
            Email: <span className="text-foreground">{user.email}</span>
          </p>
        </div>
        {msg && (
          <p className={`text-xs ${msg.ok ? "text-accent" : "text-destructive"}`}>{msg.text}</p>
        )}
        <div className="space-y-2">
          <label className="block space-y-1">
            <span className="text-[10px] font-bold text-muted-foreground">USERNAME</span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={inputCls}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-[10px] font-bold text-muted-foreground">CURRENT PASSWORD</span>
            <input
              type="password"
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
              placeholder="Required to change password"
              className={inputCls}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-[10px] font-bold text-muted-foreground">NEW PASSWORD</span>
            <input
              type="password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              placeholder="Leave blank to keep current"
              className={inputCls}
            />
          </label>
          <button
            onClick={saveProfile}
            disabled={busy}
            className="px-4 py-2 text-sm font-bold bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-60"
          >
            {busy ? "Saving…" : "Save profile"}
          </button>
        </div>
      </div>

      {/* Notifications */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-3">
        <h2 className="text-xs font-bold tracking-widest">NOTIFICATIONS</h2>
        <p className="text-[11px] text-muted-foreground">
          Get push notifications for new messages and order updates — even when the app is closed.
        </p>
        <PushOptIn />
      </div>

      {/* Preferences */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <h2 className="text-xs font-bold tracking-widest">PREFERENCES</h2>
        {prefMsg && (
          <p className={`text-xs ${prefMsg.ok ? "text-accent" : "text-destructive"}`}>
            {prefMsg.text}
          </p>
        )}
        <div className="space-y-2">
          <label className="block space-y-1">
            <span className="text-[10px] font-bold text-muted-foreground">LANGUAGE</span>
            <select value={locale} onChange={(e) => setLocale(e.target.value)} className={inputCls}>
              {LOCALES.map((l) => (
                <option key={l} value={l}>
                  {l.toUpperCase()}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-[10px] font-bold text-muted-foreground">DISPLAY CURRENCY</span>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className={inputCls}
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-[10px] font-bold text-muted-foreground">COUNTRY</span>
            <input
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              placeholder="e.g. US, GB, AU"
              className={inputCls}
            />
          </label>
          <button
            onClick={savePrefs}
            disabled={prefBusy}
            className="px-4 py-2 text-sm font-bold bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-60"
          >
            {prefBusy ? "Saving…" : "Save preferences"}
          </button>
        </div>
      </div>
    </div>
  );
}
