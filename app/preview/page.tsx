"use client";

import { useEffect, useState } from "react";
import { CanvasViewport } from "@/app/components/dashboard/CanvasViewport";
import { DashboardShell } from "@/app/components/dashboard/DashboardShell";
import { defaultCanvas, normalizeCanvas, type CanvasSize, type WidgetConfig } from "@/lib/dashboard/config";
import { defaultWidgetConfig, readWidgetConfig } from "@/lib/dashboard/widget-registry";
import { useDeviceSettings } from "@/lib/device/use-device-settings";
import { useNowPlaying } from "@/lib/device/use-now-playing";
import type { DashboardData } from "@/lib/dashboard/types";

type DisplayConfig = { widgets: WidgetConfig[]; accentColor: string; fontFamily: string; canvas: CanvasSize };

export default function PreviewPage() {
  const { settings, brightness } = useDeviceSettings();
  // Now playing polls on its own fast interval so a track change shows up in
  // seconds, whatever the display's dashboard refresh is set to.
  const nowPlaying = useNowPlaying();
  const [data, setData] = useState<DashboardData | null>(null);
  const [config, setConfig] = useState<DisplayConfig | null>(null);
  // The live display renders the saved server config verbatim so it always
  // matches what was saved in /admin — the same layout Revert restores.
  // Nothing is drawn before this loads: painting the widget-registry defaults
  // first would show the wrong organization and size for a moment before
  // jumping to the saved one.
  useEffect(() => { const controller = new AbortController(); void fetch("/api/config", { signal: controller.signal }).then((response) => response.json() as Promise<Partial<DisplayConfig>>).then((saved) => { setConfig({ widgets: saved.widgets ?? defaultWidgetConfig, accentColor: saved.accentColor ?? "#c9ff52", fontFamily: saved.fontFamily ?? "Arial", canvas: normalizeCanvas(saved.canvas) ?? defaultCanvas }); }).catch((error: unknown) => { if (error instanceof DOMException && error.name === "AbortError") return; setConfig({ widgets: readWidgetConfig(window.localStorage.getItem("desk-dashboard-widgets")), accentColor: window.localStorage.getItem("desk-dashboard-accent") || "#c9ff52", fontFamily: window.localStorage.getItem("desk-dashboard-font") || "Arial", canvas: defaultCanvas }); }); return () => controller.abort(); }, []);
  // Dashboard data refreshes on the interval saved in the device settings.
  useEffect(() => {
    let active = true;
    const load = () => void fetch("/api/dashboard", { cache: "no-store" }).then((response) => response.json() as Promise<DashboardData>).then((next) => { if (active) setData(next); }).catch(() => undefined);
    load();
    const timer = window.setInterval(load, settings.refreshSeconds * 1000);
    return () => { active = false; window.clearInterval(timer); };
  }, [settings.refreshSeconds]);
  if (config === null) return <main className="dashboard-boot" aria-busy="true"><span className="sr-only">Loading preview…</span></main>;
  if (!data) return <main className="dashboard loading-dashboard" aria-busy="true"><span className="sr-only">Loading preview…</span></main>;
  return <div className="display-surface" style={{ filter: brightness < 100 ? `brightness(${Math.max(brightness, 0) / 100})` : undefined }} data-screen-off={brightness === 0 ? "true" : undefined}><CanvasViewport canvas={config.canvas}><DashboardShell data={nowPlaying === undefined ? data : { ...data, spotifyNowPlaying: nowPlaying }} widgets={config.widgets} accentColor={config.accentColor} fontFamily={config.fontFamily} canvas={config.canvas} /></CanvasViewport></div>;
}
