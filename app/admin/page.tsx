"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import Link from "next/link";
import { Header } from "@/app/components/dashboard/Header";
import { WidgetRenderer } from "@/app/components/dashboard/WidgetRenderer";
import { defaultWidgetConfig, readWidgetConfig, type WidgetConfig, type WidgetType } from "@/lib/dashboard/config";
import type { DashboardData } from "@/lib/dashboard/types";

type WidgetId = WidgetType;
const widgets: Array<{ id: WidgetId; label: string; description: string; configId: string }> = [
  { id: "meeting", configId: "next-meeting", label: "Next meeting", description: "Upcoming calendar event" },
  { id: "calendar", configId: "today-calendar", label: "Calendar", description: "Today’s schedule" },
  { id: "music", configId: "spotify", label: "Spotify", description: "Currently playing" },
  { id: "tasks", configId: "tasks", label: "Tasks", description: "Open work items" },
  { id: "usage", configId: "ai-usage", label: "AI usage", description: "Codex and Claude limits" },
];

async function loadData(): Promise<DashboardData> {
  const response = await fetch("/api/dashboard", { cache: "no-store" });
  if (!response.ok) throw new Error("Dashboard unavailable");
  return response.json() as Promise<DashboardData>;
}

function Preview({ data, config, onChange, accentColor }: { data: DashboardData; config: WidgetConfig[]; onChange: (config: WidgetConfig[]) => void; accentColor: string }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [scale, setScale] = useState(0.78);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [interaction, setInteraction] = useState<{ id: string; resize: boolean; x: number; y: number; widget: WidgetConfig } | null>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const updateScale = () => setScale(Math.min(1, canvas.clientWidth / 1024));
    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!interaction) return;
    const move = (event: PointerEvent) => {
      const element = document.querySelector(".admin-preview-canvas") as HTMLElement | null;
      if (!element) return;
      const dashboard = element.querySelector(".dashboard") as HTMLElement | null;
      const transform = dashboard ? getComputedStyle(dashboard).transform : "none";
      const scale = transform !== "none" ? new DOMMatrix(transform).a : 1;
      const dx = (event.clientX - interaction.x) / scale;
      const dy = (event.clientY - interaction.y) / scale;
      const next = config.map((widget) => {
        if (widget.id !== interaction.id) return widget;
        const minWidth = 150;
        const minHeight = 100;
        if (interaction.resize) return { ...widget, width: Math.max(minWidth, Math.min(948 - widget.x, interaction.widget.width + dx)), height: Math.max(minHeight, Math.min(414 - widget.y, interaction.widget.height + dy)) };
        return { ...widget, x: Math.max(0, Math.min(948 - widget.width, interaction.widget.x + dx)), y: Math.max(0, Math.min(414 - widget.height, interaction.widget.y + dy)) };
      });
      onChange(next);
    };
    const end = () => setInteraction(null);
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", end);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", end); };
  }, [config, interaction, onChange]);
  const begin = (event: ReactPointerEvent<HTMLDivElement>, widget: WidgetConfig, resize = false) => { event.preventDefault(); event.stopPropagation(); setSelected(widget.id); setInteraction({ id: widget.id, resize, x: event.clientX, y: event.clientY, widget }); };
  return <div className="admin-preview"><div className="admin-preview-canvas" ref={canvasRef}><main className="dashboard" aria-label="Editable live desk preview" style={{ "--lime": accentColor, "--preview-scale": scale } as CSSProperties}><Header data={data} /><section className="dashboard-grid">{config.map((widget) => <WidgetRenderer key={widget.id} widget={widget} data={data} editable selected={selected === widget.id} onPointerDown={(event) => begin(event, widget)} onResizePointerDown={(event) => begin(event as unknown as ReactPointerEvent<HTMLDivElement>, widget, true)} />)}</section></main></div><span className="preview-caption">1024 × 600 · drag to move · corner handle to resize</span></div>;
}

export default function AdminPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [config, setConfig] = useState<WidgetConfig[]>(defaultWidgetConfig);
  const [selected, setSelected] = useState<WidgetId>("meeting");
  const [accentColor, setAccentColor] = useState("#c9ff52");
  const [configLoaded, setConfigLoaded] = useState(false);
  useEffect(() => { queueMicrotask(() => setConfig(readWidgetConfig(window.localStorage.getItem("desk-dashboard-widgets")))); void fetch("/api/config").then((response) => response.json()).then((serverConfig: { widgets?: WidgetConfig[]; accentColor?: string }) => { queueMicrotask(() => { if (serverConfig.widgets) setConfig(serverConfig.widgets); if (serverConfig.accentColor) setAccentColor(serverConfig.accentColor); setConfigLoaded(true); }); }).catch(() => setConfigLoaded(true)); void loadData().then(setData).catch(() => setData(null)); }, []);
  useEffect(() => { if (!configLoaded) return; window.localStorage.setItem("desk-dashboard-widgets", JSON.stringify(config)); void fetch("/api/config", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ widgets: config, accentColor }) }); }, [config, accentColor, configLoaded]);
  useEffect(() => { queueMicrotask(() => setAccentColor(window.localStorage.getItem("desk-dashboard-accent") || "#c9ff52")); }, []);
  const selectedWidget = useMemo(() => widgets.find((widget) => widget.id === selected) ?? widgets[0], [selected]);
  const selectedConfig = config.find((widget) => widget.type === selected) ?? defaultWidgetConfig.find((widget) => widget.type === selected)!;
  const toggle = (type: WidgetType) => setConfig(config.map((widget) => widget.type === type ? { ...widget, enabled: !widget.enabled } : widget));
  const detailsControl = selected === "calendar" ? <label className="settings-check"><input type="checkbox" checked={selectedConfig.settings.showLocations !== false} onChange={(event) => setConfig(config.map((widget) => widget.type === selected ? { ...widget, settings: { ...widget.settings, showLocations: event.target.checked } } : widget))} /> Show locations and times</label> : <p className="settings-note">This widget updates from its integration data and keeps its display compact for the 7-inch screen.</p>;
  return <main className="admin-shell"><aside className="admin-sidebar"><div className="admin-brand"><span className="brand-mark">D</span><div><strong>Desk dashboard</strong><span>Configuration</span></div></div><nav className="admin-screens" aria-label="Admin screens"><p className="admin-eyebrow">Screens</p><a className="admin-screen active" href="#dashboard"><span>⌂</span>Dashboard</a><a className="admin-screen" href="#display"><span>▣</span>Display</a></nav><div className="admin-integrations"><p className="admin-eyebrow">Integrations</p><div className="integration-row"><span className="integration-dot connected" />Calendar<span className="integration-status">Connected</span></div><div className="integration-row"><span className="integration-dot connected" />Spotify<span className="integration-status">Connected</span></div><div className="integration-row"><span className="integration-dot" />Weather<span className="integration-status">Mock data</span></div></div><Link className="admin-back" href="/">← Back to dashboard</Link></aside><section className="admin-content"><header className="admin-header"><div><p className="admin-eyebrow">Dashboard / Configuration</p><h1>Make the desk yours.</h1><p>Configure what appears on the 7-inch display. Changes save on this device.</p></div><span className="local-badge"><span />Saved locally</span></header><div className="admin-workspace"><section className="admin-panel widgets-panel"><div className="panel-heading"><div><p className="admin-eyebrow">Available widgets</p><h2>Choose what stays in view</h2></div><span>{config.filter((widget) => widget.enabled).length}/{widgets.length} enabled</span></div><div className="widget-list">{widgets.map((widget) => <button type="button" className={`widget-row ${selected === widget.id ? "selected" : ""}`} onClick={() => setSelected(widget.id)} key={widget.id}><span className={`widget-symbol symbol-${widget.id}`}>{widget.id === "meeting" ? "◷" : widget.id === "calendar" ? "□" : widget.id === "music" ? "♫" : widget.id === "tasks" ? "✓" : "◒"}</span><span className="widget-copy"><strong>{widget.label}</strong><small>{widget.description}</small></span><span className={`toggle ${config.find((item) => item.type === widget.id)?.enabled ? "on" : ""}`} onClick={(event) => { event.stopPropagation(); toggle(widget.id); }} role="switch" aria-checked={config.find((item) => item.type === widget.id)?.enabled} aria-label={`Enable ${widget.label}`}><span /></span></button>)}</div><div className="widget-settings"><p className="admin-eyebrow">Widget settings</p><h3>{selectedWidget.label}</h3><label>Label<input value={String(selectedConfig.settings.label ?? "")} onChange={(event) => setConfig(config.map((widget) => widget.type === selected ? { ...widget, settings: { ...widget.settings, label: event.target.value } } : widget))} /></label>{detailsControl}<label className="accent-setting">Accent color<input type="color" value={accentColor} onChange={(event) => { setAccentColor(event.target.value); window.localStorage.setItem("desk-dashboard-accent", event.target.value); }} /></label><p className="settings-note">Drag or resize widgets in the preview. Positions, sizes, and accent color save locally.</p></div></section><section className="admin-panel preview-panel"><div className="panel-heading"><div><p className="admin-eyebrow">Display preview</p><h2>What the desk sees</h2></div><span className="hardware-chip">Waveshare ESP32-S3</span></div>{data ? <Preview data={data} config={config} onChange={setConfig} accentColor={accentColor} /> : <div className="preview-loading">Loading preview…</div>}</section></div></section></main>;
}
