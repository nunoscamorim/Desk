"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { Header } from "@/app/components/dashboard/Header";
import { BottomNavigation, type DashboardScreen } from "@/app/components/dashboard/BottomNavigation";
import { DashboardScreenContent } from "@/app/components/dashboard/DashboardShell";
import { WidgetRenderer } from "@/app/components/dashboard/WidgetRenderer";
import { bentoArea, type CanvasSize, type WidgetConfig, type WidgetType } from "@/lib/dashboard/config";
import { createWidgetInstance, definitionFor, widgetRegistry, widgetTypes } from "@/lib/dashboard/widget-registry";
import { useAdminConfig } from "./AdminConfigContext";
import { SaveBar } from "./SaveBar";
import { useConfirm } from "./ConfirmContext";
import { useToast } from "./ToastContext";
import { BENTO_GRID, reflowBento } from "./reflow";
import { useNowPlaying } from "@/lib/device/use-now-playing";
import type { DashboardData } from "@/lib/dashboard/types";

/** Stands in for an unset colour: the panel shade most cards already use. */
const DEFAULT_SWATCH = "#211f1c";

async function loadData(): Promise<DashboardData> {
  const response = await fetch("/api/dashboard", { cache: "no-store" });
  if (!response.ok) throw new Error("Dashboard unavailable");
  return response.json() as Promise<DashboardData>;
}

function Preview({ data, config, onChange, accentColor, fontFamily = "Arial", canvas }: { data: DashboardData; config: WidgetConfig[]; onChange: (config: WidgetConfig[]) => void; accentColor: string; fontFamily?: string; canvas: CanvasSize }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [screen, setScreen] = useState<DashboardScreen>("home");
  const [scale, setScale] = useState(1);
  const frameRef = useRef<HTMLDivElement>(null);
  const [interaction, setInteraction] = useState<{ id: string; resize: boolean; x: number; y: number; widget: WidgetConfig } | null>(null);
  const bounds = useMemo(() => bentoArea(canvas), [canvas]);
  // The preview frame is fluid but the canvas is fixed, so the canvas is scaled
  // down to fit rather than cropped or scrolled. The drag handler below reads
  // this scale back off the live transform, so pointer deltas stay in canvas
  // coordinates however far it has been shrunk.
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const updateScale = () => setScale(Math.min(1, frame.clientWidth / canvas.width));
    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(frame);
    return () => observer.disconnect();
  }, [canvas.width]);
  useEffect(() => {
    if (!interaction) return;
    const snap = (value: number) => Math.round(value / BENTO_GRID) * BENTO_GRID;
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
        const { minSize, aspectLock } = definitionFor(widget.type);
        const squareSize = Math.max(minSize.width, Math.min(bounds.width - widget.x, bounds.height - widget.y, snap(Math.max(interaction.widget.width + dx, interaction.widget.height + dy))));
        const candidate = interaction.resize
          ? aspectLock ? { ...widget, width: squareSize, height: squareSize } : { ...widget, width: Math.max(minSize.width, Math.min(bounds.width - widget.x, snap(interaction.widget.width + dx))), height: Math.max(minSize.height, Math.min(bounds.height - widget.y, snap(interaction.widget.height + dy))) }
          : { ...widget, x: Math.max(0, Math.min(bounds.width - widget.width, snap(interaction.widget.x + dx))), y: Math.max(0, Math.min(bounds.height - widget.height, snap(interaction.widget.y + dy))) };
        return candidate;
      });
      onChange(reflowBento(next, interaction.id, bounds));
    };
    const end = () => setInteraction(null);
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", end);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", end); };
  }, [bounds, config, interaction, onChange]);
  const begin = (event: ReactPointerEvent<HTMLDivElement>, widget: WidgetConfig, resize = false) => { event.preventDefault(); event.stopPropagation(); setSelected(widget.id); setInteraction({ id: widget.id, resize, x: event.clientX, y: event.clientY, widget }); };
  useEffect(() => { if (fontFamily === "Arial") return; const link = document.createElement("link"); link.rel = "stylesheet"; link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontFamily).replace(/%20/g, "+")}:wght@400;500;600;700&display=swap`; document.head.appendChild(link); return () => link.remove(); }, [fontFamily]);
  const content = screen === "home"
    ? <section className="dashboard-grid">{config.map((widget) => <WidgetRenderer key={widget.id} widget={widget} data={data} editable selected={selected === widget.id} onPointerDown={(event) => begin(event, widget)} onResizePointerDown={(event) => begin(event as unknown as ReactPointerEvent<HTMLDivElement>, widget, true)} />)}</section>
    : <DashboardScreenContent screen={screen} data={data} widgets={config} />;
  return <div className="admin-preview" ref={frameRef}><div className="admin-preview-canvas" style={{ width: canvas.width * scale, height: canvas.height * scale } as CSSProperties}><main className="dashboard" aria-label="Editable live desk preview" style={{ "--lime": accentColor, "--preview-scale": scale, "--canvas-w": `${canvas.width}px`, "--canvas-h": `${canvas.height}px`, fontFamily } as CSSProperties}><Header data={data} screen={screen} />{content}<BottomNavigation screen={screen} onChange={setScreen} /></main></div><span className="preview-caption">{canvas.width} × {canvas.height} · 32px screen safe area · 16px snap grid · drag to move · corner handle to resize{scale < 1 ? ` · shown at ${Math.round(scale * 100)}%` : ""}</span></div>;
}

export default function AdminDashboardPage() {
  const { config, setConfig, accentColor, fontFamily, canvas, loaded, resetSaveState } = useAdminConfig();
  const confirm = useConfirm();
  const showToast = useToast();
  const [data, setData] = useState<DashboardData | null>(null);
  const nowPlaying = useNowPlaying();
  // The selection is an instance id, not a type: the same type can now appear
  // more than once, so a type would no longer identify a single widget.
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = () => void loadData().then((next) => { if (active) setData(next); }).catch(() => undefined);
    load();
    const timer = window.setInterval(load, 60000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);
  const liveData = data && nowPlaying !== undefined ? { ...data, spotifyNowPlaying: nowPlaying } : data;

  const selectedConfig = useMemo(() => config.find((widget) => widget.id === selected) ?? config[0] ?? null, [config, selected]);
  const selectedDefinition = selectedConfig ? definitionFor(selectedConfig.type) : null;
  const updateSelectedSetting = (key: string, value: string | number | boolean) => { if (!selectedConfig) return; setConfig(config.map((widget) => widget.id === selectedConfig.id ? { ...widget, settings: { ...widget.settings, [key]: value } } : widget)); };
  const toggle = (id: string) => setConfig(config.map((widget) => widget.id === id ? { ...widget, enabled: !widget.enabled } : widget));
  const addWidget = (type: WidgetType) => { const instance = createWidgetInstance(type, config); const next = reflowBento([...config, instance], instance.id, bentoArea(canvas)); setConfig(next); setSelected(instance.id); resetSaveState(); };
  const duplicateWidget = (id: string) => { const source = config.find((widget) => widget.id === id); if (!source) return; const instance = { ...createWidgetInstance(source.type, config), ...{ width: source.width, height: source.height, settings: { ...source.settings } } }; const next = reflowBento([...config, instance], instance.id, bentoArea(canvas)); setConfig(next); setSelected(instance.id); resetSaveState(); };
  const removeWidget = async (id: string) => {
    const widget = config.find((item) => item.id === id);
    if (!widget) return;
    const definition = definitionFor(widget.type);
    const confirmed = await confirm({ title: `Remove ${String(widget.settings.label ?? definition.label)}?`, description: "It comes off the display immediately after you save.", confirmLabel: "Remove", danger: true });
    if (!confirmed) return;
    const next = config.filter((item) => item.id !== id);
    setConfig(next);
    if (selected === id) setSelected(next[0]?.id ?? null);
    resetSaveState();
    showToast(`Removed ${String(widget.settings.label ?? definition.label)}`);
  };

  // Driven by the registry's schema, so a new widget type gets its controls
  // without the admin needing to know anything about it.
  const settingsControls = selectedConfig && selectedDefinition ? selectedDefinition.settingsFields.map((field) => field.type === "boolean"
    ? <label className="settings-check" key={field.key}><input type="checkbox" checked={selectedConfig.settings[field.key] !== false} onChange={(event) => updateSelectedSetting(field.key, event.target.checked)} /> {field.label}</label>
    // A colour input cannot represent "unset", so the stored empty string is
    // named in words and Reset is the way back to it — otherwise merely opening
    // the picker would commit a colour the user never chose.
    : field.type === "color"
    ? <div className="settings-color" key={field.key}>
      <label htmlFor={`widget-setting-${field.key}`}>{field.label}</label>
      <div className="settings-color-row">
        <input id={`widget-setting-${field.key}`} type="color" value={String(selectedConfig.settings[field.key] || DEFAULT_SWATCH)} onChange={(event) => updateSelectedSetting(field.key, event.target.value)} />
        <span className="settings-color-value">{selectedConfig.settings[field.key] ? String(selectedConfig.settings[field.key]) : "Widget default"}</span>
        <button type="button" className="btn btn-secondary" disabled={!selectedConfig.settings[field.key]} onClick={() => updateSelectedSetting(field.key, "")}>Reset</button>
      </div>
    </div>
    : <label key={field.key}>{field.label}<input value={String(selectedConfig.settings[field.key] ?? "")} onChange={(event) => updateSelectedSetting(field.key, event.target.value)} /></label>) : null;

  return <>
    <header className="admin-header"><div><p className="admin-eyebrow">Dashboard / Configuration</p><h1>Make the desk yours.</h1><p>Configure what appears on the display. Save to publish the layout to the iPad.</p></div><SaveBar /></header>
    <div className="admin-workspace">
      <section className="admin-panel widgets-panel">
        <div className="panel-heading"><div><p className="admin-eyebrow">Widgets on the display</p><h2>Choose what stays in view</h2></div><span>{config.filter((widget) => widget.enabled).length}/{config.length} enabled</span></div>
        <div className="widget-list">{config.map((widget) => { const definition = definitionFor(widget.type); return <button type="button" className={`widget-row ${selected === widget.id ? "selected" : ""}`} onClick={() => setSelected(widget.id)} key={widget.id}><span className={`widget-symbol symbol-${widget.type}`}>{definition.symbol}</span><span className="widget-copy"><strong>{String(widget.settings.label ?? definition.label)}</strong><small>{definition.description}</small></span><span className={`toggle ${widget.enabled ? "on" : ""}`} onClick={(event) => { event.stopPropagation(); toggle(widget.id); }} role="switch" aria-checked={widget.enabled} aria-label={`Enable ${definition.label}`}><span /></span></button>; })}</div>
        <div className="widget-add"><label>Add widget<select value="" onChange={(event) => { if (event.target.value) addWidget(event.target.value as WidgetType); }}><option value="">Choose a widget…</option>{widgetTypes.map((type) => <option key={type} value={type}>{widgetRegistry[type].label}</option>)}</select></label></div>
        <div className="widget-settings"><p className="admin-eyebrow">Widget settings</p><h3>{selectedDefinition?.label ?? "No widget selected"}</h3>{selectedConfig ? <>{settingsControls}<div className="widget-instance-actions"><button type="button" className="btn btn-secondary" onClick={() => duplicateWidget(selectedConfig.id)}>Duplicate</button><button type="button" className="btn btn-danger" onClick={() => void removeWidget(selectedConfig.id)}>Remove</button></div></> : <div className="empty-panel"><strong>No widget selected</strong><span>Add a widget below to start arranging the display.</span></div>}</div>
      </section>
      <section className="admin-panel preview-panel">
        <div className="panel-heading"><div><p className="admin-eyebrow">Display preview</p><h2>What the desk sees</h2></div><span className="hardware-chip">{canvas.width} × {canvas.height}</span></div>
        {liveData && loaded ? <Preview data={liveData} config={config} onChange={setConfig} accentColor={accentColor} fontFamily={fontFamily} canvas={canvas} /> : <div className="admin-preview-skeleton" aria-busy="true"><span className="sr-only">Loading preview…</span>{Array.from({ length: 5 }, (_, index) => <span className="skeleton" key={index} />)}</div>}
      </section>
    </div>
  </>;
}
