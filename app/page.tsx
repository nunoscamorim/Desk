"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { CanvasViewport } from "@/app/components/dashboard/CanvasViewport";
import { DashboardShell } from "@/app/components/dashboard/DashboardShell";
import { defaultCanvas, normalizeCanvas, type CanvasSize, type WidgetConfig } from "@/lib/dashboard/config";
import { defaultWidgetConfig, definitionFor, readWidgetConfig } from "@/lib/dashboard/widget-registry";
import { useNowPlaying } from "@/lib/device/use-now-playing";
import type { DashboardData } from "@/lib/dashboard/types";

type DisplayConfig = { widgets: WidgetConfig[]; accentColor: string; fontFamily: string; canvas: CanvasSize };

type LoadState =
  | { status: "loading"; data: null; message: null }
  | { status: "ready"; data: DashboardData; message: null }
  | { status: "error"; data: null; message: string };

async function fetchDashboard(signal?: AbortSignal): Promise<DashboardData> {
  const response = await fetch("/api/dashboard", { signal, cache: "no-store" });
  if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
  return response.json() as Promise<DashboardData>;
}

/**
 * Placeholder for the dashboard while its data loads.
 *
 * Two things keep it from moving under the user when the data lands. It is laid
 * out from the *saved* config rather than the defaults, so a widget that has
 * been dragged or resized keeps its own footprint. And each placeholder wears
 * the class of the card it stands in for, so it inherits that card's padding,
 * display mode and shape — without it the Spotify placeholder was a grey padded
 * box that snapped into a black, zero-padding, full-bleed card.
 */
function LoadingDashboard({ config }: { config: DisplayConfig }) {
  return <CanvasViewport canvas={config.canvas}><main className="dashboard loading-dashboard" aria-busy="true" aria-label="Loading dashboard" style={{ "--canvas-w": `${config.canvas.width}px`, "--canvas-h": `${config.canvas.height}px` } as CSSProperties}><header className="topbar"><div><span className="skeleton line small" /><span className="skeleton line heading" /></div><span className="skeleton weather-skeleton" /></header><section className="dashboard-grid">{config.widgets.filter((widget) => widget.enabled).map((widget) => <div className={`configured-widget configured-${widget.type}`} style={{ left: widget.x, top: widget.y, width: widget.width, height: widget.height }} key={widget.id}><article className={`card skeleton-card ${definitionFor(widget.type).cardClassName}`}><span className="skeleton line small" /><span className="skeleton block" /><span className="skeleton line" /></article></div>)}</section><span className="sr-only">Loading dashboard data…</span></main></CanvasViewport>;
}

function ErrorDashboard({ message, retry }: { message: string; retry: () => void }) {
  return <main className="dashboard state-dashboard"><div className="state-card" role="alert"><span className="state-icon" aria-hidden="true">!</span><h1>Dashboard unavailable</h1><p>{message}</p><button type="button" onClick={retry}>Try again</button></div></main>;
}

export default function Home() {
  const [state, setState] = useState<LoadState>({ status: "loading", data: null, message: null });
  const [config, setConfig] = useState<DisplayConfig | null>(null);
  // Polls independently of the dashboard payload so the music widget stays live.
  const nowPlaying = useNowPlaying();

  // Render the saved server config verbatim so this dashboard shows exactly what
  // the live display shows. localStorage is only an offline fallback.
  useEffect(() => { void fetch("/api/config").then((response) => response.json() as Promise<Partial<DisplayConfig>>).then((saved) => { setConfig({ widgets: saved.widgets ?? defaultWidgetConfig, accentColor: saved.accentColor ?? "#c9ff52", fontFamily: saved.fontFamily ?? "Arial", canvas: normalizeCanvas(saved.canvas) ?? defaultCanvas }); }).catch(() => { setConfig({ widgets: readWidgetConfig(window.localStorage.getItem("desk-dashboard-widgets")), accentColor: window.localStorage.getItem("desk-dashboard-accent") || "#c9ff52", fontFamily: window.localStorage.getItem("desk-dashboard-font") || "Arial", canvas: normalizeCanvas(JSON.parse(window.localStorage.getItem("desk-dashboard-canvas") || "null")) ?? defaultCanvas }); }); }, []);

  useEffect(() => {
    const controller = new AbortController();
    void fetchDashboard(controller.signal).then((data) => setState({ status: "ready", data, message: null })).catch((error: unknown) => {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setState({ status: "error", data: null, message: "We couldn’t load the latest desk data. Check the connection and try again." });
    });
    return () => controller.abort();
  }, []);

  const retry = () => {
    setState({ status: "loading", data: null, message: null });
    void fetchDashboard().then((data) => setState({ status: "ready", data, message: null })).catch(() => setState({ status: "error", data: null, message: "We couldn’t load the latest desk data. Check the connection and try again." }));
  };

  if (state.status === "error") return <ErrorDashboard message={state.message} retry={retry} />;
  // Nothing is drawn before the layout is known. Painting the skeleton against
  // the default layout first would put every placeholder at a position the saved
  // config is about to move it from, which is the jump this is here to avoid —
  // and the config is a local read, so the blank is brief.
  if (config === null) return <main className="dashboard-boot" aria-busy="true"><span className="sr-only">Loading dashboard…</span></main>;
  if (state.status === "loading") return <LoadingDashboard config={config} />;
  return <CanvasViewport canvas={config.canvas}><DashboardShell data={nowPlaying === undefined ? state.data : { ...state.data, spotifyNowPlaying: nowPlaying }} widgets={config.widgets} accentColor={config.accentColor} fontFamily={config.fontFamily} canvas={config.canvas} /></CanvasViewport>;
}
