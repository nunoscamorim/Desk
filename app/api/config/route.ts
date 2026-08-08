import { getDashboardConfig, setDashboardConfig, type DashboardConfig } from "@/lib/dashboard/config-store";
import { isAdminAuthenticated } from "@/lib/auth";

export async function GET() { return Response.json(await getDashboardConfig()); }

export async function PUT(request: Request) {
  if (!(await isAdminAuthenticated())) return Response.json({ error: "Authentication required" }, { status: 401 });
  const body = await request.json() as Partial<DashboardConfig>;
  const current = await getDashboardConfig();
  const next = await setDashboardConfig({ widgets: Array.isArray(body.widgets) ? body.widgets : current.widgets, accentColor: typeof body.accentColor === "string" ? body.accentColor : current.accentColor });
  return Response.json(next);
}
