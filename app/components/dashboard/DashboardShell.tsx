"use client";

import { useState } from "react";
import type { CSSProperties } from "react";
import { AiUsageWidget } from "./AiUsageWidget";
import { BottomNavigation, type DashboardScreen } from "./BottomNavigation";
import { CalendarWidget } from "./CalendarWidget";
import { Header } from "./Header";
import { NextMeetingWidget } from "./NextMeetingWidget";
import { SpotifyWidget } from "./SpotifyWidget";
import { TasksWidget } from "./TasksWidget";
import { WidgetRenderer } from "./WidgetRenderer";
import { defaultWidgetConfig, type WidgetConfig } from "@/lib/dashboard/config";
import type { DashboardData } from "@/lib/dashboard/types";

export function DashboardShell({ data, widgets = defaultWidgetConfig, accentColor = "#c9ff52" }: { data: DashboardData; widgets?: WidgetConfig[]; accentColor?: string }) {
  const [screen, setScreen] = useState<DashboardScreen>("home");
  const content = screen === "home" ? <section className="dashboard-grid">{widgets.map((widget) => <WidgetRenderer key={widget.id} widget={widget} data={data} />)}</section>
    : screen === "calendar" ? <section className="screen-grid"><CalendarWidget calendar={data.todaysCalendar} /><NextMeetingWidget meeting={data.nextMeeting} /></section>
    : screen === "music" ? <section className="screen-grid single-screen"><SpotifyWidget nowPlaying={data.spotifyNowPlaying} /></section>
    : screen === "tasks" ? <section className="screen-grid single-screen"><TasksWidget tasks={data.tasks} /></section>
    : <section className="screen-grid"><AiUsageWidget codex={data.codexUsage} claudeCode={data.claudeCodeUsage} /><article className="card more-card"><span className="card-label">Desk status</span><h2>Everything is in sync.</h2><p>Last updated from your dashboard sources just now.</p></article></section>;
  return <main className="dashboard" aria-label="Desk dashboard" style={{ "--lime": accentColor } as CSSProperties}><Header data={data} />{content}<BottomNavigation screen={screen} onChange={setScreen} /></main>;
}
