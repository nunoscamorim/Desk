import type { CanvasSize, WidgetConfig } from "@/lib/dashboard/config";
import { definitionFor } from "@/lib/dashboard/widget-registry";

export const BENTO_GRID = 16;

function widgetsOverlap(a: WidgetConfig, b: WidgetConfig) {
  return a.x < b.x + b.width + BENTO_GRID && a.x + a.width + BENTO_GRID > b.x && a.y < b.y + b.height + BENTO_GRID && a.y + a.height + BENTO_GRID > b.y;
}

export function reflowBento(config: WidgetConfig[], anchorId: string, bounds: CanvasSize): WidgetConfig[] {
  const normalized = config.map((widget) => {
    if (!widget.enabled) return widget;
    const { minSize, aspectLock } = definitionFor(widget.type);
    const width = Math.min(bounds.width, Math.max(minSize.width, Math.floor(widget.width / BENTO_GRID) * BENTO_GRID));
    const height = Math.min(bounds.height, Math.max(minSize.height, Math.floor(widget.height / BENTO_GRID) * BENTO_GRID));
    const squareSize = Math.min(width, height);
    const normalizedWidth = aspectLock ? squareSize : width;
    const normalizedHeight = aspectLock ? squareSize : height;
    return { ...widget, width: normalizedWidth, height: normalizedHeight, x: Math.max(0, Math.min(bounds.width - normalizedWidth, Math.round(widget.x / BENTO_GRID) * BENTO_GRID)), y: Math.max(0, Math.min(bounds.height - normalizedHeight, Math.round(widget.y / BENTO_GRID) * BENTO_GRID)) };
  });
  const enabled = normalized.filter((widget) => widget.enabled);
  const anchor = enabled.find((widget) => widget.id === anchorId);
  if (!anchor) return normalized;
  const ordered = [anchor, ...enabled.filter((widget) => widget.id !== anchorId).sort((a, b) => a.y - b.y || a.x - b.x)];
  const placed: WidgetConfig[] = [];
  for (const widget of ordered) {
    const preferred = { ...widget, x: Math.max(0, Math.min(bounds.width - widget.width, widget.x)), y: Math.max(0, Math.min(bounds.height - widget.height, widget.y)) };
    if (!placed.some((other) => widgetsOverlap(preferred, other))) { placed.push(preferred); continue; }
    const findPosition = (candidate: WidgetConfig) => {
      const positions: Array<{ x: number; y: number; distance: number }> = [];
      for (let y = 0; y <= bounds.height - candidate.height; y += BENTO_GRID) for (let x = 0; x <= bounds.width - candidate.width; x += BENTO_GRID) positions.push({ x, y, distance: Math.abs(x - widget.x) + Math.abs(y - widget.y) });
      positions.sort((a, b) => a.distance - b.distance || a.y - b.y || a.x - b.x);
      return positions.find(({ x, y }) => !placed.some((other) => widgetsOverlap({ ...candidate, x, y }, other)));
    };
    let adapted = widget;
    let position = findPosition(adapted);
    if (!position && widget.id !== anchorId) {
      const variants: WidgetConfig[] = [];
      const { minSize, aspectLock } = definitionFor(widget.type);
      if (aspectLock) for (let size = Math.min(widget.width, widget.height); size >= minSize.width; size -= BENTO_GRID) variants.push({ ...widget, width: size, height: size });
      else for (let width = widget.width; width >= minSize.width; width -= BENTO_GRID) for (let height = widget.height; height >= minSize.height; height -= BENTO_GRID) variants.push({ ...widget, width, height });
      variants.sort((a, b) => (widget.width - a.width) + (widget.height - a.height) - ((widget.width - b.width) + (widget.height - b.height)));
      for (const variant of variants) { const nextPosition = findPosition(variant); if (nextPosition) { adapted = variant; position = nextPosition; break; } }
    }
    if (!position) return config;
    placed.push({ ...adapted, x: position.x, y: position.y });
  }
  return normalized.map((widget) => placed.find((item) => item.id === widget.id) ?? widget);
}
