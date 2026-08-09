"use client";

import { useEffect, useState } from "react";
import { defaultDeviceSettings, resolveBrightness, type DeviceSettings } from "./settings";

/**
 * Polls the saved device settings and reports the brightness the screen should
 * be showing right now. Re-evaluated on a timer so the night window takes
 * effect without a reload, and re-fetched so a save in /more reaches the
 * display on its own.
 */
const WAKE_MS = 60000;

export function useDeviceSettings(): { settings: DeviceSettings; brightness: number } {
  const [settings, setSettings] = useState<DeviceSettings>(defaultDeviceSettings);
  const [brightness, setBrightness] = useState(defaultDeviceSettings.brightness);
  const [awakeUntil, setAwakeUntil] = useState(0);

  useEffect(() => {
    let active = true;
    const load = () => void fetch("/api/device", { cache: "no-store" })
      .then((response) => response.json() as Promise<{ settings: DeviceSettings }>)
      .then((state) => { if (active) setSettings(state.settings); })
      .catch(() => undefined);
    load();
    const poll = window.setInterval(load, 30000);
    return () => { active = false; window.clearInterval(poll); };
  }, []);

  // Touching the screen wakes it to the configured brightness for a minute, so a
  // dimmed — or fully dark — display can always be read and operated again.
  useEffect(() => {
    const wake = () => setAwakeUntil(Date.now() + WAKE_MS);
    const events: Array<keyof WindowEventMap> = ["pointerdown", "keydown", "wheel"];
    events.forEach((event) => window.addEventListener(event, wake, { passive: true }));
    return () => events.forEach((event) => window.removeEventListener(event, wake));
  }, []);

  useEffect(() => {
    const apply = () => setBrightness(Date.now() < awakeUntil ? settings.brightness : resolveBrightness(settings));
    apply();
    const timer = window.setInterval(apply, 2000);
    return () => window.clearInterval(timer);
  }, [settings, awakeUntil]);

  return { settings, brightness };
}
