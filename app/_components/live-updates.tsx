"use client";

import Image from "next/image";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

interface Counts {
  unreadMessages: number;
  unreadNotifications: number;
}

const Ctx = createContext<Counts>({ unreadMessages: 0, unreadNotifications: 0 });

export function useLiveCounts() {
  return useContext(Ctx);
}

// Exposed so AccountNav can trigger an immediate refresh after marking read
export function useRefreshCounts() {
  return useContext(RefreshCtx);
}
const RefreshCtx = createContext<() => void>(() => {});

export function LiveUpdatesProvider({ children }: { children: React.ReactNode }) {
  const [counts, setCounts] = useState<Counts>({ unreadMessages: 0, unreadNotifications: 0 });
  const esRef = useRef<EventSource | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }

    const es = new EventSource("/api/events");
    esRef.current = es;

    es.onmessage = (e) => {
      try {
        const d = JSON.parse(e.data) as { n: number; m: number };
        setCounts({ unreadNotifications: d.n ?? 0, unreadMessages: d.m ?? 0 });
      } catch {
        /* ignore */
      }
    };

    es.addEventListener("done", () => {
      es.close();
      esRef.current = null;
      if (mountedRef.current) {
        retryRef.current = setTimeout(connect, 1_000);
      }
    });

    es.onerror = () => {
      es.close();
      esRef.current = null;
      if (mountedRef.current) {
        retryRef.current = setTimeout(connect, 5_000);
      }
    };
  }, []);

  // Manual refresh (e.g. after marking notifications read)
  const refresh = useCallback(() => {
    fetch("/api/events", { cache: "no-store" }).catch(() => {});
    // Bounce the SSE connection to get fresh counts immediately
    if (retryRef.current) clearTimeout(retryRef.current);
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
    retryRef.current = setTimeout(connect, 100);
  }, [connect]);

  useEffect(() => {
    mountedRef.current = true;

    // Only stream when user is authenticated (SSE returns 401 otherwise)
    fetch("/api/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d?.user?.id && mountedRef.current) connect();
      })
      .catch(() => {});

    return () => {
      mountedRef.current = false;
      esRef.current?.close();
      if (retryRef.current) clearTimeout(retryRef.current);
    };
  }, [connect]);

  // Register service worker
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
        /* SW optional — silently ignore */
      });
    }
  }, []);

  return (
    <RefreshCtx.Provider value={refresh}>
      <Ctx.Provider value={counts}>{children}</Ctx.Provider>
    </RefreshCtx.Provider>
  );
}

// ── PWA install prompt ────────────────────────────────────────────────────

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PwaInstallBanner() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Don't show if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) return;
    if (localStorage.getItem("pwa-dismissed")) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!prompt || dismissed) return null;

  const install = async () => {
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "dismissed") {
      localStorage.setItem("pwa-dismissed", "1");
    }
    setPrompt(null);
  };

  const dismiss = () => {
    localStorage.setItem("pwa-dismissed", "1");
    setDismissed(true);
  };

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-80 z-50 bg-card border border-border rounded-xl p-4 shadow-2xl flex items-start gap-3 animate-in slide-in-from-bottom-4 duration-300">
      <Image
        src="/icon-192.png"
        alt=""
        width={40}
        height={40}
        className="size-10 rounded-xl shrink-0"
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold">Install X-VAULT</p>
        <p className="text-xs text-muted-foreground mt-0.5">Add to home screen for faster access</p>
        <div className="flex gap-2 mt-2.5">
          <button
            onClick={install}
            className="text-xs font-bold bg-primary text-primary-foreground px-3 py-1.5 rounded-md"
          >
            Install
          </button>
          <button onClick={dismiss} className="text-xs text-muted-foreground px-2 py-1.5">
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Web Push opt-in button ─────────────────────────────────────────────────
export function PushOptIn() {
  const [state, setState] = useState<"idle" | "asking" | "subscribed" | "denied" | "unsupported">(
    "idle",
  );

  useEffect(() => {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      setState("unsupported");
      return;
    }
    if (Notification.permission === "granted") setState("subscribed");
    else if (Notification.permission === "denied") setState("denied");
  }, []);

  const subscribe = async () => {
    setState("asking");
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setState("denied");
        return;
      }

      // Get VAPID public key
      const { publicKey } = (await fetch("/api/public/vapid-key").then((r) => r.json())) as {
        publicKey: string | null;
      };
      if (!publicKey) {
        setState("subscribed"); // SW works but push disabled server-side
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      const json = sub.toJSON() as { endpoint: string; keys?: { p256dh?: string; auth?: string } };
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
      });
      setState("subscribed");
    } catch {
      setState("idle");
    }
  };

  if (state === "unsupported" || state === "subscribed") return null;

  if (state === "denied") {
    return (
      <p className="text-xs text-muted-foreground">
        Push notifications are blocked. Enable them in your browser settings.
      </p>
    );
  }

  return (
    <button
      onClick={subscribe}
      disabled={state === "asking"}
      className="text-xs font-medium px-3 py-1.5 rounded-md bg-secondary hover:bg-secondary/80 disabled:opacity-50"
    >
      {state === "asking" ? "Enabling…" : "Enable push notifications"}
    </button>
  );
}

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr.buffer as ArrayBuffer;
}
