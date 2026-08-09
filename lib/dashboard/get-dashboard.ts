import { CoolifyApiService, getServiceConfiguration, GoogleCalendarApiService, MockAppleCalendarService, MockClaudeCodeUsageService, MockCodexUsageService, MockCoolifyService, MockGoogleCalendarService, MockSpotifyService, MockTasksRemindersService, MockWeatherService, OpenWeatherApiService, SpotifyApiService, type AppleCalendarService, type ClaudeCodeUsageService, type CodexUsageService, type CoolifyService, type GoogleCalendarService, type SpotifyService, type TasksRemindersService, type WeatherService } from "@/lib/services";
import { readServiceCredentials } from "@/lib/services/credential-store";
import { getGoogleAccessToken } from "@/lib/services/google-oauth";
import { getSpotifyAccessToken } from "@/lib/services/spotify-oauth";
import type { DashboardData } from "./types";

export type DashboardServices = { weather: WeatherService; googleCalendar: GoogleCalendarService; appleCalendar: AppleCalendarService; spotify: SpotifyService; tasks: TasksRemindersService; codexUsage: CodexUsageService; claudeCodeUsage: ClaudeCodeUsageService; coolify: CoolifyService };

async function withFallback<T>(operation: Promise<T>, fallback: T, timeoutMs = 6000): Promise<T> {
  try { return await Promise.race([operation, new Promise<T>((_, reject) => setTimeout(() => reject(new Error("Service timeout")), timeoutMs))]); } catch { return fallback; }
}

/**
 * Picks the Google Calendar backend. The OAuth-connected path (a stored refresh
 * token, minted fresh on every request via getGoogleAccessToken) is preferred —
 * it is the "permanent access" path that survives hourly access-token expiry.
 * GOOGLE_CALENDAR_ACCESS_TOKEN stays supported as a legacy escape hatch for
 * anyone who'd rather paste a token by hand, but it expires in ~1hr and is not
 * refreshed, so it is only really useful for a quick manual test.
 */
async function buildGoogleCalendarService(configuration: ReturnType<typeof getServiceConfiguration>): Promise<GoogleCalendarService> {
  const credentials = await readServiceCredentials();
  const calendarId = credentials.googleCalendarId ?? configuration.googleCalendar.calendarId;
  if (credentials.googleRefreshToken) return new GoogleCalendarApiService(() => getGoogleAccessToken(), calendarId);
  if (configuration.googleCalendar.accessToken) {
    const token = configuration.googleCalendar.accessToken;
    return new GoogleCalendarApiService(async () => token, calendarId);
  }
  return new MockGoogleCalendarService();
}

async function buildSpotifyService(configuration: ReturnType<typeof getServiceConfiguration>): Promise<SpotifyService> {
  const credentials = await readServiceCredentials();
  if (credentials.spotifyClientId && credentials.spotifyClientSecret && credentials.spotifyRefreshToken) {
    return new SpotifyApiService(() => getSpotifyAccessToken());
  }
  if (configuration.spotify.accessToken) {
    const token = configuration.spotify.accessToken;
    return new SpotifyApiService(async () => token);
  }
  return new MockSpotifyService();
}

export const buildDashboardServices = async (): Promise<DashboardServices> => {
  const configuration = getServiceConfiguration();
  return {
    weather: configuration.weather.apiKey ? new OpenWeatherApiService(configuration.weather.apiKey, configuration.weather.location) : new MockWeatherService(),
    googleCalendar: await buildGoogleCalendarService(configuration),
    appleCalendar: new MockAppleCalendarService(),
    spotify: await buildSpotifyService(configuration),
    tasks: new MockTasksRemindersService(),
    codexUsage: new MockCodexUsageService(),
    claudeCodeUsage: new MockClaudeCodeUsageService(),
    coolify: configuration.coolify.url ? new CoolifyApiService(configuration.coolify.url, configuration.coolify.token) : new MockCoolifyService(),
  };
};

// Kept for anything still constructing services synchronously (e.g. ad hoc scripts);
// the real dashboard route always awaits buildDashboardServices() instead so the
// OAuth-backed calendar is available.
export const mockDashboardServices = (): DashboardServices => { const configuration = getServiceConfiguration(); return { weather: configuration.weather.apiKey ? new OpenWeatherApiService(configuration.weather.apiKey, configuration.weather.location) : new MockWeatherService(), googleCalendar: configuration.googleCalendar.accessToken ? new GoogleCalendarApiService(async () => configuration.googleCalendar.accessToken ?? null, configuration.googleCalendar.calendarId) : new MockGoogleCalendarService(), appleCalendar: new MockAppleCalendarService(), spotify: configuration.spotify.accessToken ? new SpotifyApiService(async () => configuration.spotify.accessToken ?? null) : new MockSpotifyService(), tasks: new MockTasksRemindersService(), codexUsage: new MockCodexUsageService(), claudeCodeUsage: new MockClaudeCodeUsageService(), coolify: configuration.coolify.url ? new CoolifyApiService(configuration.coolify.url, configuration.coolify.token) : new MockCoolifyService() }; };

export async function getDashboard(services?: DashboardServices): Promise<DashboardData> {
  const resolvedServices = services ?? (await buildDashboardServices());
  return getDashboardWithServices(resolvedServices);
}

async function getDashboardWithServices(services: DashboardServices): Promise<DashboardData> {
  const [weather, googleCalendar, appleCalendar, spotifyNowPlaying, tasks, codexUsage, claudeCodeUsage, coolify] = await Promise.all([
    withFallback(services.weather.getCurrentWeather(), await new MockWeatherService().getCurrentWeather()),
    withFallback(services.googleCalendar.getTodayCalendar(), await new MockGoogleCalendarService().getTodayCalendar()),
    withFallback(services.appleCalendar.getTodayCalendar(), { date: new Date().toISOString().slice(0, 10), events: [] }),
    withFallback(services.spotify.getNowPlaying(), null),
    withFallback(services.tasks.getTasks(), []),
    withFallback(services.codexUsage.getUsage(), { usedPercent: 0, period: "weekly" as const, resetsAt: new Date().toISOString() }),
    withFallback(services.claudeCodeUsage.getUsage(), { usedPercent: 0, period: "weekly" as const, resetsAt: new Date().toISOString() }),
    withFallback(services.coolify.getStatus(), { status: "unknown", version: null, checkedAt: new Date().toISOString() }),
  ]);
  const events = [...googleCalendar.events, ...appleCalendar.events].sort((a, b) => a.startAt.localeCompare(b.startAt));
  const todaysCalendar = { date: googleCalendar.date, events };
  const now = Date.now();
  const nextEvent = events.find((event) => new Date(event.endAt).getTime() > now);
  const nextMeeting = nextEvent ? { ...nextEvent, minutesUntil: Math.max(0, Math.ceil((new Date(nextEvent.startAt).getTime() - now) / 60000)) } : null;

  return {
    generatedAt: new Date().toISOString(),
    weather,
    nextMeeting,
    todaysCalendar,
    spotifyNowPlaying,
    tasks,
    codexUsage,
    claudeCodeUsage,
    coolify,
  };
}
