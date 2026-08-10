import type { WidgetConfig } from "./config";

// iPad landscape (1024×768) optimized widget configuration
// Layout: 2 rows × 3 columns with touch-friendly spacing
export const ipadWidgetConfig: WidgetConfig[] = [
  // Row 1 (top)
  { id: "next-meeting", type: "meeting", enabled: true, x: 0, y: 0, width: 320, height: 350, settings: { label: "Next meeting" } },
  { id: "today-calendar", type: "calendar", enabled: true, x: 330, y: 0, width: 350, height: 350, settings: { label: "Today", showLocations: true } },
  { id: "spotify", type: "music", enabled: true, x: 698, y: 0, width: 310, height: 350, settings: { label: "Now playing" } },

  // Row 2 (bottom)
  { id: "tasks", type: "tasks", enabled: true, x: 0, y: 368, width: 330, height: 350, settings: { label: "Tasks" } },
  { id: "ai-usage", type: "usage", enabled: true, x: 348, y: 368, width: 330, height: 350, settings: { label: "AI usage" } },
  // Extra space on right for future widgets or empty space
];

export function getIpadWidgetConfig(): WidgetConfig[] {
  return ipadWidgetConfig;
}
