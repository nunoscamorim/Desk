"use client";

import { useEffect, useState } from "react";
import { IpadDashboardShell } from "@/app/components/dashboard/IpadDashboardShell";
import { getIpadWidgetConfig } from "@/lib/dashboard/ipad-config";
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
  const ipadConfig = getIpadWidgetConfig();
  return (
    <main className="dashboard loading-dashboard ipad-dashboard" aria-busy="true" aria-label="Loading iPad dashboard">
      <header className="topbar">
        <div>
          <span className="skeleton line small" />
          <span className="skeleton line heading" />
        </div>
        <span className="skeleton weather-skeleton" />
      </header>
      <section className="ipad-dashboard-grid">
        {ipadConfig.filter((widget) => widget.enabled).map((widget) => (
          <div
            className={`configured-widget configured-${widget.type}`}
            style={{ left: widget.x, top: widget.y, width: widget.width, height: widget.height }}
            key={widget.id}
          >
            <article className="card skeleton-card">
              <span className="skeleton line small" />
              <span className="skeleton block" />
              <span className="skeleton line" />
            </article>
          </div>
        ))}
      </section>
      <span className="sr-only">Loading dashboard data…</span>
    </main>
  );
}

function ErrorDashboard({ message, retry }: { message: string; retry: () => void }) {
  return (
    <main className="dashboard state-dashboard" aria-label="Error state">
      <div className="state-card" role="alert">
        <span className="state-icon" aria-hidden="true">!</span>
        <h1>Dashboard unavailable</h1>
        <p>{message}</p>
        <button type="button" onClick={retry}>
          Try again
        </button>
      </div>
    </main>
  );
}

export default function IpadPage() {
  const [state, setState] = useState<LoadState>({ status: "loading", data: null, message: null });
  const [widgets, setWidgets] = useState<WidgetConfig[]>(getIpadWidgetConfig());
  const [accentColor, setAccentColor] = useState("#c9ff52");
  const [fontFamily, setFontFamily] = useState("Arial");

  // Load config from server on mount
  useEffect(() => {
    void fetch("/api/config")
      .then((response) => response.json() as Promise<{ widgets?: WidgetConfig[]; accentColor?: string; fontFamily?: string }>)
      .then((config) => {
        // Use iPad config as default, but allow server overrides
        setWidgets(config.widgets ?? getIpadWidgetConfig());
        setAccentColor(config.accentColor ?? "#c9ff52");
        setFontFamily(config.fontFamily ?? "Arial");
      })
      .catch(() => {
        // Fallback to localStorage then iPad default
        const saved = window.localStorage.getItem("desk-dashboard-widgets");
        setWidgets(saved ? readWidgetConfig(saved) : getIpadWidgetConfig());
        setAccentColor(window.localStorage.getItem("desk-dashboard-accent") || "#c9ff52");
        setFontFamily(window.localStorage.getItem("desk-dashboard-font") || "Arial");
      });
  }, []);

  // Fetch initial dashboard data
  useEffect(() => {
    const controller = new AbortController();
    void fetchDashboard(controller.signal)
      .then((data) => setState({ status: "ready", data, message: null }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setState({
          status: "error",
          data: null,
          message: "We couldn't load the latest desk data. Check the connection and try again.",
        });
      });
    return () => controller.abort();
  }, []);

  const retry = () => {
    setState({ status: "loading", data: null, message: null });
    void fetchDashboard()
      .then((data) => setState({ status: "ready", data, message: null }))
      .catch(() =>
        setState({
          status: "error",
          data: null,
          message: "We couldn't load the latest desk data. Check the connection and try again.",
        })
      );
  };

  if (state.status === "loading") return <LoadingDashboard />;
  if (state.status === "error") return <ErrorDashboard message={state.message} retry={retry} />;
  return (
    <IpadDashboardShell
      data={state.data}
      widgets={widgets}
      accentColor={accentColor}
      fontFamily={fontFamily}
      refreshInterval={5 * 60 * 1000}
    />
  );
}
