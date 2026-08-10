import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { defaultCanvas, defaultWidgetConfig, legacyCanvas, normalizeCanvas, normalizeWidgetConfig, rescaleWidgetGeometry, type CanvasSize, type WidgetConfig } from "./config";

export type DashboardConfig = { widgets: WidgetConfig[]; accentColor: string; fontFamily: string; canvas: CanvasSize };
const defaultConfig: DashboardConfig = { widgets: defaultWidgetConfig, accentColor: "#c9ff52", fontFamily: "Arial", canvas: defaultCanvas };
const configPath = path.join(process.cwd(), "data", "dashboard-config.json");

export async function getDashboardConfig(): Promise<DashboardConfig> {
  try {
    const parsed = JSON.parse(await readFile(configPath, "utf8")) as Partial<DashboardConfig>;
    const widgets = Array.isArray(parsed.widgets) ? normalizeWidgetConfig(parsed.widgets) : defaultConfig.widgets;
    const canvas = normalizeCanvas(parsed.canvas);
    return {
      // A config written before canvas sizing existed was laid out against the
      // 1024×600 panel, so its geometry is carried onto the new canvas rather
      // than read as if it had always been drawn there.
      widgets: canvas ? widgets : rescaleWidgetGeometry(widgets, legacyCanvas, defaultConfig.canvas),
      accentColor: typeof parsed.accentColor === "string" ? parsed.accentColor : defaultConfig.accentColor,
      fontFamily: typeof parsed.fontFamily === "string" ? parsed.fontFamily : defaultConfig.fontFamily,
      canvas: canvas ?? defaultConfig.canvas,
    };
  } catch { return defaultConfig; }
}

export async function setDashboardConfig(next: DashboardConfig): Promise<DashboardConfig> {
  next = { ...next, widgets: normalizeWidgetConfig(next.widgets), canvas: normalizeCanvas(next.canvas) ?? defaultConfig.canvas };
  await mkdir(path.dirname(configPath), { recursive: true });
  await writeFile(configPath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  return next;
}
