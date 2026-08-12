"use client";

import { useCallback, useEffect, useState } from "react";
import { HabitIcon } from "@/app/components/habits/HabitIcon";
import type { HabitOccurrenceView, HabitsToday } from "@/lib/habits/types";

async function getToday(): Promise<HabitsToday> {
  const response = await fetch("/api/habits/today", { cache: "no-store" });
  if (!response.ok) throw new Error("Could not load habits");
  return response.json() as Promise<HabitsToday>;
}

export function formatHabitTime(value: string) { return new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(new Date(value)); }

export async function runHabitAction(occurrenceId: string, action: "complete" | "skip" | "snooze" | "step", extra?: { minutes?: number; stepId?: string }): Promise<HabitsToday> {
  const response = await fetch("/api/habits/actions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ occurrenceId, action, ...extra }) });
  if (!response.ok) throw new Error("Could not update habit");
  const today = await response.json() as HabitsToday;
  window.dispatchEvent(new CustomEvent("habits:changed", { detail: today }));
  return today;
}

function getOccurrenceTime(occurrence: HabitOccurrenceView) {
  return formatHabitTime(occurrence.status === "snoozed" && occurrence.snoozedUntil
    ? occurrence.snoozedUntil
    : occurrence.scheduledFor);
}

function getOccurrenceState(occurrence: HabitOccurrenceView) {
  if (occurrence.timing === "overdue") return "Overdue";
  if (occurrence.status === "missed") return "Missed";
  if (occurrence.status === "snoozed") return "Later";
  return null;
}

export function HabitsWidget() {
  const [today, setToday] = useState<HabitsToday | null>(null);
  const [failed, setFailed] = useState(false);
  const load = useCallback(() => void getToday().then((next) => { setToday(next); setFailed(false); }).catch(() => setFailed(true)), []);

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 60_000);
    const changed = (event: Event) => setToday((event as CustomEvent<HabitsToday>).detail);
    window.addEventListener("habits:changed", changed);
    return () => { window.clearInterval(timer); window.removeEventListener("habits:changed", changed); };
  }, [load]);

  const openHabits = () => window.dispatchEvent(new CustomEvent("dashboard:navigate", { detail: "habits" }));
  const openCue = <span className="habit-widget-open">View habits<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg></span>;

  if (failed) return <button type="button" className="card habits-card habit-widget-state habit-widget-link" onClick={openHabits}><p className="card-label">Habits</p><strong>Habits unavailable</strong><span>Open the page to try again.</span>{openCue}</button>;
  if (!today) return <article className="card habits-card habit-widget-loading" aria-busy="true"><span className="skeleton line small" /><span className="skeleton block" /><span className="skeleton line" /></article>;
  if (!today.plannedCount) return <button type="button" className="card habits-card habit-widget-state habit-widget-link" onClick={openHabits}><p className="card-label">Habits</p><strong>No habits today</strong><span>Set up your schedule in Admin.</span>{openCue}</button>;
  const visibleOccurrences = today.occurrences
    .filter((occurrence) => occurrence.status !== "completed" && occurrence.status !== "skipped")
    .slice(0, 3);
  if (!visibleOccurrences.length) return <button type="button" className="card habits-card habit-widget-done habit-widget-link" onClick={openHabits}><span className="habit-widget-check"><HabitIcon name="check" /></span><span><span className="card-label">Habits</span><strong>Done for today</strong><span>{today.completedCount} completed</span></span>{openCue}</button>;
  return <button type="button" className="card habits-card habit-widget-agenda habit-widget-link" onClick={openHabits}>
    <span className="habit-widget-agenda-head"><strong>Habits</strong><span className="habit-widget-total"><strong>{today.plannedCount}</strong> today</span></span>
    <span className="habit-widget-list">
      {visibleOccurrences.map((occurrence) => {
        const state = getOccurrenceState(occurrence);
        return <span className={`habit-widget-row${state === "Overdue" ? " is-overdue" : ""}`} key={occurrence.id}>
          <span className="habit-widget-row-icon"><HabitIcon name={occurrence.habit.icon} /></span>
          <strong>{occurrence.habit.name}</strong>
          <span className="habit-widget-row-time"><time dateTime={occurrence.status === "snoozed" && occurrence.snoozedUntil ? occurrence.snoozedUntil : occurrence.scheduledFor}>{getOccurrenceTime(occurrence)}</time>{state && <em>{state}</em>}</span>
        </span>;
      })}
    </span>
  </button>;
}
