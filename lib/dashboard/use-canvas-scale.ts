"use client";

import { useEffect, useState } from "react";
import type { CanvasSize } from "./config";

/**
 * Scale that fits the fixed design canvas inside the current viewport without
 * cropping it.
 *
 * The dashboard is laid out at one canvas size and every widget is positioned
 * in absolute canvas pixels, so the display cannot reflow to a different screen
 * — it scales instead. That keeps a single saved layout truthful on the iPad,
 * in a desktop browser, and on whatever panel comes next, and it is why the
 * admin preview can promise that what you arrange is what the display shows.
 */
export function useCanvasScale(canvas: CanvasSize): number {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const update = () => setScale(Math.min(window.innerWidth / canvas.width, window.innerHeight / canvas.height));
    update();
    window.addEventListener("resize", update);
    // iOS fires this without a resize when the iPad is rotated in a home-screen app.
    window.addEventListener("orientationchange", update);
    return () => { window.removeEventListener("resize", update); window.removeEventListener("orientationchange", update); };
  }, [canvas.width, canvas.height]);
  return scale;
}
