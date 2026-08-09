export type ServiceConfiguration = {
  weather: { location: string; latitude: number; longitude: number };
  googleCalendar: { accessToken?: string; calendarId: string };
  spotify: { accessToken?: string };
  coolify: { url?: string; token?: string };
};

/** Server-only integration configuration. Never expose this object to client components. */
export function getServiceConfiguration(): ServiceConfiguration {
  return {
    weather: {
      location: process.env.WEATHER_LOCATION ?? "Leça do Balio",
      latitude: Number(process.env.WEATHER_LATITUDE ?? 41.2077),
      longitude: Number(process.env.WEATHER_LONGITUDE ?? -8.6224),
    },
    googleCalendar: { accessToken: process.env.GOOGLE_CALENDAR_ACCESS_TOKEN, calendarId: process.env.GOOGLE_CALENDAR_ID ?? "primary" },
    spotify: { accessToken: process.env.SPOTIFY_ACCESS_TOKEN },
    coolify: { url: process.env.COOLIFY_URL, token: process.env.COOLIFY_TOKEN },
  };
}

export function getServiceConfigurationStatus() {
  const configuration = getServiceConfiguration();
  return {
    weather: { configured: true, location: configuration.weather.location },
    googleCalendar: { configured: Boolean(configuration.googleCalendar.accessToken), calendarId: configuration.googleCalendar.calendarId },
    appleCalendar: { configured: false },
    spotify: { configured: Boolean(configuration.spotify.accessToken) },
    tasksReminders: { configured: false },
    codexUsage: { configured: false },
    claudeCodeUsage: { configured: false },
    coolify: { configured: Boolean(configuration.coolify.url), url: configuration.coolify.url ?? null },
  };
}
