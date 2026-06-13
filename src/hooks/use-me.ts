import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getMe } from "@/lib/api/auth";
import { pingPresence } from "@/lib/api/chat";

const CACHE_KEY = "xv_me_cache_v1";

type MeData = Awaited<ReturnType<typeof getMe>>;

function readCache(): MeData | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return undefined;
    return JSON.parse(raw) as MeData;
  } catch {
    return undefined;
  }
}

function writeCache(data: MeData | undefined) {
  if (typeof window === "undefined") return;
  try {
    if (data && data.user) window.localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    else window.localStorage.removeItem(CACHE_KEY);
  } catch {
    /* noop */
  }
}

export function useMe() {
  const q = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const data = await getMe();
      writeCache(data);
      return data;
    },
    initialData: readCache,
    staleTime: 60_000,
    refetchInterval: 90_000,
  });

  // Lightweight presence ping while a signed-in user has the tab open.
  // Throttled per admin-configured interval; paused while tab hidden.
  const loggedIn = !!q.data?.user;
  const pingMs = Math.max(15, q.data?.banner?.presencePingSeconds ?? 60) * 1000;
  useEffect(() => {
    if (!loggedIn || typeof window === "undefined") return;
    let active = true;
    const tick = () => {
      if (!active) return;
      if (typeof document !== "undefined" && document.hidden) return;
      pingPresence().catch(() => {
        /* ignore — presence is best-effort */
      });
    };
    tick();
    const id = window.setInterval(tick, pingMs);
    const onVis = () => {
      if (!document.hidden) tick();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      active = false;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [loggedIn, pingMs]);

  return {
    me: q.data?.user ?? null,
    unreadNotifications: q.data?.unreadNotifications ?? 0,
    unreadMessages: q.data?.unreadMessages ?? 0,
    banner: q.data?.banner ?? {
      announcement: null,
      maintenance: false,
      presencePingSeconds: 60,
      lowStockThreshold: 5,
      disputeSlaHours: 72,
    },
    isLoading: q.isLoading,
  };
}

export function useInvalidate() {
  const qc = useQueryClient();
  return (...keys: string[]) => {
    if (keys.length === 0) qc.invalidateQueries();
    for (const k of keys) qc.invalidateQueries({ queryKey: [k] });
  };
}
