"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export interface ChartTheme {
  chart1: string;
  chart2: string;
  chart3: string;
  chart4: string;
  chart5: string;
  chart6: string;
  grid: string;
  tickFill: string;
  tooltipBg: string;
  tooltipBorder: string;
}

const FALLBACK_DARK: ChartTheme = {
  chart1: "#8b5cf6",
  chart2: "#6366f1",
  chart3: "#22d3ee",
  chart4: "#34d399",
  chart5: "#fbbf24",
  chart6: "#f472b6",
  grid: "#27272a",
  tickFill: "#71717a",
  tooltipBg: "#18181b",
  tooltipBorder: "#3f3f46",
};

const FALLBACK_LIGHT: ChartTheme = {
  chart1: "#7c3aed",
  chart2: "#4f46e5",
  chart3: "#0891b2",
  chart4: "#059669",
  chart5: "#d97706",
  chart6: "#db2777",
  grid: "#e4e4e7",
  tickFill: "#71717a",
  tooltipBg: "#ffffff",
  tooltipBorder: "#e4e4e7",
};

export function useChartTheme(): ChartTheme {
  const { resolvedTheme } = useTheme();
  const [colors, setColors] = useState<ChartTheme>(
    resolvedTheme === "light" ? FALLBACK_LIGHT : FALLBACK_DARK,
  );

  useEffect(() => {
    function read() {
      // If CSS vars aren't available yet (SSR hydration), fall back gracefully.
      const c1 = cssVar("--chart-1");
      if (!c1) return;
      setColors({
        chart1: `oklch(${c1})`,
        chart2: `oklch(${cssVar("--chart-2")})`,
        chart3: `oklch(${cssVar("--chart-3")})`,
        chart4: `oklch(${cssVar("--chart-4")})`,
        chart5: `oklch(${cssVar("--chart-5")})`,
        chart6: `oklch(${cssVar("--chart-6")})`,
        grid: `oklch(${cssVar("--border")})`,
        tickFill: `oklch(${cssVar("--muted-foreground")})`,
        tooltipBg: `oklch(${cssVar("--popover")})`,
        tooltipBorder: `oklch(${cssVar("--border")})`,
      });
    }
    read();
  }, [resolvedTheme]);

  return colors;
}
