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

/**
 * Minutes to pretend the next meeting is away, from `?meetingIn=3`.
 *
 * A meeting is almost never five minutes out at the moment you want to look at
 * the card that says so, and the states worth reviewing — the red countdown, an
 * empty runway — are the ones real data hands you least often. Read from the
 * URL rather than a control on the page: this is a preview of the display, and
 * the display has no simulate button.
 *
 * Read once, on mount, and off `window` rather than through useSearchParams so
 * the page needs no Suspense boundary around it.
 */
function readSimulatedStart(): { startAt: string; minutesUntil: number } | null {
  if (typeof window === "undefined") return null;
  const raw = new URLSearchParams(window.location.search).get("meetingIn");
  const minutes = Number(raw);
  if (raw === null || !Number.isFinite(minutes)) return null;
  return { startAt: new Date(Date.now() + minutes * 60_000).toISOString(), minutesUntil: Math.ceil(minutes) };
}

export default function PreviewPage() {
  const { settings, brightness } = useDeviceSettings();
  // Pinned at mount, so it counts down from there instead of being reset to the
  // same number by every dashboard refresh — crossing the five-minute line is
  // the thing being watched.
  const [simulatedStart] = useState(readSimulatedStart);
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
  // Only the start time is moved; the meeting is otherwise the real one, so the
  // title and location on screen are still what the calendar returned.
  const shown = simulatedStart && data.nextMeeting
    ? { ...data, nextMeeting: { ...data.nextMeeting, ...simulatedStart } }
    : data;
  return <div className="display-surface" style={{ filter: brightness < 100 ? `brightness(${Math.max(brightness, 0) / 100})` : undefined }} data-screen-off={brightness === 0 ? "true" : undefined}><CanvasViewport canvas={config.canvas}><DashboardShell data={nowPlaying === undefined ? shown : { ...shown, spotifyNowPlaying: nowPlaying }} widgets={config.widgets} accentColor={config.accentColor} fontFamily={config.fontFamily} canvas={config.canvas} /></CanvasViewport></div>;
}
