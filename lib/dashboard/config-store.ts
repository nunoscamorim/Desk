import { defaultWidgetConfig, type WidgetConfig } from "./config";

export type DashboardConfig = { widgets: WidgetConfig[]; accentColor: string };
let config: DashboardConfig = { widgets: defaultWidgetConfig, accentColor: "#c9ff52" };

export function getDashboardConfig() { return config; }
export function setDashboardConfig(next: DashboardConfig) { config = next; return config; }
