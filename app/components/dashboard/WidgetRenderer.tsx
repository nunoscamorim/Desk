import type { DashboardData } from "@/lib/dashboard/types";
import type { WidgetConfig } from "@/lib/dashboard/config";
import { definitionFor } from "@/lib/dashboard/widget-registry";
import { renderWidget } from "./widget-views";
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react";

/**
 * Picks the text colour that stays readable on `background`.
 *
 * Each card ships with text tuned to the colour it was designed with — the
 * meeting card is near-black ink on lime — so recolouring the card alone would
 * leave that ink sitting on whatever the user chose, black on navy included.
 * The crossover is where black and white score the same contrast ratio against
 * a colour (WCAG relative luminance 0.179), and the two inks are the ones the
 * design already uses rather than new ones invented here.
 */
function inkFor(background: string): string | null {
  const hex = /^#([0-9a-f]{6})$/i.exec(background);
  if (!hex) return null;
  const value = Number.parseInt(hex[1], 16);
  const channel = (shift: number) => { const part = ((value >> shift) & 255) / 255; return part <= 0.03928 ? part / 12.92 : ((part + 0.055) / 1.055) ** 2.4; };
  const luminance = 0.2126 * channel(16) + 0.7152 * channel(8) + 0.0722 * channel(0);
  return luminance > 0.179 ? "#11120e" : "#faf8f1";
}

export function WidgetRenderer({ widget, data, editable = false, selected = false, colliding = false, onPointerDown, onKeyDown, onResizePointerDown }: { widget: WidgetConfig; data: DashboardData; editable?: boolean; selected?: boolean; colliding?: boolean; onPointerDown?: (event: ReactPointerEvent<HTMLDivElement>) => void; onKeyDown?: (event: ReactKeyboardEvent<HTMLDivElement>) => void; onResizePointerDown?: (event: ReactPointerEvent<HTMLButtonElement>) => void }) {
  if (!widget.enabled) return null;
  // Only a widget given a colour of its own carries the class and the variables,
  // so every other one keeps the background its own stylesheet rule gives it —
  // there is no single default that could stand in for all six card types.
  const background = typeof widget.settings.background === "string" ? widget.settings.background.trim() : "";
  const ink = background ? inkFor(background) : null;
  const style = { left: widget.x, top: widget.y, width: widget.width, height: widget.height, ...(background ? { "--widget-bg": background } : {}), ...(ink ? { "--widget-ink": ink } : {}) } as CSSProperties;
  return <div className={`configured-widget configured-${widget.type} ${background ? "has-widget-bg" : ""} ${editable ? "editable-widget" : ""} ${selected ? "selected-widget" : ""} ${colliding ? "is-colliding" : ""}`} style={style} onPointerDown={onPointerDown} onKeyDown={onKeyDown} tabIndex={editable ? 0 : undefined} role={editable ? "group" : undefined} aria-label={editable ? `${definitionFor(widget.type).label} widget${colliding ? ", overlapping another widget" : ""}` : undefined}>{renderWidget(widget.type, data, widget.settings)}{editable && <button type="button" className="resize-handle" aria-label={`Resize ${definitionFor(widget.type).label}`} onPointerDown={onResizePointerDown}><span /></button>}</div>;
}
