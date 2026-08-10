import { fetchWithRetry } from "@/lib/http/fetch-with-retry";
import type { CalendarEvent, TodayCalendar } from "@/lib/dashboard/types";
export interface GoogleCalendarService { getTodayCalendar(): Promise<TodayCalendar>; }
export class MockGoogleCalendarService implements GoogleCalendarService {
  constructor(private readonly now = new Date()) {}
  async getTodayCalendar(): Promise<TodayCalendar> { const start = (minutes: number) => new Date(this.now.getTime() + minutes * 60000).toISOString(); const events: CalendarEvent[] = [{ id: "event-design-review", title: "Sportsbook Design Review", startAt: start(48), endAt: start(78), location: "Google Meet" }, { id: "event-personal", title: "Personal", startAt: start(108), endAt: start(138), location: null }, { id: "event-prototype", title: "Review prototype", startAt: start(198), endAt: start(258), location: null }]; return { date: this.now.toISOString().slice(0, 10), events }; }
}

type GoogleCalendarResponse = { items?: Array<{ id?: string; summary?: string; start?: { dateTime?: string; date?: string }; end?: { dateTime?: string; date?: string }; location?: string }> };

const REQUEST_TIMEOUT_MS = 6000;
// Two calendar fetches can happen in one call when a 401 forces a token
// re-mint, so each gets half of the wider budget the caller allows.
const REQUEST_BUDGET_MS = 9000;

/**
 * Token acquisition lives in google-oauth.ts, not here: `getAccessToken` is called
 * fresh on every request rather than holding a single token, since access tokens
 * expire in about an hour and the caller (get-dashboard.ts) may run this minutes
 * or hours apart. Returning null from the provider (OAuth not configured yet)
 * is treated the same as any other failure — the caller falls back to the mock.
 */
export class GoogleCalendarApiService implements GoogleCalendarService {
  constructor(private readonly getAccessToken: (options?: { forceRefresh?: boolean }) => Promise<string | null>, private readonly calendarId = "primary") {}

  async getTodayCalendar(): Promise<TodayCalendar> {
    const accessToken = await this.getAccessToken();
    if (!accessToken) throw new Error("Google Calendar is not connected");
    const start = new Date(); start.setHours(0, 0, 0, 0);
    // Load the upcoming week so the dashboard can show the next meeting even
    // when there is nothing scheduled today.
    const end = new Date(start); end.setDate(end.getDate() + 7);
    const params = new URLSearchParams({ calendarId: this.calendarId, timeMin: start.toISOString(), timeMax: end.toISOString(), singleEvents: "true", orderBy: "startTime", maxResults: "50" });
    const request = (token: string) => fetchWithRetry(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(this.calendarId)}/events?${params}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }, { label: "google-calendar", timeoutMs: REQUEST_TIMEOUT_MS, budgetMs: REQUEST_BUDGET_MS });

    let response = await request(accessToken);
    // A 401 means the token is dead regardless of what its cached expiry says.
    // Mint a fresh one and retry once, so the display recovers on the next poll
    // instead of staying broken until the process restarts.
    if (response.status === 401) {
      const refreshed = await this.getAccessToken({ forceRefresh: true });
      if (!refreshed) throw new Error("Google Calendar is not connected");
      response = await request(refreshed);
    }
    if (!response.ok) throw new Error(`Google Calendar request failed (${response.status})`);
    const payload = await response.json() as GoogleCalendarResponse;
    const events: CalendarEvent[] = (payload.items ?? []).flatMap((event) => {
      // Google signals an all-day event by sending `date` instead of `dateTime`.
      const allDay = !event.start?.dateTime && Boolean(event.start?.date);
      const startAt = event.start?.dateTime ?? (event.start?.date ? `${event.start.date}T00:00:00.000Z` : null);
      const endAt = event.end?.dateTime ?? (event.end?.date ? `${event.end.date}T23:59:59.000Z` : null);
      return startAt && endAt ? [{ id: event.id ?? crypto.randomUUID(), title: event.summary ?? "Untitled event", startAt, endAt, location: event.location ?? null, allDay }] : [];
    });
    return { date: start.toISOString().slice(0, 10), events };
  }
}
