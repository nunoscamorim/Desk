import type { DashboardData } from "@/lib/dashboard/types";
import { useEffect, useState } from "react";
import { WeatherWidget } from "./WeatherWidget";

const dayFormatter = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" });

type GreetingPeriod = "morning" | "afternoon" | "night";
type Greeting = { message: string; source: string };

const greetings: Record<GreetingPeriod, Greeting[]> = {
  morning: [
    { message: "Good morning, Nuno! May the Force be with your coffee.", source: "Inspired by Star Wars" },
    { message: "Good morning, Nuno! Here’s looking at brew, kid.", source: "Inspired by Casablanca" },
    { message: "Good morning, Nuno! To productivity and beyond!", source: "Inspired by Toy Story" },
    { message: "Good morning, Nuno! Carpe diem—after coffee.", source: "Inspired by Dead Poets Society" },
    { message: "Good morning, Nuno! Coffee. Shaken, not stirred.", source: "Inspired by James Bond" },
  ],
  afternoon: [
    { message: "Good afternoon, Nuno! Just keep swimming.", source: "Inspired by Finding Nemo" },
    { message: "Good afternoon, Nuno! Make it so.", source: "Inspired by Star Trek" },
    { message: "Good afternoon, Nuno! Challenge accepted.", source: "Inspired by How I Met Your Mother" },
    { message: "Good afternoon, Nuno! Why so serious?", source: "Inspired by The Dark Knight" },
    { message: "Good afternoon, Nuno! Show me the coffee!", source: "Inspired by Jerry Maguire" },
  ],
  night: [
    { message: "Good night, Nuno! I’ll be back… after eight hours.", source: "Inspired by The Terminator" },
    { message: "Good night, Nuno! Sleep long and prosper.", source: "Inspired by Star Trek" },
    { message: "Good night, Nuno! Hasta la vista, workday.", source: "Inspired by Terminator 2" },
    { message: "Good night, Nuno! Tomorrow is another dashboard.", source: "Inspired by Gone with the Wind" },
    { message: "Good night, Nuno! The Dude abides—in bed.", source: "Inspired by The Big Lebowski" },
  ],
};

function getGreeting(date: Date): Greeting {
  const hour = date.getHours();
  const period: GreetingPeriod = hour >= 5 && hour < 12 ? "morning" : hour >= 12 && hour < 18 ? "afternoon" : "night";
  const options = greetings[period];
  const hourlyRotation = Math.floor(date.getTime() / 3_600_000);
  return options[hourlyRotation % options.length];
}

export function Header({ data }: { data: DashboardData }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const greeting = getGreeting(now);
  return <header className="topbar">
    <div className="greeting-copy"><p className="date-label">{dayFormatter.format(now)} · <time dateTime={now.toISOString()}>{now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</time></p><h1>{greeting.message}</h1><p className="quote-source">{greeting.source}</p></div>
    <WeatherWidget weather={data.weather} />
  </header>;
}
