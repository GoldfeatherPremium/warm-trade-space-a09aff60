"use client";

import { useTheme } from "next-themes";
import { useEffect, useRef, useState, useTransition } from "react";
import { Moon, Sun, Monitor, ChevronDown } from "lucide-react";
import { updateThemePrefAction } from "@/server/actions/theme";

const OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function select(value: string) {
    setTheme(value);
    setOpen(false);
    startTransition(() => {
      updateThemePrefAction(value).catch(() => {});
    });
  }

  const Icon = !mounted ? Moon : resolvedTheme === "light" ? Sun : Moon;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Toggle theme"
        aria-expanded={open}
        aria-haspopup="listbox"
        className="h-9 rounded-lg flex items-center gap-1.5 px-2.5 text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors shrink-0"
      >
        <Icon className="size-4" />
        <ChevronDown className={`size-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute right-0 top-full mt-1.5 z-50 min-w-[130px] rounded-xl border border-border bg-popover shadow-elev py-1 animate-enter"
        >
          {OPTIONS.map(({ value, label, icon: OptionIcon }) => (
            <button
              key={value}
              role="option"
              aria-selected={theme === value}
              onClick={() => select(value)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors ${
                theme === value
                  ? "text-primary font-semibold"
                  : "text-foreground hover:bg-secondary/60"
              }`}
            >
              <OptionIcon className="size-3.5 shrink-0" />
              {label}
              {theme === value && <span className="ml-auto size-1.5 rounded-full bg-primary" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
