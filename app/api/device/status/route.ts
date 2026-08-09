import { getDeviceState, reportDeviceStatus } from "@/lib/device/settings-store";
import type { DeviceStatus } from "@/lib/device/settings-store";

export async function GET() { const state = await getDeviceState(); return Response.json({ status: state.status, rebootRequestedAt: state.rebootRequestedAt }); }

/**
 * Heartbeat from the display firmware. It reports what only the device knows —
 * Wi-Fi, uptime, firmware — and acknowledges a pending reboot by sending
 * `{ rebooted: true }` on the first heartbeat after it comes back up.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as (Partial<DeviceStatus> & { rebooted?: boolean }) | null;
  if (!body) return Response.json({ error: "Invalid body" }, { status: 400 });
  const state = await reportDeviceStatus(body, body.rebooted === true);
  return Response.json({ settings: state.settings, rebootRequestedAt: state.rebootRequestedAt });
}
