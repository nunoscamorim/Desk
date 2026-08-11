export type Weather = {
  location: string;
  temperatureC: number;
  feelsLikeC: number;
  condition: string;
  highC: number;
  lowC: number;
};

export type CalendarEvent = {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  location: string | null;
  /**
   * All-day and multi-day events. Flagged at the source, where the distinction
   * is still visible, because both kinds are flattened to the same timestamps
   * afterwards and a midnight-to-midnight span cannot be told apart by shape.
   */
  allDay?: boolean;
};

export type Meeting = CalendarEvent & {
  minutesUntil: number;
};

export type TodayCalendar = {
  date: string;
  events: CalendarEvent[];
};

export type SpotifyNowPlaying = {
  isPlaying: boolean;
  track: string;
  artist: string;
  album: string;
  progressMs: number;
  durationMs: number;
  artworkUrl: string | null;
};

export type SpotifyRecentTrack = {
  id: string;
  track: string;
  artist: string;
  artworkUrl: string | null;
  playedAt: string;
};

export type Task = {
  id: string;
  title: string;
  status: "todo" | "in_progress" | "done";
  /** Omitted by sources that have no concept of priority, such as Google Tasks. */
  priority?: "low" | "medium" | "high";
  dueAt: string | null;
  project: string | null;
};

export type AiUsage = {
  usedPercent: number;
  period: "daily" | "weekly" | "monthly";
  resetsAt: string;
};

export type DashboardData = {
  generatedAt: string;
  weather: Weather;
  nextMeeting: Meeting | null;
  todaysCalendar: TodayCalendar;
  spotifyNowPlaying: SpotifyNowPlaying | null;
  spotifyRecentlyPlayed: SpotifyRecentTrack[];
  tasks: Task[];
  codexUsage: AiUsage;
  claudeCodeUsage: AiUsage;
  coolify: { status: "online" | "offline" | "unknown"; version: string | null; checkedAt: string };
};

export interface DashboardProvider {
  getWeather(): Promise<Weather>;
  getNextMeeting(): Promise<Meeting | null>;
  getTodayCalendar(): Promise<TodayCalendar>;
  getSpotifyNowPlaying(): Promise<SpotifyNowPlaying | null>;
  getSpotifyRecentlyPlayed(): Promise<SpotifyRecentTrack[]>;
  getTasks(): Promise<Task[]>;
  getCodexUsage(): Promise<AiUsage>;
  getClaudeCodeUsage(): Promise<AiUsage>;
}
