export type NightMode = "off" | "dim" | "screen-off";

export type DeviceSettings = {
  brightness: number;
  nightMode: NightMode;
  nightStart: string;
  nightEnd: string;
  nightBrightness: number;
  refreshSeconds: number;
};

export const defaultDeviceSettings: DeviceSettings = {
  brightness: 100,
  nightMode: "off",
  nightStart: "22:00",
  nightEnd: "07:00",
  nightBrightness: 25,
  refreshSeconds: 60,
};

export const refreshOptions = [15, 30, 60, 300, 900] as const;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const isTime = (value: unknown): value is string => typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
const number = (value: unknown, fallback: number, min: number, max: number) => (typeof value === "number" && Number.isFinite(value) ? clamp(Math.round(value), min, max) : fallback);

export function normalizeDeviceSettings(value: Partial<DeviceSettings> | null | undefined): DeviceSettings {
  const settings = value ?? {};
  return {
    brightness: number(settings.brightness, defaultDeviceSettings.brightness, 5, 100),
    nightMode: settings.nightMode === "dim" || settings.nightMode === "screen-off" ? settings.nightMode : "off",
    nightStart: isTime(settings.nightStart) ? settings.nightStart : defaultDeviceSettings.nightStart,
    nightEnd: isTime(settings.nightEnd) ? settings.nightEnd : defaultDeviceSettings.nightEnd,
    nightBrightness: number(settings.nightBrightness, defaultDeviceSettings.nightBrightness, 5, 100),
    refreshSeconds: number(settings.refreshSeconds, defaultDeviceSettings.refreshSeconds, 15, 3600),
  };
}

const minutesOf = (time: string) => { const [hours, minutes] = time.split(":").map(Number); return hours * 60 + minutes; };

/** True while `at` falls inside the night window, which may wrap past midnight. */
export function isNightTime(settings: DeviceSettings, at: Date): boolean {
  const start = minutesOf(settings.nightStart);
  const end = minutesOf(settings.nightEnd);
  const now = at.getHours() * 60 + at.getMinutes();
  if (start === end) return false;
  return start < end ? now >= start && now < end : now >= start || now < end;
}

/** Brightness the display should actually use right now, 0 meaning screen off. */
export function resolveBrightness(settings: DeviceSettings, at: Date = new Date()): number {
  if (settings.nightMode === "off" || !isNightTime(settings, at)) return settings.brightness;
  return settings.nightMode === "screen-off" ? 0 : Math.min(settings.brightness, settings.nightBrightness);
}
