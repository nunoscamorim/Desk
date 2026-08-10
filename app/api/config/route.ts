import { getDashboardConfig, setDashboardConfig, type DashboardConfig } from "@/lib/dashboard/config-store";
import { isAdminAuthenticated, isPasswordConfigured } from "@/lib/auth";

export async function GET() { return Response.json(await getDashboardConfig()); }

export async function PUT(request: Request) {
  // Match the admin UI's access model: when no ADMIN_PASSWORD is configured the
  // dashboard is open, so saving must work too. Once a password is set, saving
  // requires an authenticated session.
  if (isPasswordConfigured() && !(await isAdminAuthenticated())) return Response.json({ error: "Authentication required" }, { status: 401 });
  const body = await request.json() as Partial<DashboardConfig>;
  const current = await getDashboardConfig();
  const next = await setDashboardConfig({ widgets: Array.isArray(body.widgets) ? body.widgets : current.widgets, accentColor: typeof body.accentColor === "string" ? body.accentColor : current.accentColor, fontFamily: typeof body.fontFamily === "string" ? body.fontFamily : current.fontFamily, canvas: body.canvas ?? current.canvas });
  return Response.json(next);
}
