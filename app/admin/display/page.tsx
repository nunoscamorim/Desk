"use client";

import { canvasPresets } from "@/lib/dashboard/config";
import { useAdminConfig } from "../AdminConfigContext";
import { SaveBar } from "../SaveBar";

const FONTS = ["Arial", "Inter", "Roboto", "Archivo", "DM Sans", "Space Grotesk", "Manrope"];

export default function AdminDisplayPage() {
  const { canvas, changeCanvas, accentColor, setAccentColor, fontFamily, setFontFamily } = useAdminConfig();
  const activePreset = canvasPresets.find((preset) => preset.canvas.width === canvas.width && preset.canvas.height === canvas.height);

  return <>
    <header className="admin-header"><div><p className="admin-eyebrow">Dashboard / Configuration</p><h1>Display settings.</h1><p>Canvas size, accent color, and font apply across the whole display. Save to publish to the iPad.</p></div><SaveBar /></header>
    <div className="admin-workspace">
      <section className="admin-panel">
        <div className="panel-heading"><div><p className="admin-eyebrow">Display</p><h2>Canvas, color, and type</h2></div></div>
        <div className="widget-settings">
          <label className="canvas-setting">Display size<select value={activePreset?.label ?? "custom"} onChange={(event) => { const preset = canvasPresets.find((item) => item.label === event.target.value); if (preset) changeCanvas(preset.canvas); }}>{canvasPresets.map((preset) => <option key={preset.label} value={preset.label}>{preset.label}</option>)}{!activePreset && <option value="custom">Custom · {canvas.width} × {canvas.height}</option>}</select><p className="settings-note">Points, not pixels — a Retina iPad reports half its physical resolution. Changing this carries the current layout across.</p></label>
          <label className="accent-setting">Accent color<input type="color" value={accentColor} onChange={(event) => setAccentColor(event.target.value)} /></label>
          <label className="font-setting">Font<select value={fontFamily} onChange={(event) => setFontFamily(event.target.value)}>{FONTS.map((font) => <option key={font} value={font}>{font}</option>)}</select></label>
        </div>
      </section>
    </div>
  </>;
}
