import { getDashboardConfig, setDashboardConfig, type DashboardConfig } from "@/lib/dashboard/config-store";

export async function GET() { return Response.json(getDashboardConfig()); }

export async function PUT(request: Request) {
  const body = await request.json() as Partial<DashboardConfig>;
  const current = getDashboardConfig();
  const next = setDashboardConfig({ widgets: Array.isArray(body.widgets) ? body.widgets : current.widgets, accentColor: typeof body.accentColor === "string" ? body.accentColor : current.accentColor });
  return Response.json(next);
}
