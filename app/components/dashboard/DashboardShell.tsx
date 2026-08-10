"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { BottomNavigation, type DashboardScreen } from "./BottomNavigation";
import { CalendarWidget } from "./CalendarWidget";
import { DeviceSettingsWidget } from "./DeviceSettingsWidget";
import { Header } from "./Header";
import { SpotifyWidget } from "./SpotifyWidget";
import { TasksScreen } from "./TasksWidget";
import { PomodoroWidget } from "./PomodoroWidget";
import { WidgetRenderer } from "./WidgetRenderer";
import { defaultWidgetConfig, type WidgetConfig } from "@/lib/dashboard/config";
import type { DashboardData } from "@/lib/dashboard/types";

export function DashboardShell({ data, widgets = defaultWidgetConfig, accentColor = "#c9ff52", fontFamily = "Arial" }: { data: DashboardData; widgets?: WidgetConfig[]; accentColor?: string; fontFamily?: string }) {
  useEffect(() => { if (fontFamily === "Arial") return; const link = document.createElement("link"); link.rel = "stylesheet"; link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontFamily).replace(/%20/g, "+")}:wght@400;500;600;700&display=swap`; document.head.appendChild(link); return () => link.remove(); }, [fontFamily]);
  const [screen, setScreen] = useState<DashboardScreen>("home");
  const calendarDays = [0, 1, 2].map((offset) => { const date = new Date(); date.setDate(date.getDate() + offset); const key = date.toISOString().slice(0, 10); const label = offset === 0 ? "Today" : offset === 1 ? "Tomorrow" : new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" }).format(date); return { key, label, events: data.todaysCalendar.events.filter((event) => event.startAt.slice(0, 10) === key) }; });
  const content = screen === "home" ? <section className="dashboard-grid">{widgets.map((widget) => <WidgetRenderer key={widget.id} widget={widget} data={data} />)}</section>
    : screen === "calendar" ? <section className="calendar-days-screen">{calendarDays.map((day) => <CalendarWidget key={day.key} calendar={{ date: day.key, events: day.events }} settings={{ strictDate: true, dateLabel: day.label }} />)}</section>
    : screen === "music" ? <section className="screen-grid single-screen"><SpotifyWidget nowPlaying={data.spotifyNowPlaying} expanded /></section>
    : screen === "tasks" ? <TasksScreen tasks={data.tasks} />
    : screen === "focus" ? <PomodoroWidget />
    : <DeviceSettingsWidget />;
  return <main className="dashboard" aria-label="Desk dashboard" style={{ "--lime": accentColor, fontFamily } as CSSProperties}><Header data={data} />{content}<BottomNavigation screen={screen} onChange={setScreen} /></main>;
}
