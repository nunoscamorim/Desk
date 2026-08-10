import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { defaultDeviceSettings, normalizeDeviceSettings, type DeviceSettings } from "./settings";

export type DeviceState = { settings: DeviceSettings };

const statePath = path.join(process.cwd(), "data", "device-settings.json");

export async function getDeviceState(): Promise<DeviceState> {
  try {
    const parsed = JSON.parse(await readFile(statePath, "utf8")) as Partial<DeviceState>;
    return { settings: normalizeDeviceSettings(parsed.settings) };
  } catch { return { settings: defaultDeviceSettings }; }
}

export async function setDeviceSettings(next: Partial<DeviceSettings>): Promise<DeviceState> {
  const current = await getDeviceState();
  const state: DeviceState = { settings: normalizeDeviceSettings({ ...current.settings, ...next }) };
  await mkdir(path.dirname(statePath), { recursive: true });
  await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  return state;
}
