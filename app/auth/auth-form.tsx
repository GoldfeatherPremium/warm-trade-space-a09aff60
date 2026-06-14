"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { loginAction, registerAction } from "@/server/actions/auth";

export function AuthForm({ redirectTo }: { redirectTo: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [form, setForm] = useState({ email: "", username: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      let refCode: string | undefined;
      try {
        refCode = localStorage.getItem("ref_code") ?? undefined;
      } catch {
        /* ignore */
      }
      const res =
        mode === "login"
          ? await loginAction({ email: form.email, password: form.password })
          : await registerAction({ ...form, refCode });
      if (res.ok) {
        router.push(redirectTo || "/");
        router.refresh();
      } else {
        setError(res.error);
        setBusy(false);
      }
    } catch {
      setError("Something went wrong. Please try again.");
      setBusy(false);
    }
  }

  const inputCls =
    "w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50";

  return (
    <div className="bg-card border border-border rounded-lg p-6 space-y-5">
      <div className="flex gap-1 bg-secondary rounded-lg p-1">
        {(["login", "register"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMode(m);
              setError(null);
            }}
            className={`flex-1 text-xs font-bold py-2 rounded-md tracking-wide transition-colors ${
              mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground"
            }`}
          >
            {m === "login" ? "SIGN IN" : "CREATE ACCOUNT"}
          </button>
        ))}
      </div>

      <form className="space-y-4" onSubmit={submit}>
        <div className="space-y-1.5">
          <label className="text-xs font-bold">Email</label>
          <input
            type="email"
            required
            autoComplete="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className={inputCls}
          />
        </div>
        {mode === "register" && (
          <div className="space-y-1.5">
            <label className="text-xs font-bold">Username</label>
            <input
              required
              minLength={3}
              maxLength={24}
              pattern="[a-zA-Z0-9_]+"
              autoComplete="username"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              className={inputCls}
            />
          </div>
        )}
        <div className="space-y-1.5">
          <label className="text-xs font-bold">Password</label>
          <input
            type="password"
            required
            minLength={mode === "register" ? 8 : 1}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className={inputCls}
          />
        </div>

        {error && (
          <p className="text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full bg-primary text-primary-foreground text-xs font-bold tracking-widest py-2.5 rounded-md hover:opacity-90 disabled:opacity-60"
        >
          {busy ? "PLEASE WAIT…" : mode === "login" ? "SIGN IN" : "CREATE ACCOUNT"}
        </button>
      </form>

      <p className="text-[10px] text-muted-foreground text-center leading-relaxed">
        By continuing you agree to our on-platform-only policy. All chat, payment and delivery stay
        on X-VAULT — it's how buyer protection works.
      </p>
    </div>
  );
}
