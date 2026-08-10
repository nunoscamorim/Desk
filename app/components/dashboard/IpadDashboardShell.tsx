"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { Header } from "./Header";
import { WidgetRenderer } from "./WidgetRenderer";
import { BottomNavigation, type DashboardScreen } from "./BottomNavigation";
import { CalendarWidget } from "./CalendarWidget";
import { DeviceSettingsWidget } from "./DeviceSettingsWidget";
import { SpotifyWidget } from "./SpotifyWidget";
import { TasksScreen } from "./TasksWidget";
import { PomodoroWidget } from "./PomodoroWidget";
import type { WidgetConfig } from "@/lib/dashboard/config";
import type { DashboardData } from "@/lib/dashboard/types";

interface IpadDashboardShellProps {
  data: DashboardData;
  widgets?: WidgetConfig[];
  accentColor?: string;
  fontFamily?: string;
  refreshInterval?: number; // in milliseconds, default 5 minutes
}

export function IpadDashboardShell({
  data,
  widgets = [],
  accentColor = "#c9ff52",
  fontFamily = "Arial",
  refreshInterval = 5 * 60 * 1000, // 5 minutes
}: IpadDashboardShellProps) {
  const [currentData, setCurrentData] = useState(data);
  const [screen, setScreen] = useState<DashboardScreen>("home");

  // Load Google Font if not Arial
  useEffect(() => {
    if (fontFamily === "Arial") return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontFamily).replace(/%20/g, "+")}:wght@400;500;600;700&display=swap`;
    document.head.appendChild(link);
    return () => link.remove();
  }, [fontFamily]);

  // Lock screen orientation to landscape on iPad
  useEffect(() => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((window as any)?.screen?.orientation?.lock) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).screen.orientation.lock("landscape").catch(() => {
          // Silently fail if lock isn't supported
        });
      }
    } catch {
      // Orientation lock not supported
    }
  }, []);

  // Request Wake Lock to prevent screen sleep in kiosk mode
  useEffect(() => {
    let wakeLock: { release(): Promise<void> } | null = null;

    const acquireWakeLock = async () => {
      try {
        if ("wakeLock" in navigator) {
          wakeLock = await (navigator.wakeLock as { request(type: string): Promise<{ release(): Promise<void> }> }).request("screen");
        }
      } catch (error) {
        console.debug("Wake Lock request failed:", error);
      }
    };

    acquireWakeLock();

    // Reacquire wake lock if user interacts with page
    const handleInteraction = () => {
      acquireWakeLock();
    };

    document.addEventListener("click", handleInteraction);
    document.addEventListener("touchstart", handleInteraction);

    return () => {
      document.removeEventListener("click", handleInteraction);
      document.removeEventListener("touchstart", handleInteraction);
      wakeLock?.release();
    };
  }, []);

  // Auto-refresh data at specified interval
  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const response = await fetch("/api/dashboard", { cache: "no-store" });
        if (response.ok) {
          const newData = (await response.json()) as DashboardData;
          setCurrentData(newData);
        }
      } catch (error) {
        console.debug("Dashboard refresh failed:", error);
      }
    };

    // Fetch immediately on mount, then at interval
    fetchDashboard();
    const interval = setInterval(fetchDashboard, refreshInterval);

    return () => clearInterval(interval);
  }, [refreshInterval]);

  // Build calendar days like the desktop version
  const calendarDays = [0, 1, 2].map((offset) => {
    const date = new Date();
    date.setDate(date.getDate() + offset);
    const key = date.toISOString().slice(0, 10);
    const label = offset === 0 ? "Today" : offset === 1 ? "Tomorrow" : new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" }).format(date);
    return { key, label, events: currentData.todaysCalendar.events.filter((event) => event.startAt.slice(0, 10) === key) };
  });

  // Render content based on current screen
  const content =
    screen === "home" ? (
      <section className="ipad-dashboard-responsive-grid">
        {widgets.map((widget) => (
          <div key={widget.id} className={`ipad-widget-wrapper ipad-widget-${widget.id}`}>
            <WidgetRenderer widget={widget} data={currentData} />
          </div>
        ))}
      </section>
    ) : screen === "calendar" ? (
      <section className="calendar-days-screen">
        {calendarDays.map((day) => (
          <CalendarWidget key={day.key} calendar={{ date: day.key, events: day.events }} settings={{ strictDate: true, dateLabel: day.label }} />
        ))}
      </section>
    ) : screen === "music" ? (
      <section className="screen-grid single-screen">
        <SpotifyWidget nowPlaying={currentData.spotifyNowPlaying} expanded />
      </section>
    ) : screen === "tasks" ? (
      <TasksScreen tasks={currentData.tasks} />
    ) : screen === "focus" ? (
      <PomodoroWidget />
    ) : (
      <DeviceSettingsWidget />
    );

  return (
    <main
      className="dashboard ipad-dashboard"
      aria-label="iPad Desk Dashboard"
      style={{ "--lime": accentColor, fontFamily } as CSSProperties}
    >
      <Header data={currentData} />
      {content}
      <BottomNavigation screen={screen} onChange={setScreen} />
    </main>
  );
}

