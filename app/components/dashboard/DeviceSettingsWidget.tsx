"use client";

import { useEffect, useState } from "react";
import { defaultDeviceSettings, isNightTime, refreshOptions, resolveBrightness, type DeviceSettings, type NightMode } from "@/lib/device/settings";
import type { DeviceStatus } from "@/lib/device/settings-store";

function signalBars(dbm: number | null) {
  if (dbm === null) return 0;
  if (dbm >= -55) return 4;
  if (dbm >= -65) return 3;
  if (dbm >= -75) return 2;
  return 1;
}

const signalLabel = (dbm: number | null) => (dbm === null ? "Unknown" : dbm >= -55 ? "Excellent" : dbm >= -65 ? "Good" : dbm >= -75 ? "Fair" : "Weak");

function formatUptime(seconds: number | null) {
  if (seconds === null) return "—";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return days > 0 ? `${days}d ${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}` : `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

const formatHeap = (bytes: number | null) => (bytes === null ? "—" : `${Math.round(bytes / 1024)} KB free`);

const refreshLabel = (seconds: number) => (seconds < 60 ? `${seconds}s` : `${seconds / 60}m`);

export function DeviceSettingsWidget() {
  const [settings, setSettings] = useState<DeviceSettings>(defaultDeviceSettings);
  const [saved, setSaved] = useState<DeviceSettings | null>(null);
  const [status, setStatus] = useState<DeviceStatus | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [rebootState, setRebootState] = useState<"idle" | "confirm" | "sent">("idle");

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/device", { signal: controller.signal, cache: "no-store" })
      .then((response) => response.json() as Promise<{ settings: DeviceSettings; status: DeviceStatus }>)
      .then((state) => { setSettings(state.settings); setSaved(state.settings); setStatus(state.status); })
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

  const reboot = async () => {
    if (rebootState !== "confirm") { setRebootState("confirm"); return; }
    try { await fetch("/api/device", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "reboot" }) }); setRebootState("sent"); } catch { setRebootState("idle"); }
  };

  const online = status?.reportedAt !== null && status?.reportedAt !== undefined;
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
      <p className="device-note">{night ? `Night mode is active now — showing ${effective === 0 ? "a blank screen" : `${effective}%`}.` : `Showing ${settings.brightness}% now.`}</p>
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

      <span className="card-label device-label-spaced">Wi-Fi</span>
      <div className="device-readout"><span>Network</span><strong>{status?.wifi?.ssid ?? "—"}</strong></div>
      <div className="device-readout"><span>Signal</span><strong className="signal"><i className={`bars bars-${signalBars(status?.wifi?.signalDbm ?? null)}`} aria-hidden="true"><b /><b /><b /><b /></i>{status?.wifi?.signalDbm !== null && status?.wifi?.signalDbm !== undefined ? `${status.wifi.signalDbm} dBm · ${signalLabel(status.wifi.signalDbm)}` : "—"}</strong></div>
      <div className="device-readout"><span>IP address</span><strong>{status?.wifi?.ipAddress ?? "—"}</strong></div>
      <p className="device-note">To join a different network, use the setup portal on the device itself.</p>
    </article>

    <article className="card device-card">
      <span className="card-label">Device</span>
      <div className="device-readout"><span>Status</span><strong className={`device-state ${online ? "online" : ""}`}><i />{online ? "Connected" : "Waiting for device"}</strong></div>
      <div className="device-readout"><span>Model</span><strong>Waveshare ESP32-S3</strong></div>
      <div className="device-readout"><span>Firmware</span><strong>{status?.firmware ?? "—"}</strong></div>
      <div className="device-readout"><span>Uptime</span><strong>{formatUptime(status?.uptimeSeconds ?? null)}</strong></div>
      <div className="device-readout"><span>Memory</span><strong>{formatHeap(status?.freeHeapBytes ?? null)}</strong></div>
      <button type="button" className={`device-reboot ${rebootState === "confirm" ? "confirm" : ""}`} onClick={reboot} disabled={rebootState === "sent"}>
        {rebootState === "sent" ? "Reboot queued" : rebootState === "confirm" ? "Tap again to confirm" : "Reboot display"}
      </button>
      <p className="device-note">{rebootState === "sent" ? "The display reboots on its next check-in." : "The display picks this up on its next check-in."}</p>
    </article>

    <div className="device-actions">
      <span className={`save-status ${saveState === "error" ? "error" : dirty ? "dirty" : "synced"}`}><span />{saveState === "error" ? "Couldn’t save — try again" : dirty ? "Unsaved changes" : "Saved to display"}</span>
      <button type="button" className="secondary" onClick={() => { if (saved) { setSettings(saved); setSaveState("idle"); } }} disabled={!dirty || saveState === "saving"}>Revert</button>
      <button type="button" onClick={save} disabled={!dirty || saveState === "saving"}>{saveState === "saving" ? "Saving…" : dirty ? "Save changes" : "Saved"}</button>
    </div>
  </section>;
}
