import type { CalendarEvent, TodayCalendar } from "@/lib/dashboard/types";
export interface GoogleCalendarService { getTodayCalendar(): Promise<TodayCalendar>; }
export class MockGoogleCalendarService implements GoogleCalendarService {
  constructor(private readonly now = new Date()) {}
  async getTodayCalendar(): Promise<TodayCalendar> { const start = (minutes: number) => new Date(this.now.getTime() + minutes * 60000).toISOString(); const events: CalendarEvent[] = [{ id: "event-design-review", title: "Sportsbook Design Review", startAt: start(48), endAt: start(78), location: "Google Meet" }, { id: "event-personal", title: "Personal", startAt: start(108), endAt: start(138), location: null }, { id: "event-prototype", title: "Review prototype", startAt: start(198), endAt: start(258), location: null }]; return { date: this.now.toISOString().slice(0, 10), events }; }
}

type GoogleCalendarResponse = { items?: Array<{ id?: string; summary?: string; start?: { dateTime?: string; date?: string }; end?: { dateTime?: string; date?: string }; location?: string }> };

/** OAuth-ready adapter. Token acquisition is intentionally outside this module. */
export class GoogleCalendarApiService implements GoogleCalendarService {
  constructor(private readonly accessToken: string, private readonly calendarId = "primary") {}

  async getTodayCalendar(): Promise<TodayCalendar> {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end = new Date(start); end.setDate(end.getDate() + 1);
    const params = new URLSearchParams({ calendarId: this.calendarId, timeMin: start.toISOString(), timeMax: end.toISOString(), singleEvents: "true", orderBy: "startTime", maxResults: "20" });
    const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(this.calendarId)}/events?${params}`, { headers: { Authorization: `Bearer ${this.accessToken}` }, cache: "no-store" });
    if (!response.ok) throw new Error(`Google Calendar request failed (${response.status})`);
    const payload = await response.json() as GoogleCalendarResponse;
    const events: CalendarEvent[] = (payload.items ?? []).flatMap((event) => {
      const startAt = event.start?.dateTime ?? (event.start?.date ? `${event.start.date}T00:00:00.000Z` : null);
      const endAt = event.end?.dateTime ?? (event.end?.date ? `${event.end.date}T23:59:59.000Z` : null);
      return startAt && endAt ? [{ id: event.id ?? crypto.randomUUID(), title: event.summary ?? "Untitled event", startAt, endAt, location: event.location ?? null }] : [];
    });
    return { date: start.toISOString().slice(0, 10), events };
  }
}
