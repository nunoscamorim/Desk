import type { DashboardData } from "@/lib/dashboard/types";
import type { WidgetConfig } from "@/lib/dashboard/config";
import { definitionFor } from "@/lib/dashboard/widget-registry";
import { renderWidget } from "./widget-views";
import type { PointerEvent as ReactPointerEvent } from "react";

export function WidgetRenderer({ widget, data, editable = false, selected = false, onPointerDown, onResizePointerDown }: { widget: WidgetConfig; data: DashboardData; editable?: boolean; selected?: boolean; onPointerDown?: (event: ReactPointerEvent<HTMLDivElement>) => void; onResizePointerDown?: (event: ReactPointerEvent<HTMLButtonElement>) => void }) {
  if (!widget.enabled) return null;
  const style = { left: widget.x, top: widget.y, width: widget.width, height: widget.height };
  return <div className={`configured-widget configured-${widget.type} ${editable ? "editable-widget" : ""} ${selected ? "selected-widget" : ""}`} style={style} onPointerDown={onPointerDown}>{renderWidget(widget.type, data, widget.settings)}{editable && <button type="button" className="resize-handle" aria-label={`Resize ${definitionFor(widget.type).label}`} onPointerDown={onResizePointerDown}><span /></button>}</div>;
}
