"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

/**
 * Navbar light/dark switch. The actual theme class is applied pre-paint by the
 * inline boot script in the root layout, so this only reflects + flips the
 * current state. Persists the choice to localStorage and updates color-scheme
 * for native form controls. Mounts as dark-default to match SSR, then syncs to
 * the real class on the client to avoid a hydration flash.
 */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const [dark, setDark] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    const el = document.documentElement;
    el.classList.toggle("dark", next);
    el.style.colorScheme = next ? "dark" : "light";
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      /* storage blocked — non-fatal */
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={
        mounted ? (dark ? "Switch to light mode" : "Switch to dark mode") : "Toggle theme"
      }
      title="Toggle theme"
      className={`grid size-9 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-secondary/70 hover:text-foreground ${className}`}
    >
      {/* Render both, reveal one — avoids icon swap flash before mount */}
      <Sun className={`size-4 ${mounted && !dark ? "hidden" : "block"}`} />
      <Moon className={`size-4 ${mounted && !dark ? "block" : "hidden"}`} />
    </button>
  );
}
