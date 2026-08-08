import { CoolifyApiService, getServiceConfiguration, GoogleCalendarApiService, MockAppleCalendarService, MockClaudeCodeUsageService, MockCodexUsageService, MockCoolifyService, MockGoogleCalendarService, MockSpotifyService, MockTasksRemindersService, MockWeatherService, OpenWeatherApiService, SpotifyApiService, type AppleCalendarService, type ClaudeCodeUsageService, type CodexUsageService, type CoolifyService, type GoogleCalendarService, type SpotifyService, type TasksRemindersService, type WeatherService } from "@/lib/services";
import type { DashboardData } from "./types";

export type DashboardServices = { weather: WeatherService; googleCalendar: GoogleCalendarService; appleCalendar: AppleCalendarService; spotify: SpotifyService; tasks: TasksRemindersService; codexUsage: CodexUsageService; claudeCodeUsage: ClaudeCodeUsageService; coolify: CoolifyService };

async function withFallback<T>(operation: Promise<T>, fallback: T, timeoutMs = 6000): Promise<T> {
  try { return await Promise.race([operation, new Promise<T>((_, reject) => setTimeout(() => reject(new Error("Service timeout")), timeoutMs))]); } catch { return fallback; }
}

export const mockDashboardServices = (): DashboardServices => { const configuration = getServiceConfiguration(); return { weather: configuration.weather.apiKey ? new OpenWeatherApiService(configuration.weather.apiKey, configuration.weather.location) : new MockWeatherService(), googleCalendar: configuration.googleCalendar.accessToken ? new GoogleCalendarApiService(configuration.googleCalendar.accessToken, configuration.googleCalendar.calendarId) : new MockGoogleCalendarService(), appleCalendar: new MockAppleCalendarService(), spotify: configuration.spotify.accessToken ? new SpotifyApiService(configuration.spotify.accessToken) : new MockSpotifyService(), tasks: new MockTasksRemindersService(), codexUsage: new MockCodexUsageService(), claudeCodeUsage: new MockClaudeCodeUsageService(), coolify: configuration.coolify.url ? new CoolifyApiService(configuration.coolify.url, configuration.coolify.token) : new MockCoolifyService() }; };

export async function getDashboard(services: DashboardServices = mockDashboardServices()): Promise<DashboardData> {
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
