"use client";

import { useEffect, useState } from "react";
import { CanvasViewport } from "@/app/components/dashboard/CanvasViewport";
import { DashboardShell } from "@/app/components/dashboard/DashboardShell";
import { defaultCanvas, normalizeCanvas, type CanvasSize, type WidgetConfig } from "@/lib/dashboard/config";
import { defaultWidgetConfig, readWidgetConfig } from "@/lib/dashboard/widget-registry";
import { useDeviceSettings } from "@/lib/device/use-device-settings";
import { useNowPlaying } from "@/lib/device/use-now-playing";
import type { DashboardData } from "@/lib/dashboard/types";

export default function PreviewPage() {
  const { settings, brightness } = useDeviceSettings();
  // Now playing polls on its own fast interval so a track change shows up in
  // seconds, whatever the display's dashboard refresh is set to.
  const nowPlaying = useNowPlaying();
  const [data, setData] = useState<DashboardData | null>(null);
  const [widgets, setWidgets] = useState<WidgetConfig[]>(defaultWidgetConfig);
  const [accentColor, setAccentColor] = useState("#c9ff52");
  const [fontFamily, setFontFamily] = useState("Arial");
  const [canvas, setCanvas] = useState<CanvasSize>(defaultCanvas);
  // The live display renders the saved server config verbatim so it always
  // matches what was saved in /admin. localStorage is only an offline fallback
  // for when the config endpoint is unreachable.
  useEffect(() => { const controller = new AbortController(); void fetch("/api/config", { signal: controller.signal }).then((response) => response.json() as Promise<{ widgets?: WidgetConfig[]; accentColor?: string; fontFamily?: string; canvas?: CanvasSize }>).then((config) => { setWidgets(config.widgets ?? defaultWidgetConfig); setAccentColor(config.accentColor ?? "#c9ff52"); setFontFamily(config.fontFamily ?? "Arial"); setCanvas(normalizeCanvas(config.canvas) ?? defaultCanvas); }).catch((error: unknown) => { if (error instanceof DOMException && error.name === "AbortError") return; setWidgets(readWidgetConfig(window.localStorage.getItem("desk-dashboard-widgets"))); setAccentColor(window.localStorage.getItem("desk-dashboard-accent") || "#c9ff52"); setFontFamily(window.localStorage.getItem("desk-dashboard-font") || "Arial"); }); return () => controller.abort(); }, []);
  // Dashboard data refreshes on the interval saved in the device settings.
  useEffect(() => {
    let active = true;
    const load = () => void fetch("/api/dashboard", { cache: "no-store" }).then((response) => response.json() as Promise<DashboardData>).then((next) => { if (active) setData(next); }).catch(() => undefined);
    load();
    const timer = window.setInterval(load, settings.refreshSeconds * 1000);
    return () => { active = false; window.clearInterval(timer); };
  }, [settings.refreshSeconds]);
  if (!data) return <main className="dashboard loading-dashboard" aria-busy="true"><span className="sr-only">Loading preview…</span></main>;
  return <div className="display-surface" style={{ filter: brightness < 100 ? `brightness(${Math.max(brightness, 0) / 100})` : undefined }} data-screen-off={brightness === 0 ? "true" : undefined}><CanvasViewport canvas={canvas}><DashboardShell data={nowPlaying === undefined ? data : { ...data, spotifyNowPlaying: nowPlaying }} widgets={widgets} accentColor={accentColor} fontFamily={fontFamily} canvas={canvas} /></CanvasViewport></div>;
}
