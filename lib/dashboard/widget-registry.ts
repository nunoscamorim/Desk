import type { WidgetConfig, WidgetSettings, WidgetType } from "./config";

export type WidgetSettingsField =
  | { key: string; type: "text"; label: string }
  | { key: string; type: "boolean"; label: string }
  | { key: string; type: "color"; label: string };

/**
 * Offered by every widget, so it is written once here rather than repeated in
 * each entry below.
 *
 * An empty value means "the colour this card already has in the stylesheet" —
 * the distinction matters because each card type has its own (the meeting card
 * is lime, the Spotify card is green-tinted black), and a colour input has no
 * way of its own to say "unset". A widget nobody has touched therefore keeps
 * looking exactly as designed.
 */
const backgroundField: WidgetSettingsField = { key: "background", type: "color", label: "Background" };

export type WidgetDefinition = {
  label: string;
  description: string;
  /** Glyph shown in the admin's widget list. */
  symbol: string;
  /**
   * Class the widget's own card carries. Held here as data rather than only
   * inside the component so the loading skeleton can wear it too, and the
   * placeholder is the same shape and colour as the thing it stands in for.
   */
  cardClassName: string;
  defaultSize: { width: number; height: number };
  minSize: { width: number; height: number };
  /** Forces width and height to match — the music card is artwork-led. */
  aspectLock: boolean;
  defaultSettings: WidgetSettings;
  settingsFields: WidgetSettingsField[];
};

/**
 * Describes every widget type: what the admin calls it, how small it may get,
 * which settings it exposes, and what its card looks like while loading.
 *
 * This half is deliberately free of React. The config store and the /api/config
 * route normalise saved layouts on the server, and pulling widget components in
 * here would drag `useState` into a server module. The matching components live
 * in app/components/dashboard/widget-views.tsx — adding a type means adding it
 * to the `WidgetType` union, adding an entry here, and adding its view there.
 * Both maps are `Record<WidgetType, …>`, so the compiler names whichever one
 * you forget.
 */
export const widgetRegistry: Record<WidgetType, WidgetDefinition> = {
  meeting: {
    label: "Next meeting",
    description: "Upcoming calendar event",
    symbol: "◷",
    cardClassName: "next-card",
    defaultSize: { width: 288, height: 192 },
    minSize: { width: 160, height: 112 },
    aspectLock: false,
    defaultSettings: { label: "Next meeting", background: "" },
    settingsFields: [{ key: "label", type: "text", label: "Label" }, backgroundField],
  },
  calendar: {
    label: "Calendar",
    description: "Today’s schedule",
    symbol: "□",
    cardClassName: "calendar-card",
    defaultSize: { width: 352, height: 400 },
    minSize: { width: 224, height: 176 },
    aspectLock: false,
    defaultSettings: { label: "Today", showLocations: true, background: "" },
    settingsFields: [{ key: "label", type: "text", label: "Label" }, { key: "showLocations", type: "boolean", label: "Show locations and times" }, backgroundField],
  },
  music: {
    label: "Spotify",
    description: "Currently playing",
    symbol: "♫",
    cardClassName: "music-card",
    defaultSize: { width: 192, height: 192 },
    minSize: { width: 160, height: 160 },
    aspectLock: true,
    defaultSettings: { label: "Now playing", background: "" },
    settingsFields: [{ key: "label", type: "text", label: "Label" }, backgroundField],
  },
  tasks: {
    label: "Tasks",
    description: "Open work items",
    symbol: "✓",
    cardClassName: "tasks-card",
    defaultSize: { width: 288, height: 192 },
    minSize: { width: 192, height: 144 },
    aspectLock: false,
    defaultSettings: { label: "Tasks", background: "" },
    settingsFields: [{ key: "label", type: "text", label: "Label" }, backgroundField],
  },
  habits: {
    label: "Habits",
    description: "Today's habit schedule",
    symbol: "✓",
    cardClassName: "habits-card",
    defaultSize: { width: 288, height: 160 },
    minSize: { width: 224, height: 96 },
    aspectLock: false,
    defaultSettings: { label: "Habits", background: "" },
    settingsFields: [{ key: "label", type: "text", label: "Label" }, backgroundField],
  },
  usage: {
    label: "AI usage",
    description: "Codex, Claude and Opencode limits",
    symbol: "◒",
    cardClassName: "usage-card",
    defaultSize: { width: 288, height: 144 },
    minSize: { width: 224, height: 120 },
    aspectLock: false,
    defaultSettings: { label: "AI usage", background: "" },
    settingsFields: [{ key: "label", type: "text", label: "Label" }, backgroundField],
  },
};

export const widgetTypes = Object.keys(widgetRegistry) as WidgetType[];

export const isWidgetType = (value: unknown): value is WidgetType => typeof value === "string" && value in widgetRegistry;

export const definitionFor = (type: WidgetType): WidgetDefinition => widgetRegistry[type];

/** Layout the display falls back to when nothing has been saved yet. */
export const defaultWidgetConfig: WidgetConfig[] = [
  { id: "next-meeting", type: "meeting", enabled: true, x: 0, y: 0, width: 288, height: 192, settings: { label: "Next meeting" } },
  { id: "today-calendar", type: "calendar", enabled: true, x: 304, y: 0, width: 352, height: 400, settings: { label: "Today", showLocations: true } },
  { id: "spotify", type: "music", enabled: true, x: 768, y: 0, width: 192, height: 192, settings: { label: "Now playing" } },
  { id: "tasks", type: "tasks", enabled: true, x: 0, y: 208, width: 288, height: 192, settings: { label: "Tasks" } },
  { id: "ai-usage", type: "usage", enabled: true, x: 672, y: 208, width: 288, height: 144, settings: { label: "AI usage" } },
  { id: "habits", type: "habits", enabled: true, x: 304, y: 416, width: 352, height: 192, settings: { label: "Habits" } },
];

const finiteOr = (value: unknown, fallback: number): number => (typeof value === "number" && Number.isFinite(value) ? value : fallback);

/**
 * Validates a saved layout instance by instance.
 *
 * This deliberately does not reconcile against a canonical list: a widget is
 * whatever the saved config says it is, so the same type can appear more than
 * once and a type can be left out entirely. Unknown types are dropped rather
 * than trusted, ids are forced unique so React keys and drag targeting stay
 * stable, and any missing field falls back to the registry's default for that
 * one field only.
 */
export function normalizeWidgetConfig(config: WidgetConfig[]): WidgetConfig[] {
  const seen = new Set<string>();
  return config.flatMap((saved) => {
    if (!saved || !isWidgetType(saved.type)) return [];
    const definition = widgetRegistry[saved.type];
    let id = typeof saved.id === "string" && saved.id.length > 0 ? saved.id : saved.type;
    while (seen.has(id)) id = `${id}-2`;
    seen.add(id);
    return [{
      id,
      type: saved.type,
      enabled: typeof saved.enabled === "boolean" ? saved.enabled : true,
      x: finiteOr(saved.x, 0),
      y: finiteOr(saved.y, 0),
      width: finiteOr(saved.width, definition.defaultSize.width),
      height: finiteOr(saved.height, definition.defaultSize.height),
      settings: { ...definition.defaultSettings, ...(saved.settings ?? {}) },
    }];
  });
}

export function readWidgetConfig(value: string | null): WidgetConfig[] {
  if (!value) return defaultWidgetConfig;
  try {
    const parsed = JSON.parse(value) as WidgetConfig[];
    if (!Array.isArray(parsed)) return defaultWidgetConfig;
    const normalized = normalizeWidgetConfig(parsed);
    return normalized.length > 0 ? normalized : defaultWidgetConfig;
  } catch { return defaultWidgetConfig; }
}

/** A fresh instance of `type`, with an id that cannot collide with `existing`. */
export function createWidgetInstance(type: WidgetType, existing: WidgetConfig[]): WidgetConfig {
  const definition = widgetRegistry[type];
  const taken = new Set(existing.map((widget) => widget.id));
  let id: string = type;
  for (let suffix = 2; taken.has(id); suffix += 1) id = `${type}-${suffix}`;
  return { id, type, enabled: true, x: 0, y: 0, width: definition.defaultSize.width, height: definition.defaultSize.height, settings: { ...definition.defaultSettings } };
}
