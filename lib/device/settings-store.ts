import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { defaultDeviceSettings, normalizeDeviceSettings, type DeviceSettings } from "./settings";

/**
 * Runtime facts only the display itself can know. They stay null until the
 * firmware posts a heartbeat to /api/device/status, so the UI can say "waiting
 * for the device" instead of inventing values.
 */
export type DeviceStatus = {
  reportedAt: string | null;
  firmware: string | null;
  uptimeSeconds: number | null;
  freeHeapBytes: number | null;
  wifi: { ssid: string | null; signalDbm: number | null; ipAddress: string | null } | null;
};

export type DeviceState = { settings: DeviceSettings; status: DeviceStatus; rebootRequestedAt: string | null };

const emptyStatus: DeviceStatus = { reportedAt: null, firmware: null, uptimeSeconds: null, freeHeapBytes: null, wifi: null };
const statePath = path.join(process.cwd(), "data", "device-settings.json");

const text = (value: unknown): string | null => (typeof value === "string" && value.trim() ? value.trim().slice(0, 120) : null);
const finite = (value: unknown): number | null => (typeof value === "number" && Number.isFinite(value) ? value : null);

function normalizeStatus(value: Partial<DeviceStatus> | null | undefined): DeviceStatus {
  if (!value) return emptyStatus;
  const wifi = value.wifi;
  return {
    reportedAt: text(value.reportedAt),
    firmware: text(value.firmware),
    uptimeSeconds: finite(value.uptimeSeconds),
    freeHeapBytes: finite(value.freeHeapBytes),
    wifi: wifi ? { ssid: text(wifi.ssid), signalDbm: finite(wifi.signalDbm), ipAddress: text(wifi.ipAddress) } : null,
  };
}

export async function getDeviceState(): Promise<DeviceState> {
  try {
    const parsed = JSON.parse(await readFile(statePath, "utf8")) as Partial<DeviceState>;
    return { settings: normalizeDeviceSettings(parsed.settings), status: normalizeStatus(parsed.status), rebootRequestedAt: text(parsed.rebootRequestedAt) };
  } catch { return { settings: defaultDeviceSettings, status: emptyStatus, rebootRequestedAt: null }; }
}

async function writeState(state: DeviceState): Promise<DeviceState> {
  await mkdir(path.dirname(statePath), { recursive: true });
  await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  return state;
}

export async function setDeviceSettings(next: Partial<DeviceSettings>): Promise<DeviceState> {
  const current = await getDeviceState();
  return writeState({ ...current, settings: normalizeDeviceSettings({ ...current.settings, ...next }) });
}

/** Records a heartbeat from the display and clears any reboot it has now acted on. */
export async function reportDeviceStatus(report: Partial<DeviceStatus>, rebooted = false): Promise<DeviceState> {
  const current = await getDeviceState();
  return writeState({ ...current, status: normalizeStatus({ ...report, reportedAt: new Date().toISOString() }), rebootRequestedAt: rebooted ? null : current.rebootRequestedAt });
}

export async function requestReboot(): Promise<DeviceState> {
  const current = await getDeviceState();
  return writeState({ ...current, rebootRequestedAt: new Date().toISOString() });
}
