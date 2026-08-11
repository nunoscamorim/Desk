import type { DashboardData } from "@/lib/dashboard/types";
import { useEffect, useState } from "react";
import { formatDuration, formatTime } from "./utils";

export function NextMeetingWidget({ meeting }: { meeting: DashboardData["nextMeeting"] }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  // Counts down in minutes and seconds near the meeting, switching to a compact
  // hour-and-minute form once the wait reaches an hour.
  const countdownMs = meeting ? Math.max(0, new Date(meeting.startAt).getTime() - now) : 0;
  const countdown = meeting ? formatDuration(countdownMs) : "0:00";
  const longCountdown = countdownMs >= 60 * 60 * 1000;
  const meetingDay = meeting ? new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" }).format(new Date(meeting.startAt)) : "";
  return <article className="card next-card">{meeting ? <>
    <header className="meeting-header"><span className="meeting-kicker"><span className="meeting-live-dot" />Up next</span><time dateTime={meeting.startAt}>{formatTime(meeting.startAt)}</time></header>
    <div className="meeting-countdown"><strong>{countdown}</strong><span>{longCountdown ? "hours" : "min:sec"}<small>until start</small></span></div>
    <div className="meeting-copy"><h2>{meeting.title}</h2><p>{meeting.location ?? "No location"}</p></div>
    <footer className="meeting-footer"><span className="meeting-rail"><i /></span><span>{meetingDay}</span></footer>
  </> : <><span className="meeting-kicker">Up next</span><div className="meeting-empty"><strong>Clear runway</strong><span>No upcoming meetings</span></div></>}</article>;
}
