import type { CalendarEvent, TodayCalendar } from "@/lib/dashboard/types";
import { formatTime } from "./utils";

function CalendarItem({ event, showLocations }: { event: CalendarEvent; showLocations: boolean }) {
  return <li className="calendar-item"><time dateTime={event.startAt}>{formatTime(event.startAt)}</time><span className="event-line" /><div><strong>{event.title}</strong>{showLocations && <span>{event.location ?? `${formatTime(event.startAt)}–${formatTime(event.endAt)}`}</span>}</div></li>;
}

export function CalendarWidget({ calendar, settings }: { calendar: TodayCalendar; settings?: { showLocations?: boolean } }) {
  const showLocations = settings?.showLocations ?? true;
  const todayEvents = calendar.events.filter((event) => event.startAt.slice(0, 10) === calendar.date);
  const nextDate = calendar.events.find((event) => event.startAt.slice(0, 10) > calendar.date)?.startAt.slice(0, 10);
  const visibleDate = todayEvents.length ? calendar.date : nextDate;
  const visibleEvents = visibleDate ? calendar.events.filter((event) => event.startAt.slice(0, 10) === visibleDate) : [];
  const heading = visibleDate === calendar.date ? "Today" : visibleDate ? new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" }).format(new Date(`${visibleDate}T12:00:00`)) : "Schedule";
  return <article className="card calendar-card"><div className="calendar-heading"><div><span className="card-label">Schedule</span><h2>{heading}</h2></div><span className="event-count">{visibleEvents.length}<small>events</small></span></div>{visibleEvents.length ? <ol className="calendar-list">{visibleEvents.slice(0, 3).map((event) => <CalendarItem key={event.id} event={event} showLocations={showLocations} />)}</ol> : <div className="empty-state">Nothing scheduled.</div>}</article>;
}
