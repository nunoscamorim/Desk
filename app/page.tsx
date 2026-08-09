"use client";

import { useEffect, useState } from "react";
import { DashboardShell } from "@/app/components/dashboard/DashboardShell";
import { defaultWidgetConfig, readWidgetConfig, type WidgetConfig } from "@/lib/dashboard/config";
import type { DashboardData } from "@/lib/dashboard/types";

type LoadState =
  | { status: "loading"; data: null; message: null }
  | { status: "ready"; data: DashboardData; message: null }
  | { status: "error"; data: null; message: string };

async function fetchDashboard(signal?: AbortSignal): Promise<DashboardData> {
  const response = await fetch("/api/dashboard", { signal, cache: "no-store" });
  if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
  return response.json() as Promise<DashboardData>;
}

function LoadingDashboard() {
  return <main className="dashboard loading-dashboard" aria-busy="true" aria-label="Loading dashboard"><header className="topbar"><div><span className="skeleton line small" /><span className="skeleton line heading" /></div><span className="skeleton weather-skeleton" /></header><section className="dashboard-grid">{defaultWidgetConfig.filter((widget) => widget.enabled).map((widget) => <div className={`configured-widget configured-${widget.type}`} style={{ left: widget.x, top: widget.y, width: widget.width, height: widget.height }} key={widget.id}><article className="card skeleton-card"><span className="skeleton line small" /><span className="skeleton block" /><span className="skeleton line" /></article></div>)}</section><span className="sr-only">Loading dashboard data…</span></main>;
}

function ErrorDashboard({ message, retry }: { message: string; retry: () => void }) {
  return <main className="dashboard state-dashboard"><div className="state-card" role="alert"><span className="state-icon" aria-hidden="true">!</span><h1>Dashboard unavailable</h1><p>{message}</p><button type="button" onClick={retry}>Try again</button></div></main>;
}

export default function Home() {
  const [state, setState] = useState<LoadState>({ status: "loading", data: null, message: null });
  const [widgets, setWidgets] = useState<WidgetConfig[]>(defaultWidgetConfig);
  const [accentColor, setAccentColor] = useState("#c9ff52");
  const [fontFamily, setFontFamily] = useState("Arial");

  // Render the saved server config verbatim so this dashboard shows exactly what
  // the live display shows. localStorage is only an offline fallback.
  useEffect(() => { void fetch("/api/config").then((response) => response.json() as Promise<{ widgets?: WidgetConfig[]; accentColor?: string; fontFamily?: string }>).then((config) => { setWidgets(config.widgets ?? defaultWidgetConfig); setAccentColor(config.accentColor ?? "#c9ff52"); setFontFamily(config.fontFamily ?? "Arial"); }).catch(() => { setWidgets(readWidgetConfig(window.localStorage.getItem("desk-dashboard-widgets"))); setAccentColor(window.localStorage.getItem("desk-dashboard-accent") || "#c9ff52"); setFontFamily(window.localStorage.getItem("desk-dashboard-font") || "Arial"); }); }, []);

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

  if (state.status === "loading") return <LoadingDashboard />;
  if (state.status === "error") return <ErrorDashboard message={state.message} retry={retry} />;
  return <DashboardShell data={state.data} widgets={widgets} accentColor={accentColor} fontFamily={fontFamily} />;
}
