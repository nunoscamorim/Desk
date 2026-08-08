import type { CalendarEvent, TodayCalendar } from "@/lib/dashboard/types";
import { formatTime } from "./utils";

function CalendarItem({ event, showLocations }: { event: CalendarEvent; showLocations: boolean }) {
  return <li className="calendar-item"><time dateTime={event.startAt}>{formatTime(event.startAt)}</time><span className="event-line" /><div><strong>{event.title}</strong>{showLocations && <span>{event.location ?? `${formatTime(event.startAt)}–${formatTime(event.endAt)}`}</span>}</div></li>;
}

export function CalendarWidget({ calendar, settings }: { calendar: TodayCalendar; settings?: { showLocations?: boolean } }) {
  const showLocations = settings?.showLocations ?? true;
  return <article className="card calendar-card"><div className="calendar-heading"><div><span className="card-label">Schedule</span><h2>Today</h2></div><span className="event-count">{calendar.events.length}<small>events</small></span></div>{calendar.events.length ? <ol className="calendar-list">{calendar.events.slice(0, 3).map((event) => <CalendarItem key={event.id} event={event} showLocations={showLocations} />)}</ol> : <div className="empty-state">Nothing scheduled today.</div>}</article>;
}
