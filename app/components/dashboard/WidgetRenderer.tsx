import { AiUsageWidget } from "@/app/components/dashboard/AiUsageWidget";
import { CalendarWidget } from "@/app/components/dashboard/CalendarWidget";
import { NextMeetingWidget } from "@/app/components/dashboard/NextMeetingWidget";
import { SpotifyWidget } from "@/app/components/dashboard/SpotifyWidget";
import { TasksWidget } from "@/app/components/dashboard/TasksWidget";
import type { DashboardData } from "@/lib/dashboard/types";
import type { WidgetConfig } from "@/lib/dashboard/config";
import type { PointerEvent as ReactPointerEvent } from "react";

export function WidgetRenderer({ widget, data, editable = false, selected = false, onPointerDown, onResizePointerDown }: { widget: WidgetConfig; data: DashboardData; editable?: boolean; selected?: boolean; onPointerDown?: (event: ReactPointerEvent<HTMLDivElement>) => void; onResizePointerDown?: (event: ReactPointerEvent<HTMLButtonElement>) => void }) {
  if (!widget.enabled) return null;
  const style = { left: widget.x, top: widget.y, width: widget.width, height: widget.height };
  const content = widget.type === "meeting" ? <NextMeetingWidget meeting={data.nextMeeting} />
    : widget.type === "calendar" ? <CalendarWidget calendar={data.todaysCalendar} settings={{ showLocations: widget.settings.showLocations !== false }} />
    : widget.type === "music" ? <SpotifyWidget nowPlaying={data.spotifyNowPlaying} />
    : widget.type === "tasks" ? <TasksWidget tasks={data.tasks} />
    : <AiUsageWidget codex={data.codexUsage} claudeCode={data.claudeCodeUsage} />;
  return <div className={`configured-widget configured-${widget.type} ${editable ? "editable-widget" : ""} ${selected ? "selected-widget" : ""}`} style={style} onPointerDown={onPointerDown}>{content}{editable && <button type="button" className="resize-handle" aria-label={`Resize ${widget.type}`} onPointerDown={onResizePointerDown}><span /></button>}</div>;
}
