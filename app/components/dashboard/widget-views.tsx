import type { ReactNode } from "react";
import { AiUsageWidget } from "./AiUsageWidget";
import { CalendarWidget } from "./CalendarWidget";
import { NextMeetingWidget } from "./NextMeetingWidget";
import { SpotifyWidget } from "./SpotifyWidget";
import { TasksWidget } from "./TasksWidget";
import type { WidgetSettings, WidgetType } from "@/lib/dashboard/config";
import type { DashboardData } from "@/lib/dashboard/types";

/**
 * The component half of the widget registry — kept apart from
 * lib/dashboard/widget-registry.ts so that server code can normalise saved
 * layouts without importing components that use hooks. Each entry pulls what it
 * needs out of the dashboard payload, so widgets keep their own prop shapes
 * instead of being forced into a common one.
 */
const widgetViews: Record<WidgetType, (data: DashboardData, settings: WidgetSettings) => ReactNode> = {
  meeting: (data) => <NextMeetingWidget meeting={data.nextMeeting} />,
  calendar: (data, settings) => <CalendarWidget calendar={data.todaysCalendar} settings={{ showLocations: settings.showLocations !== false }} />,
  music: (data) => <SpotifyWidget nowPlaying={data.spotifyNowPlaying} />,
  tasks: (data) => <TasksWidget tasks={data.tasks} />,
  usage: (data) => <AiUsageWidget codex={data.codexUsage} claudeCode={data.claudeCodeUsage} />,
};

export function renderWidget(type: WidgetType, data: DashboardData, settings: WidgetSettings): ReactNode {
  return widgetViews[type](data, settings);
}
