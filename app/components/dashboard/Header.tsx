import type { DashboardData } from "@/lib/dashboard/types";
import { useEffect, useState } from "react";
import { WeatherWidget } from "./WeatherWidget";

const dayFormatter = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" });
export function Header({ data }: { data: DashboardData }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return <header className="topbar">
    <div><p className="date-label">{dayFormatter.format(now)} · <time dateTime={now.toISOString()}>{now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</time></p><h1>Hello Nuno! I love the smell of Napalm in the morning!</h1></div>
    <WeatherWidget weather={data.weather} />
  </header>;
}
