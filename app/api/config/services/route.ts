import { getServiceConfigurationStatus } from "@/lib/services";

export async function GET() {
  return Response.json({ services: getServiceConfigurationStatus() });
}
