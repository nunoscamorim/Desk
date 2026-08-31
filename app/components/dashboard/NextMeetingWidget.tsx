import type { DashboardData } from "@/lib/dashboard/types";
import { useEffect, useState } from "react";
import { formatDuration, formatTime } from "./utils";

/**
 * How close is close enough to stop being a countdown and start being a warning.
 * Five minutes is the last point the number is still actionable — long enough to
 * stand up and walk, short enough that it means now.
 */
const IMMINENT_MS = 5 * 60 * 1000;

export function NextMeetingWidget({ meeting }: { meeting: DashboardData["nextMeeting"] }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  // Counts down in minutes and seconds near the meeting, switching to a compact
  // hour-and-minute form once the wait reaches an hour.
  const countdownMs = meeting ? Math.max(0, new Date(meeting.startAt).getTime() - now) : 0;
  const longCountdown = countdownMs >= 60 * 60 * 1000;
  const countdown = meeting
    ? longCountdown
      // Seconds are dropped past the hour: they tick a digit nobody is waiting on,
      // and a number that changes every second reads as urgent when it is not.
      // Floored rather than rounded, so the figure is time you still have.
      ? (() => { const totalMinutes = Math.floor(countdownMs / 60_000); return `${String(Math.floor(totalMinutes / 60)).padStart(2, "0")}:${String(totalMinutes % 60).padStart(2, "0")}`; })()
      : formatDuration(countdownMs)
    : "0:00";
  // Held for the whole window rather than only while it counts down: a meeting
  // that has started clamps to 0:00 until the next refresh drops it, and that is
  // exactly when the card should be loudest.
  const imminent = Boolean(meeting) && countdownMs <= IMMINENT_MS;
  const meetingDay = meeting ? new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" }).format(new Date(meeting.startAt)) : "";
  return <article className={`card next-card${imminent ? " is-imminent" : ""}`}>{meeting ? <>
    <header className="meeting-header"><span className="meeting-kicker"><span className="meeting-live-dot" />Up next</span><time dateTime={meeting.startAt}>{formatTime(meeting.startAt)}</time></header>
    <div className="meeting-countdown"><strong>{countdown}</strong><span>{longCountdown ? "hr:min" : "min:sec"}<small>until start</small></span></div>
    <div className="meeting-copy"><h2>{meeting.title}</h2><p>{meeting.location ?? "No location"}</p></div>
    <footer className="meeting-footer"><span className="meeting-rail"><i /></span><span>{meetingDay}</span></footer>
  </> : <><span className="meeting-kicker">Up next</span><div className="meeting-empty"><strong>Clear runway</strong><span>No upcoming meetings</span></div></>}</article>;
}
