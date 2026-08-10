"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { Header } from "./Header";
import { WidgetRenderer } from "./WidgetRenderer";
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
    if ("orientation" in screen && "lock" in screen.orientation) {
      (screen.orientation as unknown as { lock(orientation: string): Promise<void> }).lock("landscape").catch(() => {
        // Silently fail if lock isn't supported
      });
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

  return (
    <main
      className="dashboard ipad-dashboard"
      aria-label="iPad Desk Dashboard"
      style={{ "--lime": accentColor, fontFamily } as CSSProperties}
    >
      <Header data={currentData} />
      <section className="ipad-dashboard-grid">
        {widgets.map((widget) => (
          <WidgetRenderer key={widget.id} widget={widget} data={currentData} />
        ))}
      </section>
    </main>
  );
}

