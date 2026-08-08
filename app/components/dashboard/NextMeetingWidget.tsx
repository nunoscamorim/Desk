import type { DashboardData } from "@/lib/dashboard/types";
import { useEffect, useState } from "react";
import { formatTime } from "./utils";

export function NextMeetingWidget({ meeting }: { meeting: DashboardData["nextMeeting"] }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  const minutesUntil = meeting ? Math.max(0, Math.ceil((new Date(meeting.startAt).getTime() - now) / 60000)) : 0;
  return <article className="card next-card"><span className="card-label">Next meeting</span>{meeting ? <>
    <div className="meeting-time"><span>in</span><strong>{minutesUntil}</strong><span>min</span></div>
    <h2>{meeting.title}</h2><p>{formatTime(meeting.startAt)} · {meeting.location ?? "No location"}</p>
  </> : <div className="empty-state">Your calendar is clear.</div>}</article>;
}
