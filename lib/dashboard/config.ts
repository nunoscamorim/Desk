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
  { id: "next-meeting", type: "meeting", enabled: true, x: 0, y: 0, width: 295, height: 200, settings: { label: "Next meeting" } },
  { id: "today-calendar", type: "calendar", enabled: true, x: 309, y: 0, width: 357, height: 414, settings: { label: "Today", showLocations: true } },
  { id: "spotify", type: "music", enabled: true, x: 680, y: 0, width: 268, height: 200, settings: { label: "Now playing" } },
  { id: "tasks", type: "tasks", enabled: true, x: 0, y: 214, width: 295, height: 200, settings: { label: "Tasks" } },
  { id: "ai-usage", type: "usage", enabled: true, x: 680, y: 214, width: 268, height: 200, settings: { label: "AI usage" } },
];

export function readWidgetConfig(value: string | null): WidgetConfig[] {
  if (!value) return defaultWidgetConfig;
  try {
    const parsed = JSON.parse(value) as WidgetConfig[];
    if (!Array.isArray(parsed)) return defaultWidgetConfig;
    return defaultWidgetConfig.map((fallback) => ({ ...fallback, ...(parsed.find((item) => item.id === fallback.id) ?? {}), settings: { ...fallback.settings, ...(parsed.find((item) => item.id === fallback.id)?.settings ?? {}) } }));
  } catch { return defaultWidgetConfig; }
}
