"use client";

import { useEffect, useState } from "react";
import { DashboardShell } from "@/app/components/dashboard/DashboardShell";
import { defaultWidgetConfig, readWidgetConfig, type WidgetConfig } from "@/lib/dashboard/config";
import type { DashboardData } from "@/lib/dashboard/types";

export default function PreviewPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [widgets, setWidgets] = useState<WidgetConfig[]>(defaultWidgetConfig);
  const [accentColor, setAccentColor] = useState("#c9ff52");
  const [fontFamily, setFontFamily] = useState("Arial");
  useEffect(() => { const controller = new AbortController(); void fetch("/api/dashboard", { signal: controller.signal, cache: "no-store" }).then((response) => response.json() as Promise<DashboardData>).then(setData); void fetch("/api/config", { signal: controller.signal }).then((response) => response.json() as Promise<{ widgets?: WidgetConfig[]; accentColor?: string; fontFamily?: string }>).then((config) => { if (config.widgets) setWidgets(config.widgets); if (config.accentColor) setAccentColor(config.accentColor); const locallySelectedFont = window.localStorage.getItem("desk-dashboard-font"); setFontFamily(config.fontFamily && (config.fontFamily !== "Arial" || !locallySelectedFont) ? config.fontFamily : locallySelectedFont || "Arial"); }).catch(() => { queueMicrotask(() => { setWidgets(readWidgetConfig(window.localStorage.getItem("desk-dashboard-widgets"))); setAccentColor(window.localStorage.getItem("desk-dashboard-accent") || "#c9ff52"); setFontFamily(window.localStorage.getItem("desk-dashboard-font") || "Arial"); }); }); return () => controller.abort(); }, []);
  if (!data) return <main className="dashboard loading-dashboard" aria-busy="true"><span className="sr-only">Loading preview…</span></main>;
  return <DashboardShell data={data} widgets={widgets} accentColor={accentColor} fontFamily={fontFamily} />;
}
