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

// Static chart palette (no light/dark theming).
export const CHART_COLORS: ChartTheme = {
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
