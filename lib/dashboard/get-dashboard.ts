import { CoolifyApiService, GoogleCalendarApiService, MockAppleCalendarService, MockClaudeCodeUsageService, MockCodexUsageService, MockCoolifyService, MockGoogleCalendarService, MockSpotifyService, MockTasksRemindersService, MockWeatherService, OpenWeatherApiService, SpotifyApiService, type AppleCalendarService, type ClaudeCodeUsageService, type CodexUsageService, type CoolifyService, type GoogleCalendarService, type SpotifyService, type TasksRemindersService, type WeatherService } from "@/lib/services";
import type { DashboardData } from "./types";

export type DashboardServices = { weather: WeatherService; googleCalendar: GoogleCalendarService; appleCalendar: AppleCalendarService; spotify: SpotifyService; tasks: TasksRemindersService; codexUsage: CodexUsageService; claudeCodeUsage: ClaudeCodeUsageService; coolify: CoolifyService };

export const mockDashboardServices = (): DashboardServices => ({ weather: process.env.OPENWEATHER_API_KEY ? new OpenWeatherApiService(process.env.OPENWEATHER_API_KEY, process.env.WEATHER_LOCATION ?? "Lisbon") : new MockWeatherService(), googleCalendar: process.env.GOOGLE_CALENDAR_ACCESS_TOKEN ? new GoogleCalendarApiService(process.env.GOOGLE_CALENDAR_ACCESS_TOKEN, process.env.GOOGLE_CALENDAR_ID ?? "primary") : new MockGoogleCalendarService(), appleCalendar: new MockAppleCalendarService(), spotify: process.env.SPOTIFY_ACCESS_TOKEN ? new SpotifyApiService(process.env.SPOTIFY_ACCESS_TOKEN) : new MockSpotifyService(), tasks: new MockTasksRemindersService(), codexUsage: new MockCodexUsageService(), claudeCodeUsage: new MockClaudeCodeUsageService(), coolify: process.env.COOLIFY_URL ? new CoolifyApiService(process.env.COOLIFY_URL, process.env.COOLIFY_TOKEN) : new MockCoolifyService() });

export async function getDashboard(services: DashboardServices = mockDashboardServices()): Promise<DashboardData> {
  const [weather, googleCalendar, appleCalendar, spotifyNowPlaying, tasks, codexUsage, claudeCodeUsage, coolify] = await Promise.all([
    services.weather.getCurrentWeather(), services.googleCalendar.getTodayCalendar(), services.appleCalendar.getTodayCalendar(), services.spotify.getNowPlaying(), services.tasks.getTasks(), services.codexUsage.getUsage(), services.claudeCodeUsage.getUsage(), services.coolify.getStatus(),
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
