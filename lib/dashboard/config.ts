export type WidgetType = "meeting" | "calendar" | "music" | "tasks" | "usage";

export type WidgetSettings = Record<string, string | number | boolean>;

export type WidgetConfig = {
  id: string;
  type: WidgetType;
  enabled: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  settings: WidgetSettings;
};

export const defaultWidgetConfig: WidgetConfig[] = [
  { id: "next-meeting", type: "meeting", enabled: true, x: 0, y: 0, width: 288, height: 192, settings: { label: "Next meeting" } },
  { id: "today-calendar", type: "calendar", enabled: true, x: 304, y: 0, width: 352, height: 400, settings: { label: "Today", showLocations: true } },
  { id: "spotify", type: "music", enabled: true, x: 768, y: 0, width: 192, height: 192, settings: { label: "Now playing" } },
  { id: "tasks", type: "tasks", enabled: true, x: 0, y: 208, width: 288, height: 192, settings: { label: "Tasks" } },
  { id: "ai-usage", type: "usage", enabled: true, x: 672, y: 208, width: 288, height: 112, settings: { label: "AI usage" } },
];

const finiteOr = (value: unknown, fallback: number): number => (typeof value === "number" && Number.isFinite(value) ? value : fallback);

// Reconciles a saved widget list against the canonical widget set: it always
// returns the full default set in its canonical order, but honors every saved
// field — including the x/y/width/height geometry — so what is saved is exactly
// what renders on the dashboard and the live display. Missing or malformed
// values fall back to the default for that single field only.
export function normalizeWidgetConfig(config: WidgetConfig[]): WidgetConfig[] {
  return defaultWidgetConfig.map((fallback) => {
    const saved = config.find((widget) => widget.id === fallback.id);
    if (!saved) return fallback;
    return {
      ...fallback,
      enabled: typeof saved.enabled === "boolean" ? saved.enabled : fallback.enabled,
      x: finiteOr(saved.x, fallback.x),
      y: finiteOr(saved.y, fallback.y),
      width: finiteOr(saved.width, fallback.width),
      height: finiteOr(saved.height, fallback.height),
      settings: { ...fallback.settings, ...(saved.settings ?? {}) },
    };
  });
}

export function readWidgetConfig(value: string | null): WidgetConfig[] {
  if (!value) return defaultWidgetConfig;
  try {
    const parsed = JSON.parse(value) as WidgetConfig[];
    if (!Array.isArray(parsed)) return defaultWidgetConfig;
    return normalizeWidgetConfig(parsed);
  } catch { return defaultWidgetConfig; }
}
