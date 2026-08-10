"use client";

import { useEffect, useState } from "react";

type WakeLockSentinel = { released: boolean; release: () => Promise<void>; addEventListener: (type: "release", listener: () => void) => void };
type WakeLockNavigator = Navigator & { wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinel> } };

export type WakeLockState = "unsupported" | "idle" | "held" | "blocked";

/**
 * Keeps the screen awake while `enabled`, for a display that is meant to stay
 * readable on a desk rather than sleep.
 *
 * The lock is dropped by the browser whenever the page is hidden — switching
 * apps, locking the iPad — and is not restored on its own, so it is re-requested
 * on every return to visibility. iOS also refuses the request until the user has
 * interacted with the page at least once, which is why failure is reported as
 * "blocked" rather than swallowed: on a kiosk nobody is watching the console,
 * and a silent failure looks identical to a display that simply went to sleep.
 */
export function useWakeLock(enabled: boolean): WakeLockState {
  const [state, setState] = useState<WakeLockState>("idle");

  useEffect(() => {
    let cancelled = false;
    let sentinel: WakeLockSentinel | null = null;

    const acquire = async () => {
      const api = (navigator as WakeLockNavigator).wakeLock;
      // Reported asynchronously so the first paint does not depend on a browser
      // capability the server cannot know about.
      await Promise.resolve();
      if (cancelled) return;
      if (!api) { setState("unsupported"); return; }
      if (!enabled) { setState("idle"); return; }
      if (document.visibilityState !== "visible" || (sentinel && !sentinel.released)) return;
      try {
        sentinel = await api.request("screen");
        if (cancelled) { void sentinel.release(); return; }
        setState("held");
        sentinel.addEventListener("release", () => { if (!cancelled) setState("idle"); });
      } catch { if (!cancelled) setState("blocked"); }
    };

    void acquire();
    const retry = () => void acquire();
    document.addEventListener("visibilitychange", retry);
    // The first touch is what unblocks the request on iOS.
    window.addEventListener("pointerdown", retry, { passive: true });

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", retry);
      window.removeEventListener("pointerdown", retry);
      if (sentinel && !sentinel.released) void sentinel.release();
    };
  }, [enabled]);

  return state;
}
