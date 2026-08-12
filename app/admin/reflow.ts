import type { CanvasSize, WidgetConfig } from "@/lib/dashboard/config";
import { definitionFor } from "@/lib/dashboard/widget-registry";

export const BENTO_GRID = 16;

/**
 * Overlap with a grid step of breathing room around each box, used when the
 * canvas itself changes size and the layout has to be repacked from scratch.
 */
function widgetsOverlap(a: WidgetConfig, b: WidgetConfig) {
  return a.x < b.x + b.width + BENTO_GRID && a.x + a.width + BENTO_GRID > b.x && a.y < b.y + b.height + BENTO_GRID && a.y + a.height + BENTO_GRID > b.y;
}

/**
 * Whether two widgets genuinely cover the same pixels. Unlike the padded test
 * above, boxes sitting flush against each other are not a collision — that is a
 * layout a user may well want, and treating it as an overlap is what made the
 * editor shuffle widgets that were merely adjacent.
 */
export function widgetsIntersect(a: WidgetConfig, b: WidgetConfig) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

/** Ids of every widget currently sitting on top of another, for the editor to flag. */
export function collidingIds(config: WidgetConfig[]): Set<string> {
  const enabled = config.filter((widget) => widget.enabled);
  const ids = new Set<string>();
  for (let index = 0; index < enabled.length; index += 1) {
    for (let other = index + 1; other < enabled.length; other += 1) {
      if (!widgetsIntersect(enabled[index], enabled[other])) continue;
      ids.add(enabled[index].id);
      ids.add(enabled[other].id);
    }
  }
  return ids;
}

const fit = (value: number, extent: number, limit: number) => Math.max(0, Math.min(limit - extent, value));

/**
 * Resolves a drag once the pointer is released: dropping a widget onto another
 * trades their slots, and nothing else on the canvas is touched.
 *
 * This runs only on release, never during the move, so the layout stays still
 * under the pointer instead of rearranging continuously as it used to.
 */
export function settleDrop(config: WidgetConfig[], draggedId: string, from: { x: number; y: number }, bounds: CanvasSize): WidgetConfig[] {
  const dragged = config.find((widget) => widget.id === draggedId);
  if (!dragged) return config;
  const overlapArea = (other: WidgetConfig) =>
    Math.max(0, Math.min(dragged.x + dragged.width, other.x + other.width) - Math.max(dragged.x, other.x)) *
    Math.max(0, Math.min(dragged.y + dragged.height, other.y + other.height) - Math.max(dragged.y, other.y));
  // The widget it covers most, so dropping across a seam trades with whichever
  // one the widget actually landed on rather than whichever comes first.
  const target = config
    .filter((widget) => widget.enabled && widget.id !== draggedId && widgetsIntersect(dragged, widget))
    .sort((a, b) => overlapArea(b) - overlapArea(a))[0];
  if (!target) return config;
  const moved = { ...dragged, x: fit(target.x, dragged.width, bounds.width), y: fit(target.y, dragged.height, bounds.height) };
  const displaced = { ...target, x: fit(from.x, target.width, bounds.width), y: fit(from.y, target.height, bounds.height) };
  return config.map((widget) => (widget.id === moved.id ? moved : widget.id === displaced.id ? displaced : widget));
}

/**
 * The first free slot for a widget being added, scanning top-left first. Only the
 * incoming widget is positioned — an arrangement already on the canvas is never
 * disturbed to make room for it.
 */
export function findFreeSlot(config: WidgetConfig[], widget: WidgetConfig, bounds: CanvasSize): WidgetConfig {
  const others = config.filter((other) => other.enabled && other.id !== widget.id);
  const width = Math.min(widget.width, bounds.width);
  const height = Math.min(widget.height, bounds.height);
  for (let y = 0; y <= bounds.height - height; y += BENTO_GRID) {
    for (let x = 0; x <= bounds.width - width; x += BENTO_GRID) {
      const candidate = { ...widget, x, y, width, height };
      if (!others.some((other) => widgetsIntersect(candidate, other))) return candidate;
    }
  }
  // A full canvas still has to put it somewhere; the collision flag will show it.
  return { ...widget, x: 0, y: 0, width, height };
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
