"use client";

import type { CSSProperties, ReactNode } from "react";
import { useCanvasScale } from "@/lib/dashboard/use-canvas-scale";
import type { CanvasSize } from "@/lib/dashboard/config";

/** Centres the fixed design canvas in the viewport and scales it to fit. */
export function CanvasViewport({ canvas, children }: { canvas: CanvasSize; children: ReactNode }) {
  const scale = useCanvasScale(canvas);
  return <div className="canvas-viewport"><div className="canvas-scaler" style={{ "--canvas-scale": scale } as CSSProperties}>{children}</div></div>;
}
