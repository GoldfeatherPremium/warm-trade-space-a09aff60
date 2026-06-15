"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const root = document.documentElement;
    const nowDark = root.classList.toggle("dark");
    try {
      localStorage.setItem("xv-theme", nowDark ? "dark" : "light");
    } catch {
      // storage unavailable
    }
    setDark(nowDark);
  }

  return (
    <button
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      className="size-9 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors shrink-0"
    >
      {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}
