import { CoolifyApiService, getServiceConfiguration, GoogleCalendarApiService, EmptyCalendarService, GoogleTasksApiService, IcalCalendarApiService, MockAppleCalendarService, MockClaudeCodeUsageService, MockCodexUsageService, MockCoolifyService, MockGoogleCalendarService, MockSpotifyService, MockTasksRemindersService, MockWeatherService, OpenMeteoApiService, SpotifyApiService, type AppleCalendarService, type ClaudeCodeUsageService, type CodexUsageService, type CoolifyService, type GoogleCalendarService, type IcalCalendarService, type SpotifyService, type TasksRemindersService, type WeatherService } from "@/lib/services";
import { readServiceCredentials } from "@/lib/services/credential-store";
import { getGoogleAccessToken } from "@/lib/services/google-oauth";
import { getSpotifyAccessToken } from "@/lib/services/spotify-oauth";
import type { DashboardData } from "./types";

export type DashboardServices = { weather: WeatherService; googleCalendar: GoogleCalendarService; appleCalendar: AppleCalendarService; icalCalendar: IcalCalendarService; spotify: SpotifyService; tasks: TasksRemindersService; codexUsage: CodexUsageService; claudeCodeUsage: ClaudeCodeUsageService; coolify: CoolifyService };

// A calendar call may have to mint a fresh access token before it can fetch, so
// it gets a wider budget than a plain single-request service — otherwise the one
// poll per hour that lands on a token refresh times out and shows nothing.
const CALENDAR_TIMEOUT_MS = 15000;

/**
 * Runs a service call, substituting a fallback if it fails or overruns.
 *
 * The reason is always logged: every integration here degrades into plausible
 * looking data, so a silent failure is indistinguishable from a working service
 * on the display itself, and the server log is the only place the truth can
 * surface.
 */
async function withFallback<T>(label: string, operation: Promise<T>, fallback: T, timeoutMs = 6000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([operation, new Promise<T>((_, reject) => { timer = setTimeout(() => reject(new Error(`Service timeout after ${timeoutMs}ms`)), timeoutMs); })]);
  } catch (error) {
    console.error(`[dashboard] ${label} unavailable, using fallback:`, error instanceof Error ? error.message : error);
    return fallback;
  } finally { clearTimeout(timer); }
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
  if (credentials.googleRefreshToken) return new GoogleCalendarApiService((options) => getGoogleAccessToken(options), calendarId);
  if (configuration.googleCalendar.accessToken) {
    const token = configuration.googleCalendar.accessToken;
    // This token cannot be re-minted, so the 401 retry has nothing to fall back
    // on: once Google expires it (~1hr from issue) the calendar stays down until
    // someone pastes a new one. Say so plainly — from the display alone this is
    // indistinguishable from the self-healing OAuth path.
    console.warn("[google-calendar] using GOOGLE_CALENDAR_ACCESS_TOKEN, which expires in ~1hr and is never refreshed. Connect the account in /admin/credentials for access that renews itself.");
    return new GoogleCalendarApiService(async () => token, calendarId);
  }
  return new MockGoogleCalendarService();
}

export async function buildSpotifyService(configuration: ReturnType<typeof getServiceConfiguration>): Promise<SpotifyService> {
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

/**
 * Tasks reuse the calendar's Google connection rather than carrying credentials
 * of their own, so connecting the account once covers both. Without that
 * connection there is nothing to read and the mock stays in place.
 */
async function buildTasksService(configuration: ReturnType<typeof getServiceConfiguration>): Promise<TasksRemindersService> {
  const credentials = await readServiceCredentials();
  if (!credentials.googleRefreshToken) return new MockTasksRemindersService();
  return new GoogleTasksApiService((options) => getGoogleAccessToken(options), configuration.googleTasks.lists);
}

export const buildDashboardServices = async (): Promise<DashboardServices> => {
  const configuration = getServiceConfiguration();
  // ICS feeds win when configured: they cover the same calendars without the
  // OAuth token lifecycle, and running both backends at once would list the
  // same meeting twice (provider ids differ, so they cannot be deduped).
  const usingIcalFeeds = configuration.icalCalendar.feedUrls.length > 0;
  return {
    weather: new OpenMeteoApiService(configuration.weather.location, configuration.weather.latitude, configuration.weather.longitude),
    googleCalendar: usingIcalFeeds ? new EmptyCalendarService() : await buildGoogleCalendarService(configuration),
    icalCalendar: usingIcalFeeds ? new IcalCalendarApiService(configuration.icalCalendar.feedUrls) : new EmptyCalendarService(),
    appleCalendar: new MockAppleCalendarService(),
    spotify: await buildSpotifyService(configuration),
    tasks: await buildTasksService(configuration),
    codexUsage: new MockCodexUsageService(),
    claudeCodeUsage: new MockClaudeCodeUsageService(),
    coolify: configuration.coolify.url ? new CoolifyApiService(configuration.coolify.url, configuration.coolify.token) : new MockCoolifyService(),
  };
};

// Kept for anything still constructing services synchronously (e.g. ad hoc scripts);
// the real dashboard route always awaits buildDashboardServices() instead so the
// OAuth-backed calendar is available.
export const mockDashboardServices = (): DashboardServices => { const configuration = getServiceConfiguration(); return { weather: new OpenMeteoApiService(configuration.weather.location, configuration.weather.latitude, configuration.weather.longitude), googleCalendar: configuration.googleCalendar.accessToken ? new GoogleCalendarApiService(async () => configuration.googleCalendar.accessToken ?? null, configuration.googleCalendar.calendarId) : new MockGoogleCalendarService(), appleCalendar: new MockAppleCalendarService(), icalCalendar: configuration.icalCalendar.feedUrls.length > 0 ? new IcalCalendarApiService(configuration.icalCalendar.feedUrls) : new EmptyCalendarService(), spotify: configuration.spotify.accessToken ? new SpotifyApiService(async () => configuration.spotify.accessToken ?? null) : new MockSpotifyService(), tasks: new MockTasksRemindersService(), codexUsage: new MockCodexUsageService(), claudeCodeUsage: new MockClaudeCodeUsageService(), coolify: configuration.coolify.url ? new CoolifyApiService(configuration.coolify.url, configuration.coolify.token) : new MockCoolifyService() }; };

export async function getDashboard(services?: DashboardServices): Promise<DashboardData> {
  const resolvedServices = services ?? (await buildDashboardServices());
  return getDashboardWithServices(resolvedServices);
}

async function getDashboardWithServices(services: DashboardServices): Promise<DashboardData> {
  const [weather, googleCalendar, appleCalendar, icalCalendar, spotifyNowPlaying, tasks, codexUsage, claudeCodeUsage, coolify] = await Promise.all([
    withFallback("weather", services.weather.getCurrentWeather(), await new MockWeatherService().getCurrentWeather()),
    // Falls back to an empty schedule rather than mock events: a broken calendar
    // should read as "nothing scheduled", never as invented meetings that look
    // exactly like real ones on the display.
    withFallback("google-calendar", services.googleCalendar.getTodayCalendar(), { date: new Date().toISOString().slice(0, 10), events: [] }, CALENDAR_TIMEOUT_MS),
    withFallback("apple-calendar", services.appleCalendar.getTodayCalendar(), { date: new Date().toISOString().slice(0, 10), events: [] }),
    withFallback("ical-calendar", services.icalCalendar.getTodayCalendar(), { date: new Date().toISOString().slice(0, 10), events: [] }, CALENDAR_TIMEOUT_MS),
    withFallback("spotify", services.spotify.getNowPlaying(), null),
    // CalDAV walks three discovery hops before the first reminder is read, so
    // this shares the calendar's wider budget rather than a single-call one.
    withFallback("tasks", services.tasks.getTasks(), [], CALENDAR_TIMEOUT_MS),
    withFallback("codex-usage", services.codexUsage.getUsage(), { usedPercent: 0, period: "weekly" as const, resetsAt: new Date().toISOString() }),
    withFallback("claude-code-usage", services.claudeCodeUsage.getUsage(), { usedPercent: 0, period: "weekly" as const, resetsAt: new Date().toISOString() }),
    withFallback("coolify", services.coolify.getStatus(), { status: "unknown", version: null, checkedAt: new Date().toISOString() }),
  ]);
  const events = [...googleCalendar.events, ...appleCalendar.events, ...icalCalendar.events].sort((a, b) => a.startAt.localeCompare(b.startAt));
  const todaysCalendar = { date: googleCalendar.date, events };
  const now = Date.now();
  // All-day entries — holidays, birthdays, out-of-office — are not something to
  // count down to, and one running for the whole day would otherwise sit in this
  // slot and hide the actual next meeting. They still appear in the schedule.
  const nextEvent = events.find((event) => !event.allDay && new Date(event.endAt).getTime() > now);
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
