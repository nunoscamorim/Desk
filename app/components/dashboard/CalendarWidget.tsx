import type { CalendarEvent, TodayCalendar } from "@/lib/dashboard/types";
import type { CSSProperties } from "react";
import { formatTime } from "./utils";

function CalendarItem({ event, showLocations, index }: { event: CalendarEvent; showLocations: boolean; index: number }) {
  const colors = ["#b8d86b", "#c4a9ff", "#ff9b64", "#7ed9e8"];
  return <li className="calendar-item" style={{ "--event-color": colors[index % colors.length] } as CSSProperties}><time dateTime={event.startAt}>{formatTime(event.startAt)}</time><span className="event-line" /><div><strong>{event.title}</strong>{showLocations && <span>{event.location ?? `${formatTime(event.startAt)}–${formatTime(event.endAt)}`}</span>}</div></li>;
}

export function CalendarWidget({ calendar, settings }: { calendar: TodayCalendar; settings?: { showLocations?: boolean; strictDate?: boolean; dateLabel?: string } }) {
  const showLocations = settings?.showLocations ?? true;
  const now = Date.now();
  const horizon = now + 8 * 60 * 60 * 1000;
  const upcoming = calendar.events.filter((event) => new Date(event.endAt).getTime() > now && new Date(event.startAt).getTime() < horizon);
  const nextEvent = calendar.events.find((event) => new Date(event.endAt).getTime() > now);
  const visibleDate = settings?.strictDate ? calendar.date : upcoming.length ? upcoming[0].startAt.slice(0, 10) : nextEvent?.startAt.slice(0, 10);
  const visibleEvents = settings?.strictDate ? calendar.events.filter((event) => event.startAt.slice(0, 10) === calendar.date && new Date(event.endAt).getTime() > now) : visibleDate ? (upcoming.length ? upcoming : calendar.events.filter((event) => event.startAt.slice(0, 10) === visibleDate && new Date(event.endAt).getTime() > now)) : [];
  const heading = settings?.dateLabel ?? (visibleDate === calendar.date ? "Today" : visibleDate ? new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" }).format(new Date(`${visibleDate}T12:00:00`)) : "Schedule");
  return <article className="card calendar-card"><div className="calendar-heading"><div><span className="card-label">{settings?.strictDate ? "Schedule" : "Schedule · next 8h"}</span><h2>{heading}</h2></div><span className="event-count">{visibleEvents.length}<small>events</small></span></div>{visibleEvents.length ? <ol className="calendar-list">{visibleEvents.slice(0, 8).map((event, index) => <CalendarItem key={event.id} event={event} index={index} showLocations={showLocations} />)}</ol> : <div className="empty-state">Nothing scheduled.</div>}</article>;
}
