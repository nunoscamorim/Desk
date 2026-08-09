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

export function withDefaultWidgetGeometry(config: WidgetConfig[]): WidgetConfig[] {
  return defaultWidgetConfig.map((fallback) => {
    const saved = config.find((widget) => widget.id === fallback.id);
    return { ...fallback, enabled: saved?.enabled ?? fallback.enabled, settings: { ...fallback.settings, ...(saved?.settings ?? {}) } };
  });
}

export function readWidgetConfig(value: string | null): WidgetConfig[] {
  if (!value) return defaultWidgetConfig;
  try {
    const parsed = JSON.parse(value) as WidgetConfig[];
    if (!Array.isArray(parsed)) return defaultWidgetConfig;
    return withDefaultWidgetGeometry(parsed);
  } catch { return defaultWidgetConfig; }
}
