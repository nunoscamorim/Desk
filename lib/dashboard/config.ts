export type WidgetType = "meeting" | "calendar" | "music" | "tasks" | "usage";

export type WidgetSettings = Record<string, string | number | boolean>;

export type CanvasSize = { width: number; height: number };

/**
 * iPad Pro 10.5" in landscape, expressed in CSS points. Its panel is 2224×1668
 * physical pixels, but that is a 2× Retina figure — the browser only ever sees
 * half of it, and laying widgets out against the physical number puts every one
 * of them off-screen.
 */
export const defaultCanvas: CanvasSize = { width: 1112, height: 834 };

/** The canvas every config saved before canvas sizing existed was drawn against. */
export const legacyCanvas: CanvasSize = { width: 1024, height: 600 };

export const canvasPresets: Array<{ label: string; canvas: CanvasSize }> = [
  { label: 'iPad Pro 10.5" landscape', canvas: { width: 1112, height: 834 } },
  { label: 'iPad 10.9" landscape', canvas: { width: 1180, height: 820 } },
  { label: 'iPad Pro 12.9" landscape', canvas: { width: 1366, height: 1024 } },
  { label: "Waveshare 7in (1024 × 600)", canvas: { width: 1024, height: 600 } },
];

export const CANVAS_PADDING = 32;

/**
 * Vertical chrome the widget area sits between: the 32px top padding, the 90px
 * topbar, and 74px reserved for the bottom navigation. Widget bounds, the CSS
 * grid box, and the admin's drag limits all derive from this one number so they
 * cannot drift apart.
 * The gap to the top of the buttons is 30px rather than 32 so the bento height
 * lands on the 16px snap grid for the default canvas (834 − 226 = 608). That
 * lets full-height widgets sit flush at the bottom instead of being floored
 * 14px short by the snap.
 */
const CANVAS_CHROME = CANVAS_PADDING + 90 + 74 + 30;

/** Region widgets may be positioned within, in canvas coordinates. */
export function bentoArea(canvas: CanvasSize): CanvasSize {
  return { width: canvas.width - CANVAS_PADDING * 2, height: canvas.height - CANVAS_CHROME };
}

export function normalizeCanvas(value: unknown): CanvasSize | null {
  if (!value || typeof value !== "object") return null;
  const { width, height } = value as Partial<CanvasSize>;
  if (typeof width !== "number" || typeof height !== "number") return null;
  if (!Number.isFinite(width) || !Number.isFinite(height)) return null;
  return { width: Math.round(Math.min(4096, Math.max(320, width))), height: Math.round(Math.min(4096, Math.max(320, height))) };
}

/**
 * Carries a layout from one canvas to another when the canvas size changes —
 * most importantly when an old pre-canvas config is first read.
 *
 * Positions scale with the canvas so the composition keeps its proportions, but
 * sizes are left alone: the source and target rarely share an aspect ratio (the
 * 1024×600 panel is far wider than an iPad's 4:3), and scaling both axes would
 * stretch square widgets into rectangles. Spreading widgets apart at their
 * original size cannot introduce an overlap when the target is the larger
 * canvas, and the layout stays recognisable for the user to adjust by hand.
 */
export function rescaleWidgetGeometry(widgets: WidgetConfig[], from: CanvasSize, to: CanvasSize): WidgetConfig[] {
  const source = bentoArea(from);
  const target = bentoArea(to);
  if (source.width <= 0 || source.height <= 0) return widgets;
  const ratioX = target.width / source.width;
  const ratioY = target.height / source.height;
  return widgets.map((widget) => {
    const width = Math.min(widget.width, target.width);
    const height = Math.min(widget.height, target.height);
    return {
      ...widget,
      width,
      height,
      x: Math.max(0, Math.min(target.width - width, Math.round(widget.x * ratioX))),
      y: Math.max(0, Math.min(target.height - height, Math.round(widget.y * ratioY))),
    };
  });
}

export type WidgetConfig = {
  id: string;
  type: WidgetType;
  enabled: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  settings: WidgetSettings;
};

// The widget catalog, layout normalisation, and per-type defaults live in
// ./widget-registry — this module stays free of React so the config store and
// API routes can use the canvas maths without pulling components in.
