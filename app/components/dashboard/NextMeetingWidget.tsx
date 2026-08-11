import type { DashboardData } from "@/lib/dashboard/types";
import { useEffect, useState } from "react";
import { formatDuration, formatTime } from "./utils";

export function NextMeetingWidget({ meeting }: { meeting: DashboardData["nextMeeting"] }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  // Counts down in minutes and seconds near the meeting, switching to a compact
  // hour-and-minute form once the wait reaches an hour.
  const countdownMs = meeting ? Math.max(0, new Date(meeting.startAt).getTime() - now) : 0;
  const longCountdown = countdownMs >= 60 * 60 * 1000;
  const countdown = meeting
    ? longCountdown
      ? (() => { const totalSeconds = Math.floor(countdownMs / 1_000); const hours = Math.floor(totalSeconds / 3_600); const minutes = Math.floor((totalSeconds % 3_600) / 60); const seconds = totalSeconds % 60; return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`; })()
      : formatDuration(countdownMs)
    : "0:00";
  const meetingDay = meeting ? new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" }).format(new Date(meeting.startAt)) : "";
  return <article className="card next-card">{meeting ? <>
    <header className="meeting-header"><span className="meeting-kicker"><span className="meeting-live-dot" />Up next</span><time dateTime={meeting.startAt}>{formatTime(meeting.startAt)}</time></header>
    <div className="meeting-countdown"><strong>{countdown}</strong><span>{longCountdown ? "time" : "min:sec"}<small>until start</small></span></div>
    <div className="meeting-copy"><h2>{meeting.title}</h2><p>{meeting.location ?? "No location"}</p></div>
    <footer className="meeting-footer"><span className="meeting-rail"><i /></span><span>{meetingDay}</span></footer>
  </> : <><span className="meeting-kicker">Up next</span><div className="meeting-empty"><strong>Clear runway</strong><span>No upcoming meetings</span></div></>}</article>;
}
