export type ServiceConfiguration = {
  weather: { location: string; latitude: number; longitude: number };
  googleCalendar: { accessToken?: string; calendarId: string };
  icalCalendar: { feedUrls: string[] };
  appleReminders: { appleId?: string; appPassword?: string; lists: string[] };
  spotify: { accessToken?: string };
  coolify: { url?: string; token?: string };
};

const commaSeparated = (value: string | undefined) => (value ?? "").split(/[\n,]/).map((entry) => entry.trim()).filter(Boolean);

/** Server-only integration configuration. Never expose this object to client components. */
export function getServiceConfiguration(): ServiceConfiguration {
  // "*" selects every reminder list, for hosts whose environment editor will not
  // accept an empty value — leaving the variable unset means the same thing.
  const reminderLists = commaSeparated(process.env.APPLE_REMINDERS_LISTS);

  return {
    weather: {
      location: process.env.WEATHER_LOCATION ?? "Leça do Balio",
      latitude: Number(process.env.WEATHER_LATITUDE ?? 41.2077),
      longitude: Number(process.env.WEATHER_LONGITUDE ?? -8.6224),
    },
    googleCalendar: { accessToken: process.env.GOOGLE_CALENDAR_ACCESS_TOKEN, calendarId: process.env.GOOGLE_CALENDAR_ID ?? "primary" },
    // Comma or newline separated so several published calendars — work and
    // personal, from any provider — can be merged onto one display.
    icalCalendar: { feedUrls: commaSeparated(process.env.CALENDAR_ICS_URLS) },
    // An app-specific password, not the Apple ID password — iCloud rejects the
    // account password outright once two-factor auth is on. Whitespace is
    // stripped because the password is displayed in groups and often arrives
    // pasted with spaces; the hyphens Apple issues it with are left alone.
    appleReminders: {
      appleId: process.env.APPLE_REMINDERS_ID?.trim(),
      appPassword: process.env.APPLE_REMINDERS_APP_PASSWORD?.replace(/\s/g, ""),
      lists: reminderLists.includes("*") ? [] : reminderLists,
    },
    spotify: { accessToken: process.env.SPOTIFY_ACCESS_TOKEN },
    coolify: { url: process.env.COOLIFY_URL, token: process.env.COOLIFY_TOKEN },
  };
}

export function getServiceConfigurationStatus() {
  const configuration = getServiceConfiguration();
  return {
    weather: { configured: true, location: configuration.weather.location },
    googleCalendar: { configured: Boolean(configuration.googleCalendar.accessToken), calendarId: configuration.googleCalendar.calendarId },
    icalCalendar: { configured: configuration.icalCalendar.feedUrls.length > 0, feedCount: configuration.icalCalendar.feedUrls.length },
    appleCalendar: { configured: false },
    spotify: { configured: Boolean(configuration.spotify.accessToken) },
    tasksReminders: { configured: Boolean(configuration.appleReminders.appleId && configuration.appleReminders.appPassword) },
    codexUsage: { configured: false },
    claudeCodeUsage: { configured: false },
    coolify: { configured: Boolean(configuration.coolify.url), url: configuration.coolify.url ?? null },
  };
}
