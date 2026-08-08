import type { DashboardData } from "@/lib/dashboard/types";
import { useEffect, useState } from "react";
import { WeatherWidget } from "./WeatherWidget";

const dayFormatter = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" });
const morningQuotes = [
  { text: "Good morning, Vietnam!", source: "Good Morning, Vietnam" },
  { text: "It’s a beautiful day to save lives.", source: "Grey’s Anatomy" },
  { text: "The sun’ll come out tomorrow.", source: "Annie" },
  { text: "Rise and shine, campers.", source: "Groundhog Day" },
  { text: "Today is a new day.", source: "The Lion King II" },
];

export function Header({ data }: { data: DashboardData }) {
  const [now, setNow] = useState(() => new Date());
  const [quoteIndex, setQuoteIndex] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    const timer = window.setInterval(() => setQuoteIndex((index) => (index + 1) % morningQuotes.length), 10000);
    return () => window.clearInterval(timer);
  }, []);
  const quote = morningQuotes[quoteIndex];
  return <header className="topbar">
    <div><p className="date-label">{dayFormatter.format(now)} · <time dateTime={now.toISOString()}>{now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</time></p><h1>{quote.text}</h1><p className="quote-source">{quote.source}</p></div>
    <WeatherWidget weather={data.weather} />
  </header>;
}
