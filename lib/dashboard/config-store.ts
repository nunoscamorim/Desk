import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { defaultWidgetConfig, normalizeWidgetConfig, type WidgetConfig } from "./config";

export type DashboardConfig = { widgets: WidgetConfig[]; accentColor: string; fontFamily: string };
const defaultConfig: DashboardConfig = { widgets: defaultWidgetConfig, accentColor: "#c9ff52", fontFamily: "Arial" };
const configPath = path.join(process.cwd(), "data", "dashboard-config.json");

export async function getDashboardConfig(): Promise<DashboardConfig> {
  try {
    const parsed = JSON.parse(await readFile(configPath, "utf8")) as Partial<DashboardConfig>;
    return { widgets: Array.isArray(parsed.widgets) ? normalizeWidgetConfig(parsed.widgets) : defaultConfig.widgets, accentColor: typeof parsed.accentColor === "string" ? parsed.accentColor : defaultConfig.accentColor, fontFamily: typeof parsed.fontFamily === "string" ? parsed.fontFamily : defaultConfig.fontFamily };
  } catch { return defaultConfig; }
}

export async function setDashboardConfig(next: DashboardConfig): Promise<DashboardConfig> {
  next = { ...next, widgets: normalizeWidgetConfig(next.widgets) };
  await mkdir(path.dirname(configPath), { recursive: true });
  await writeFile(configPath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  return next;
}
