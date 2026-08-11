import type { CalendarEvent, TodayCalendar } from "@/lib/dashboard/types";
import { useEffect, useState, type CSSProperties } from "react";
import { formatTime } from "./utils";

function CalendarItem({ event, showLocations, index }: { event: CalendarEvent; showLocations: boolean; index: number }) {
  const colors = ["#b8d86b", "#c4a9ff", "#ff9b64", "#7ed9e8"];
  // An all-day event has no meaningful clock time. It is carried as a
  // midnight-to-midnight UTC span, so formatting it would show the reader's
  // offset from UTC — "01:00 – 00:59" for anyone an hour ahead — rather than
  // anything about the event.
  // Null for an all-day event with no location: the time column already says
  // "All day", and repeating it underneath the title tells the reader nothing.
  const detail = event.location ?? (event.allDay ? null : `${formatTime(event.startAt)}–${formatTime(event.endAt)}`);
  return <li className={`calendar-item ${event.allDay ? "all-day-item" : ""}`} style={{ "--event-color": colors[index % colors.length] } as CSSProperties}><time dateTime={event.allDay ? event.startAt.slice(0, 10) : event.startAt}>{event.allDay ? "All day" : formatTime(event.startAt)}</time><span className="event-line" /><div><strong>{event.title}</strong>{showLocations && detail && <span>{detail}</span>}</div></li>;
}

/** The date key `offset` days after `calendar.date`, as "YYYY-MM-DD". */
function dayKey(date: string, offset: number) {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

export function CalendarWidget({ calendar, settings }: { calendar: TodayCalendar; settings?: { showLocations?: boolean; strictDate?: boolean; dateLabel?: string } }) {
  const showLocations = settings?.showLocations ?? true;
  // Ticking rather than reading the clock during render keeps the component
  // deterministic, and means finished events drop out on their own instead of
  // lingering until the next dashboard refresh. Half a minute is granular
  // enough for filtering by end time.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 30000); return () => window.clearInterval(timer); }, []);
  const stillOn = (event: CalendarEvent) => new Date(event.endAt).getTime() > now;

  let visibleEvents: CalendarEvent[];
  let heading: string;
  let label: string;
  if (settings?.strictDate) {
    // The calendar screen pins one date per card and keeps its all-day items.
    visibleEvents = calendar.events.filter((event) => event.startAt.slice(0, 10) === calendar.date && stillOn(event));
    heading = settings.dateLabel ?? new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" }).format(new Date(`${calendar.date}T12:00:00`));
    label = "Schedule";
  } else {
    // The schedule widget is day-based and ignores all-day events: it shows
    // today's timed events until the last one of the day has ended, then it
    // flips its heading to "Tomorrow" and shows the next day instead.
    const timedEvents = calendar.events.filter((event) => !event.allDay);
    const today = calendar.date;
    const tomorrow = dayKey(today, 1);
    const todaysEvents = timedEvents.filter((event) => event.startAt.slice(0, 10) === today && stillOn(event));
    const tomorrowsEvents = timedEvents.filter((event) => event.startAt.slice(0, 10) === tomorrow);
    const showingTomorrow = todaysEvents.length === 0;
    visibleEvents = showingTomorrow ? tomorrowsEvents : todaysEvents;
    heading = showingTomorrow ? "Tomorrow" : "Today";
    label = showingTomorrow ? "Schedule · tomorrow" : "Schedule · today";
  }
  return <article className="card calendar-card"><div className="calendar-heading"><div><span className="card-label">{label}</span><h2>{heading}</h2></div><span className="event-count">{visibleEvents.length}<small>events</small></span></div>{visibleEvents.length ? <ol className="calendar-list" tabIndex={0} aria-label={`${heading} events`}>{visibleEvents.map((event, index) => <CalendarItem key={event.id} event={event} index={index} showLocations={showLocations} />)}</ol> : <div className="empty-state">Nothing scheduled.</div>}</article>;
}
