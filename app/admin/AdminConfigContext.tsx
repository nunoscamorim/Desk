"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { bentoArea, defaultCanvas, normalizeCanvas, rescaleWidgetGeometry, type CanvasSize, type WidgetConfig } from "@/lib/dashboard/config";
import { defaultWidgetConfig, readWidgetConfig } from "@/lib/dashboard/widget-registry";
import { reflowBento } from "./reflow";

type SavedConfig = { widgets: WidgetConfig[]; accentColor: string; fontFamily: string; canvas: CanvasSize };
type SaveState = "idle" | "saving" | "saved" | "error";

type AdminConfigValue = {
  config: WidgetConfig[];
  setConfig: (config: WidgetConfig[]) => void;
  accentColor: string;
  setAccentColor: (color: string) => void;
  fontFamily: string;
  setFontFamily: (font: string) => void;
  canvas: CanvasSize;
  changeCanvas: (next: CanvasSize) => void;
  loaded: boolean;
  dirty: boolean;
  saveState: SaveState;
  save: () => Promise<boolean>;
  revert: () => void;
  resetSaveState: () => void;
};

const AdminConfigContext = createContext<AdminConfigValue | null>(null);

// Owns the config draft (widgets, accent color, font, canvas) shared by the
// Dashboard and Display admin sections. Living in a layout-scoped provider
// means the draft survives navigating between those routes instead of being
// re-fetched or lost.
export function AdminConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfigState] = useState<WidgetConfig[]>(defaultWidgetConfig);
  const [accentColor, setAccentColorState] = useState("#c9ff52");
  const [fontFamily, setFontFamilyState] = useState("Arial");
    const [canvas, setCanvasState] = useState<CanvasSize>(defaultCanvas);
  const [saved, setSaved] = useState<SavedConfig | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
   const [dirty, setDirty] = useState(false);

  

  // Load the saved server config as the source of truth. localStorage is only an
  // offline fallback for when the config endpoint is unreachable.
  useEffect(() => {
    void fetch("/api/config").then((response) => response.json()).then((serverConfig: { widgets?: WidgetConfig[]; accentColor?: string; fontFamily?: string; canvas?: CanvasSize }) => {
      const next = { widgets: serverConfig.widgets ?? defaultWidgetConfig, accentColor: serverConfig.accentColor ?? "#c9ff52", fontFamily: serverConfig.fontFamily ?? "Arial", canvas: normalizeCanvas(serverConfig.canvas) ?? defaultCanvas };
      queueMicrotask(() => { setConfigState(next.widgets); setAccentColorState(next.accentColor); setFontFamilyState(next.fontFamily); setCanvasState(next.canvas); setSaved(next); setDirty(false); });
    }).catch(() => {
      const next = { widgets: readWidgetConfig(window.localStorage.getItem("desk-dashboard-widgets")), accentColor: window.localStorage.getItem("desk-dashboard-accent") || "#c9ff52", fontFamily: window.localStorage.getItem("desk-dashboard-font") || "Arial", canvas: defaultCanvas };
      queueMicrotask(() => { setConfigState(next.widgets); setAccentColorState(next.accentColor); setFontFamilyState(next.fontFamily); setCanvasState(next.canvas); setSaved(next); setDirty(false); });
    });
  }, []);

  // Publish the current layout to the server config that both the dashboard and
  // the live display read from, then adopt the server-normalized result as the
  // new saved baseline. localStorage mirrors it for the offline fallback path.
  const save = async () => {
    setSaveState("saving");
    try {
      const response = await fetch("/api/config", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ widgets: config, accentColor, fontFamily, canvas }) });
      if (!response.ok) throw new Error("Save failed");
      const persisted = await response.json() as { widgets?: WidgetConfig[]; accentColor?: string; fontFamily?: string; canvas?: CanvasSize };
      const next = { widgets: persisted.widgets ?? config, accentColor: persisted.accentColor ?? accentColor, fontFamily: persisted.fontFamily ?? fontFamily, canvas: normalizeCanvas(persisted.canvas) ?? canvas };
      setConfigState(next.widgets); setAccentColorState(next.accentColor); setFontFamilyState(next.fontFamily); setCanvasState(next.canvas); setSaved(next);
      window.localStorage.setItem("desk-dashboard-widgets", JSON.stringify(next.widgets));
      window.localStorage.setItem("desk-dashboard-accent", next.accentColor);
      window.localStorage.setItem("desk-dashboard-font", next.fontFamily);
      window.localStorage.setItem("desk-dashboard-canvas", JSON.stringify(next.canvas));
      setSaveState("saved");
      setDirty(false);
      return true;
    } catch { setSaveState("error"); return false; }
  };

  const revert = () => { if (!saved) return; setConfigState(saved.widgets); setAccentColorState(saved.accentColor); setFontFamilyState(saved.fontFamily); setCanvasState(saved.canvas); setSaveState("idle"); setDirty(false); };

  const setConfig = (config: WidgetConfig[]) => { setConfigState(config); setDirty(true); };
  const setAccentColor = (color: string) => { setAccentColorState(color); setDirty(true); };
  const setFontFamily = (font: string) => { setFontFamilyState(font); setDirty(true); };
  

  // Carries the arranged layout onto the new canvas rather than leaving it
  // pinned to the old one's coordinates, then reflows so nothing lands out of
  // bounds or on top of a neighbour.
    const changeCanvas = (next: CanvasSize) => { const moved = rescaleWidgetGeometry(config, canvas, next); setConfigState(reflowBento(moved, moved[0]?.id ?? "", bentoArea(next))); setCanvasState(next); setSaveState("idle"); setDirty(true); };

    const value: AdminConfigValue = {
    config,
    setConfig,
    accentColor,
    setAccentColor,
    fontFamily,
    setFontFamily,
    canvas,
    changeCanvas,
    loaded: saved !== null,
    dirty,
    saveState,
    save,
    revert,
    resetSaveState: () => setSaveState("idle"),
  };

  return <AdminConfigContext.Provider value={value}>{children}</AdminConfigContext.Provider>;
}

export function useAdminConfig() {
  const ctx = useContext(AdminConfigContext);
  if (!ctx) throw new Error("useAdminConfig must be used within AdminConfigProvider");
  return ctx;
}
