import type { WidgetConfig } from "./config";

// iPad Pro 10.5" landscape (2224×1668) optimized widget configuration
// Layout: 2 rows × 3 columns with generous spacing for touch
// Available space: 2224 - 48px padding = 2128px width, 1668 - 160px (header + nav + padding) = 1508px height
export const ipadWidgetConfig: WidgetConfig[] = [
  // Row 1 (top) - spanning ~750px each
  { id: "next-meeting", type: "meeting", enabled: true, x: 24, y: 104, width: 680, height: 680, settings: { label: "Next meeting" } },
  { id: "today-calendar", type: "calendar", enabled: true, x: 724, y: 104, width: 740, height: 680, settings: { label: "Today", showLocations: true } },
  { id: "spotify", type: "music", enabled: true, x: 1484, y: 104, width: 668, height: 680, settings: { label: "Now playing" } },

  // Row 2 (bottom)
  { id: "tasks", type: "tasks", enabled: true, x: 24, y: 804, width: 740, height: 680, settings: { label: "Tasks" } },
  { id: "ai-usage", type: "usage", enabled: true, x: 784, y: 804, width: 740, height: 680, settings: { label: "AI usage" } },
  // Right side reserved for future widgets or breathing room
];

export function getIpadWidgetConfig(): WidgetConfig[] {
  return ipadWidgetConfig;
}
