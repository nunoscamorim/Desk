import type {
  AiUsage,
  CalendarEvent,
  DashboardProvider,
  Meeting,
  SpotifyNowPlaying,
  SpotifyRecentTrack,
  Task,
  TodayCalendar,
  Weather,
} from "./types";

const inMinutes = (date: Date, minutes: number) =>
  new Date(date.getTime() + minutes * 60_000).toISOString();

const dateOnly = (date: Date) => date.toISOString().slice(0, 10);

export class MockDashboardProvider implements DashboardProvider {
  constructor(private readonly now: Date = new Date()) {}

  async getWeather(): Promise<Weather> {
    return {
      location: "Leça do Balio",
      temperatureC: 24,
      feelsLikeC: 25,
      condition: "Sunny",
      highC: 27,
      lowC: 18,
    };
  }

  async getNextMeeting(): Promise<Meeting> {
    return {
      id: "meeting-design-review",
      title: "Sportsbook Design Review",
      startAt: inMinutes(this.now, 48),
      endAt: inMinutes(this.now, 78),
      location: "Google Meet",
      minutesUntil: 48,
    };
  }

  async getTodayCalendar(): Promise<TodayCalendar> {
    const events: CalendarEvent[] = [
      {
        id: "event-design-review",
        title: "Sportsbook Design Review",
        startAt: inMinutes(this.now, 48),
        endAt: inMinutes(this.now, 78),
        location: "Google Meet",
      },
      {
        id: "event-personal",
        title: "Personal",
        startAt: inMinutes(this.now, 108),
        endAt: inMinutes(this.now, 138),
        location: null,
      },
      {
        id: "event-prototype",
        title: "Review prototype",
        startAt: inMinutes(this.now, 198),
        endAt: inMinutes(this.now, 258),
        location: null,
      },
    ];

    return { date: dateOnly(this.now), events };
  }

  async getSpotifyNowPlaying(): Promise<SpotifyNowPlaying> {
    return {
      isPlaying: true,
      track: "Midnight City",
      artist: "M83",
      album: "Hurry Up, We're Dreaming",
      progressMs: 141_000,
      durationMs: 244_000,
      artworkUrl: null,
    };
  }

  async getSpotifyRecentlyPlayed(): Promise<SpotifyRecentTrack[]> {
    return [
      { id: "track-blinding-lights", track: "Blinding Lights", artist: "The Weeknd", artworkUrl: null, playedAt: inMinutes(this.now, -35) },
      { id: "track-electric-feel", track: "Electric Feel", artist: "MGMT", artworkUrl: null, playedAt: inMinutes(this.now, -58) },
      { id: "track-redbone", track: "Redbone", artist: "Childish Gambino", artworkUrl: null, playedAt: inMinutes(this.now, -80) },
      { id: "track-instant-crush", track: "Instant Crush", artist: "Daft Punk ft. Julian Casablancas", artworkUrl: null, playedAt: inMinutes(this.now, -112) },
      { id: "track-nights", track: "Nights", artist: "Frank Ocean", artworkUrl: null, playedAt: inMinutes(this.now, -140) },
      { id: "track-heat-waves", track: "Heat Waves", artist: "Glass Animals", artworkUrl: null, playedAt: inMinutes(this.now, -175) },
    ];
  }

  async getTasks(): Promise<Task[]> {
    return [
      {
        id: "task-dashboard-api",
        title: "Build dashboard API",
        status: "in_progress",
        priority: "high",
        dueAt: inMinutes(this.now, 240),
        project: "Desk Dashboard",
      },
      {
        id: "task-review-prototype",
        title: "Review dashboard prototype",
        status: "todo",
        priority: "medium",
        dueAt: inMinutes(this.now, 1_440),
        project: "Desk Dashboard",
      },
      {
        id: "task-submit-expenses",
        title: "Submit monthly expenses",
        status: "todo",
        priority: "low",
        dueAt: null,
        project: "Admin",
      },
    ];
  }

  async getCodexUsage(): Promise<AiUsage> {
    return {
      usedPercent: 74,
      period: "weekly",
      resetsAt: inMinutes(this.now, 2_880),
    };
  }

  async getClaudeCodeUsage(): Promise<AiUsage> {
    return {
      usedPercent: 51,
      period: "weekly",
      resetsAt: inMinutes(this.now, 4_320),
    };
  }
}
