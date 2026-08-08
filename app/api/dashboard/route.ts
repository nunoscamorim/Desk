import { getDashboard } from "@/lib/dashboard";

export async function GET() {
  const dashboard = await getDashboard();

  return Response.json(dashboard);
}
