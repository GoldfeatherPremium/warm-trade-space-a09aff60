"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

/**
 * Light/dark toggle. The initial class is set pre-paint by the inline script in
 * layout.tsx (no FOUC); this just flips the .dark class and persists the choice.
 */
export function ThemeToggle() {
  const [dark, setDark] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
    setMounted(true);
  }, []);

  function toggle() {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("wt-theme", next ? "dark" : "light");
    } catch {
      /* ignore */
    }
    setDark(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      className="grid size-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary/80 hover:text-foreground"
    >
      {/* Avoid an icon flash before hydration reads the real theme */}
      {mounted && dark ? <Sun className="size-4.5" /> : <Moon className="size-4.5" />}
    </button>
  );
}
