import { getDeviceState, requestReboot, setDeviceSettings } from "@/lib/device/settings-store";
import type { DeviceSettings } from "@/lib/device/settings";
import { isAdminAuthenticated, isPasswordConfigured } from "@/lib/auth";

async function guard() { return !isPasswordConfigured() || (await isAdminAuthenticated()); }

export async function GET() { return Response.json(await getDeviceState()); }

export async function PUT(request: Request) {
  if (!(await guard())) return Response.json({ error: "Authentication required" }, { status: 401 });
  const body = await request.json() as Partial<DeviceSettings>;
  return Response.json(await setDeviceSettings(body));
}

export async function POST(request: Request) {
  if (!(await guard())) return Response.json({ error: "Authentication required" }, { status: 401 });
  const body = await request.json().catch(() => ({})) as { action?: string };
  if (body.action !== "reboot") return Response.json({ error: "Unsupported action" }, { status: 400 });
  return Response.json(await requestReboot());
}
