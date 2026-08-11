"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { BottomNavigation, type DashboardScreen } from "./BottomNavigation";
import { CalendarWidget } from "./CalendarWidget";
import { DeviceSettingsWidget } from "./DeviceSettingsWidget";
import { Header } from "./Header";
import { MusicScreen } from "./MusicScreen";
import { TasksScreen } from "./TasksWidget";
import { TvScreen } from "./TvScreen";
import { PomodoroWidget } from "./PomodoroWidget";
import { WidgetRenderer } from "./WidgetRenderer";
import { defaultCanvas, type CanvasSize, type WidgetConfig } from "@/lib/dashboard/config";
import { defaultWidgetConfig } from "@/lib/dashboard/widget-registry";
import type { DashboardData } from "@/lib/dashboard/types";

export function DashboardScreenContent({ screen, data, widgets = defaultWidgetConfig }: { screen: DashboardScreen; data: DashboardData; widgets?: WidgetConfig[] }) {
  const calendarDays = [0, 1, 2].map((offset) => { const date = new Date(); date.setDate(date.getDate() + offset); const key = date.toISOString().slice(0, 10); const label = offset === 0 ? "Today" : offset === 1 ? "Tomorrow" : new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" }).format(date); return { key, label, events: data.todaysCalendar.events.filter((event) => event.startAt.slice(0, 10) === key) }; });
  return screen === "home" ? <section className="dashboard-grid">{widgets.map((widget) => <WidgetRenderer key={widget.id} widget={widget} data={data} />)}</section>
    : screen === "calendar" ? <section className="calendar-days-screen">{calendarDays.map((day) => <CalendarWidget key={day.key} calendar={{ date: day.key, events: day.events }} settings={{ strictDate: true, dateLabel: day.label }} />)}</section>
    : screen === "music" ? <MusicScreen nowPlaying={data.spotifyNowPlaying} recentlyPlayed={data.spotifyRecentlyPlayed} />
    : screen === "tv" ? <TvScreen />
    : screen === "tasks" ? <TasksScreen tasks={data.tasks} />
    : screen === "focus" ? <PomodoroWidget />
    : <DeviceSettingsWidget />;
}

export function DashboardShell({ data, widgets = defaultWidgetConfig, accentColor = "#c9ff52", fontFamily = "Arial", canvas = defaultCanvas }: { data: DashboardData; widgets?: WidgetConfig[]; accentColor?: string; fontFamily?: string; canvas?: CanvasSize }) {
  useEffect(() => { if (fontFamily === "Arial") return; const link = document.createElement("link"); link.rel = "stylesheet"; link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontFamily).replace(/%20/g, "+")}:wght@400;500;600;700&display=swap`; document.head.appendChild(link); return () => link.remove(); }, [fontFamily]);
  const [screen, setScreen] = useState<DashboardScreen>("home");
  return <main className="dashboard" aria-label="Desk dashboard" style={{ "--lime": accentColor, "--canvas-w": `${canvas.width}px`, "--canvas-h": `${canvas.height}px`, fontFamily } as CSSProperties}><Header data={data} screen={screen} /><DashboardScreenContent screen={screen} data={data} widgets={widgets} /><BottomNavigation screen={screen} onChange={setScreen} /></main>;
}
