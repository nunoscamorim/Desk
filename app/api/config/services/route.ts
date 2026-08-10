import { getServiceConfigurationStatus } from "@/lib/services";
import { readServiceCredentials } from "@/lib/services/credential-store";

export async function GET() {
  const services = getServiceConfigurationStatus();
  const credentials = await readServiceCredentials();
  services.googleCalendar.configured ||= Boolean(credentials.googleRefreshToken);
  services.spotify.configured ||= Boolean(credentials.spotifyRefreshToken);
  // Tasks ride the same Google connection as the calendar.
  services.tasksReminders.configured ||= Boolean(credentials.googleRefreshToken);
  return Response.json({ services });
}
