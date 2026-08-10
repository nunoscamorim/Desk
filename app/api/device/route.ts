import { getDeviceState, setDeviceSettings } from "@/lib/device/settings-store";
import type { DeviceSettings } from "@/lib/device/settings";
import { isAdminAuthenticated, isPasswordConfigured } from "@/lib/auth";

export async function GET() { return Response.json(await getDeviceState()); }

export async function PUT(request: Request) {
  if (isPasswordConfigured() && !(await isAdminAuthenticated())) return Response.json({ error: "Authentication required" }, { status: 401 });
  const body = await request.json() as Partial<DeviceSettings>;
  return Response.json(await setDeviceSettings(body));
}
