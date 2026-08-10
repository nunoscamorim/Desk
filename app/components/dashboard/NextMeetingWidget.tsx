import type { DashboardData } from "@/lib/dashboard/types";
import { useEffect, useState } from "react";
import { formatDuration, formatTime } from "./utils";

export function NextMeetingWidget({ meeting }: { meeting: DashboardData["nextMeeting"] }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  // Counts down in minutes and seconds, so the last minute before a meeting
  // reads as something moving rather than a "1" that sits there.
  const countdown = meeting ? formatDuration(Math.max(0, new Date(meeting.startAt).getTime() - now)) : "0:00";
  const meetingDay = meeting ? new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" }).format(new Date(meeting.startAt)) : "";
  return <article className="card next-card">{meeting ? <>
    <header className="meeting-header"><span className="meeting-kicker"><span className="meeting-live-dot" />Up next</span><time dateTime={meeting.startAt}>{formatTime(meeting.startAt)}</time></header>
    <div className="meeting-countdown"><strong>{countdown}</strong><span>min:sec<small>until start</small></span></div>
    <div className="meeting-copy"><h2>{meeting.title}</h2><p>{meeting.location ?? "No location"}</p></div>
    <footer className="meeting-footer"><span className="meeting-rail"><i /></span><span>{meetingDay}</span></footer>
  </> : <><span className="meeting-kicker">Up next</span><div className="meeting-empty"><strong>Clear runway</strong><span>No upcoming meetings</span></div></>}</article>;
}
