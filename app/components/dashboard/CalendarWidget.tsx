import type { CalendarEvent, TodayCalendar } from "@/lib/dashboard/types";
import { formatTime } from "./utils";

function CalendarItem({ event, showLocations }: { event: CalendarEvent; showLocations: boolean }) {
  return <li className="calendar-item"><time dateTime={event.startAt}>{formatTime(event.startAt)}</time><span className="event-line" /><div><strong>{event.title}</strong>{showLocations && <span>{event.location ?? `${formatTime(event.startAt)}–${formatTime(event.endAt)}`}</span>}</div></li>;
}

export function CalendarWidget({ calendar, settings }: { calendar: TodayCalendar; settings?: { showLocations?: boolean } }) {
  const showLocations = settings?.showLocations ?? true;
  const now = Date.now();
  const horizon = now + 8 * 60 * 60 * 1000;
  const upcoming = calendar.events.filter((event) => new Date(event.endAt).getTime() > now && new Date(event.startAt).getTime() < horizon);
  const nextEvent = calendar.events.find((event) => new Date(event.endAt).getTime() > now);
  const visibleDate = upcoming.length ? upcoming[0].startAt.slice(0, 10) : nextEvent?.startAt.slice(0, 10);
  const visibleEvents = visibleDate ? (upcoming.length ? upcoming : calendar.events.filter((event) => event.startAt.slice(0, 10) === visibleDate && new Date(event.endAt).getTime() > now)) : [];
  const heading = visibleDate === calendar.date ? "Today" : visibleDate ? new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" }).format(new Date(`${visibleDate}T12:00:00`)) : "Schedule";
  return <article className="card calendar-card"><div className="calendar-heading"><div><span className="card-label">Schedule · next 8h</span><h2>{heading}</h2></div><span className="event-count">{visibleEvents.length}<small>events</small></span></div>{visibleEvents.length ? <ol className="calendar-list">{visibleEvents.slice(0, 8).map((event) => <CalendarItem key={event.id} event={event} showLocations={showLocations} />)}</ol> : <div className="empty-state">Nothing scheduled.</div>}</article>;
}
