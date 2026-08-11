"use client";

import { useEffect, useState } from "react";
import { defaultDeviceSettings, isNightTime, refreshOptions, resolveBrightness, type DeviceSettings, type NightMode } from "@/lib/device/settings";
import { useWakeLock } from "@/lib/device/use-wake-lock";

const refreshLabel = (seconds: number) => (seconds < 60 ? `${seconds}s` : `${seconds / 60}m`);

const wakeLockCopy: Record<ReturnType<typeof useWakeLock>, string> = {
  held: "Holding the screen awake.",
  idle: "Not holding a wake lock right now.",
  blocked: "Safari refused the wake lock — touch the display once to grant it.",
  unsupported: "This browser has no Wake Lock API. Use Settings › Display & Brightness › Auto-Lock › Never instead.",
};

export function DeviceSettingsWidget() {
  const [settings, setSettings] = useState<DeviceSettings>(defaultDeviceSettings);
  const [saved, setSaved] = useState<DeviceSettings | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const wakeLock = useWakeLock(settings.keepAwake);
  const standalone = typeof window !== "undefined" && (window.matchMedia("(display-mode: standalone)").matches || ("standalone" in window.navigator && Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone)));

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/device", { signal: controller.signal, cache: "no-store" })
      .then((response) => response.json() as Promise<{ settings: DeviceSettings }>)
      .then((state) => { setSettings(state.settings); setSaved(state.settings); })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  const dirty = saved !== null && JSON.stringify(settings) !== JSON.stringify(saved);
  const update = <K extends keyof DeviceSettings>(key: K, value: DeviceSettings[K]) => { setSettings((current) => ({ ...current, [key]: value })); setSaveState("idle"); };

  const save = async () => {
    setSaveState("saving");
    try {
      const response = await fetch("/api/device", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(settings) });
      if (!response.ok) throw new Error("Save failed");
      const state = await response.json() as { settings: DeviceSettings };
      setSettings(state.settings); setSaved(state.settings); setSaveState("saved");
    } catch { setSaveState("error"); }
  };

  const effective = resolveBrightness(settings);
  const night = settings.nightMode !== "off" && isNightTime(settings, new Date());

  return <section className="device-settings">
    <article className="card device-card">
      <span className="card-label">Display</span>
      <label className="device-row slider-row">
        <span>Brightness</span>
        <input type="range" min={5} max={100} step={5} value={settings.brightness} onChange={(event) => update("brightness", Number(event.target.value))} aria-label="Brightness" />
        <strong>{settings.brightness}%</strong>
      </label>
      <div className="device-row">
        <span>Night mode</span>
        <div className="segmented" role="group" aria-label="Night mode">
          {([["off", "Off"], ["dim", "Dim"], ["screen-off", "Screen off"]] as Array<[NightMode, string]>).map(([value, label]) =>
            <button type="button" key={value} className={settings.nightMode === value ? "active" : ""} onClick={() => update("nightMode", value)}>{label}</button>)}
        </div>
      </div>
      {settings.nightMode !== "off" && <>
        <div className="device-row">
          <span>Between</span>
          <div className="time-range">
            <input type="time" value={settings.nightStart} onChange={(event) => update("nightStart", event.target.value)} aria-label="Night mode start" />
            <i>→</i>
            <input type="time" value={settings.nightEnd} onChange={(event) => update("nightEnd", event.target.value)} aria-label="Night mode end" />
          </div>
        </div>
        {settings.nightMode === "dim" && <label className="device-row slider-row">
          <span>Night level</span>
          <input type="range" min={5} max={100} step={5} value={settings.nightBrightness} onChange={(event) => update("nightBrightness", Number(event.target.value))} aria-label="Night brightness" />
          <strong>{settings.nightBrightness}%</strong>
        </label>}
      </>}
      {/* iPadOS gives the web no control over the panel backlight, so this dims
          the page itself. Touching the screen restores full brightness. */}
      <p className="device-note">{night ? `Night mode is active now — showing ${effective === 0 ? "a blank screen" : `${effective}%`}.` : `Showing ${settings.brightness}% now.`} Dimming is applied to the page, not the iPad backlight.</p>
    </article>

    <article className="card device-card">
      <span className="card-label">Data</span>
      <div className="device-row">
        <span>Refresh every</span>
        <div className="segmented" role="group" aria-label="Refresh interval">
          {refreshOptions.map((seconds) => <button type="button" key={seconds} className={settings.refreshSeconds === seconds ? "active" : ""} onClick={() => update("refreshSeconds", seconds)}>{refreshLabel(seconds)}</button>)}
        </div>
      </div>
      <p className="device-note">The display re-fetches calendar, weather, and music data on this interval.</p>
      {/* A full reload rather than a re-fetch: on a display that stays open for
          weeks it is also how a new deploy gets picked up, and how a screen that
          has got itself stuck recovers without finding a keyboard. */}
      <button type="button" className="device-reload" onClick={() => window.location.reload()}>Refresh now</button>
      <p className="device-note">Reloads the display immediately — picks up a new version and clears a stuck screen.</p>

      <span className="card-label device-label-spaced">Screen</span>
      <div className="device-row">
        <span>Keep awake</span>
        <button type="button" className={`toggle ${settings.keepAwake ? "on" : ""}`} role="switch" aria-checked={settings.keepAwake} aria-label="Keep the screen awake" onClick={() => update("keepAwake", !settings.keepAwake)}><span /></button>
      </div>
      <div className="device-readout"><span>Wake lock</span><strong className={`device-state ${wakeLock === "held" ? "online" : ""}`}><i />{wakeLock === "held" ? "Active" : wakeLock === "blocked" ? "Refused" : wakeLock === "unsupported" ? "Unavailable" : "Idle"}</strong></div>
      <p className="device-note">{wakeLockCopy[wakeLock]}</p>
    </article>

    <article className="card device-card">
      <span className="card-label">Kiosk setup</span>
      <div className="device-readout"><span>Home-screen app</span><strong className={`device-state ${standalone ? "online" : ""}`}><i />{standalone ? "Running full screen" : "Running in Safari"}</strong></div>
      <ol className="kiosk-steps">
        <li>In Safari, tap Share › <strong>Add to Home Screen</strong>, then open Desk from the icon — it launches without browser chrome.</li>
        <li>Settings › Accessibility › <strong>Guided Access</strong>, turn it on and set a passcode.</li>
        <li>With Desk open, triple-click the top button to lock the iPad to this one app.</li>
        <li>Settings › Display &amp; Brightness › <strong>Auto-Lock</strong> › Never, as a backstop for the wake lock.</li>
      </ol>
    </article>

    <div className="device-actions">
      <span className={`save-status ${saveState === "error" ? "error" : dirty ? "dirty" : "synced"}`}><span />{saveState === "error" ? "Couldn’t save — try again" : dirty ? "Unsaved changes" : "Saved to display"}</span>
      <button type="button" className="secondary" onClick={() => { if (saved) { setSettings(saved); setSaveState("idle"); } }} disabled={!dirty || saveState === "saving"}>Revert</button>
      <button type="button" onClick={save} disabled={!dirty || saveState === "saving"}>{saveState === "saving" ? "Saving…" : dirty ? "Save changes" : "Saved"}</button>
    </div>
  </section>;
}
