import ical, { type CalendarComponent, type VEvent } from "node-ical";
import type { CalendarEvent, TodayCalendar } from "@/lib/dashboard/types";

export interface IcalCalendarService { getTodayCalendar(): Promise<TodayCalendar>; }

/**
 * Calendar backed by plain iCalendar (.ics) feed URLs.
 *
 * This is the low-maintenance alternative to the OAuth calendar backends: a
 * feed URL is a bearer secret that never expires and needs no refresh, so there
 * is no token cache, no stored credentials, and nothing that can go stale after
 * an hour. Any number of feeds can be supplied — iCloud, Google and Outlook all
 * publish this format — and their events are merged into one timeline, which is
 * how a mixed work/personal setup ends up on a single display.
 *
 * Each feed is fetched and parsed independently: one unreachable or malformed
 * feed drops out of the merge rather than taking the whole calendar down with
 * it.
 */

const FEED_TIMEOUT_MS = 5000;
// Feeds are re-fetched no more than once a minute. Upstream providers cache
// these aggressively anyway, so polling harder costs bandwidth and parse time
// without buying fresher data.
const CACHE_TTL_MS = 60000;

const cache = new Map<string, { expiresAt: number; events: CalendarEvent[] }>();

const isVEvent = (component: CalendarComponent | undefined): component is VEvent => component?.type === "VEVENT";

/**
 * ICS properties that carry parameters (`SUMMARY;LANGUAGE=en:Standup`) parse to
 * a `{ val, params }` object rather than a bare string, so both shapes have to
 * be unwrapped or the title renders as "[object Object]".
 */
function text(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "val" in value) {
    const inner = (value as { val: unknown }).val;
    return typeof inner === "string" ? inner : undefined;
  }
  return undefined;
}

/** ICS DATE values are floating all-day dates; node-ical tags them with `dateOnly`. */
const isAllDay = (event: { datetype?: string }) => event.datetype === "date";

function allDayBounds(start: Date, end: Date) {
  const day = start.toISOString().slice(0, 10);
  // DTEND is exclusive for all-day events, so the last covered day is the one
  // before it. Collapse to a single inclusive day range for display.
  const lastDay = new Date(Math.max(start.getTime(), end.getTime() - 1)).toISOString().slice(0, 10);
  return { startAt: `${day}T00:00:00.000Z`, endAt: `${lastDay}T23:59:59.000Z` };
}

function toCalendarEvent(source: Pick<VEvent, "uid" | "summary" | "location" | "datetype">, start: Date, end: Date, suffix = ""): CalendarEvent {
  const bounds = isAllDay(source) ? allDayBounds(start, end) : { startAt: start.toISOString(), endAt: end.toISOString() };
  return {
    id: `${text(source.uid) ?? crypto.randomUUID()}${suffix}`,
    title: text(source.summary) ?? "Untitled event",
    startAt: bounds.startAt,
    endAt: bounds.endAt,
    location: text(source.location) ?? null,
  };
}

/**
 * Expands one VEVENT into every occurrence that overlaps [windowStart, windowEnd).
 *
 * Recurring events need three separate pieces of RFC 5545 honored or the
 * dashboard shows meetings that are not real: RRULE generates the occurrences,
 * EXDATE removes cancelled ones (`between()` still returns those), and
 * RECURRENCE-ID overrides replace an occurrence's time or title.
 */
function expandEvent(event: VEvent, windowStart: Date, windowEnd: Date): CalendarEvent[] {
  const start = event.start as Date | undefined;
  const end = (event.end as Date | undefined) ?? start;
  if (!start || !end) return [];

  if (!event.rrule) {
    return end.getTime() > windowStart.getTime() && start.getTime() < windowEnd.getTime() ? [toCalendarEvent(event, start, end)] : [];
  }

  const durationMs = Math.max(0, end.getTime() - start.getTime());
  // Widen the query by the event duration so a meeting that started before the
  // window but is still running is not missed.
  const occurrences = event.rrule.between(new Date(windowStart.getTime() - durationMs), windowEnd, true) as Date[];
  const exdate = (event.exdate ?? {}) as Record<string, unknown>;
  const recurrences = (event.recurrences ?? {}) as Record<string, VEvent>;

  return occurrences.flatMap((occurrence) => {
    const iso = occurrence.toISOString();
    const dayKey = iso.slice(0, 10);
    // node-ical keys both maps by full ISO timestamp and by date alone.
    if (exdate[iso] || exdate[dayKey]) return [];

    const override = recurrences[iso] ?? recurrences[dayKey];
    if (override) {
      const overrideStart = override.start as Date | undefined;
      const overrideEnd = (override.end as Date | undefined) ?? overrideStart;
      if (!overrideStart || !overrideEnd) return [];
      return overrideEnd.getTime() > windowStart.getTime() && overrideStart.getTime() < windowEnd.getTime() ? [toCalendarEvent(override, overrideStart, overrideEnd, `-${iso}`)] : [];
    }

    const occurrenceEnd = new Date(occurrence.getTime() + durationMs);
    return occurrenceEnd.getTime() > windowStart.getTime() && occurrence.getTime() < windowEnd.getTime() ? [toCalendarEvent(event, occurrence, occurrenceEnd, `-${iso}`)] : [];
  });
}

async function loadFeed(url: string, windowStart: Date, windowEnd: Date): Promise<CalendarEvent[]> {
  const cached = cache.get(url);
  if (cached && cached.expiresAt > Date.now()) return cached.events;

  const response = await fetch(url.replace(/^webcal:\/\//i, "https://"), { signal: AbortSignal.timeout(FEED_TIMEOUT_MS), cache: "no-store" });
  if (!response.ok) throw new Error(`Calendar feed request failed (${response.status})`);
  const parsed = ical.sync.parseICS(await response.text());
  const events = Object.values(parsed).filter(isVEvent).flatMap((event) => expandEvent(event, windowStart, windowEnd));

  cache.set(url, { expiresAt: Date.now() + CACHE_TTL_MS, events });
  return events;
}

export class IcalCalendarApiService implements IcalCalendarService {
  constructor(private readonly feedUrls: string[]) {}

  async getTodayCalendar(): Promise<TodayCalendar> {
    const windowStart = new Date();
    windowStart.setHours(0, 0, 0, 0);
    // Match the other calendar backends: a week of lookahead so the next
    // meeting still resolves when today is empty.
    const windowEnd = new Date(windowStart);
    windowEnd.setDate(windowEnd.getDate() + 7);

    const results = await Promise.allSettled(this.feedUrls.map((url) => loadFeed(url, windowStart, windowEnd)));
    const failures = results.filter((result): result is PromiseRejectedResult => result.status === "rejected");
    if (failures.length === this.feedUrls.length && this.feedUrls.length > 0) {
      throw new Error(`All calendar feeds failed: ${failures.map((failure) => String(failure.reason)).join("; ")}`);
    }
    for (const failure of failures) console.error("[ical] feed failed:", failure.reason);

    const events = results.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
    // Feeds overlap when the same invite lands in both a work and a personal
    // calendar; keep one copy per occurrence.
    const deduped = [...new Map(events.map((event) => [`${event.id}|${event.startAt}`, event])).values()];
    deduped.sort((a, b) => a.startAt.localeCompare(b.startAt));

    return { date: windowStart.toISOString().slice(0, 10), events: deduped };
  }
}

/**
 * Contributes nothing to the merged timeline. Used for whichever calendar
 * backend is inactive — unlike the mock services it returns no invented events,
 * so an unconfigured backend cannot put fictional meetings on the display.
 */
export class EmptyCalendarService implements IcalCalendarService {
  async getTodayCalendar(): Promise<TodayCalendar> { return { date: new Date().toISOString().slice(0, 10), events: [] }; }
}
