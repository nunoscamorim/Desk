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

/** How long before a habit's window shuts the widget gives itself over to it. */
const CLOSING_LEAD_MS = 5 * 60_000;

/**
 * The habit whose window is about to shut, if one is.
 *
 * `windowEndsAt` is the real deadline: past it the schedule resolves the
 * occurrence to `missed`, so nothing has to switch the widget back afterwards —
 * it stops matching here and the agenda returns on its own.
 */
function findClosing(today: HabitsToday, now: number): HabitOccurrenceView | null {
  const closing = today.occurrences.filter((occurrence) => {
    if (occurrence.status === "completed" || occurrence.status === "skipped" || occurrence.status === "missed") return false;
    const remaining = new Date(occurrence.windowEndsAt).getTime() - now;
    return remaining > 0 && remaining <= CLOSING_LEAD_MS;
  });
  // Soonest deadline wins. The day is ordered by start time and windows differ in
  // length, so the habit that starts first is not always the one that shuts first.
  return closing.sort((a, b) => new Date(a.windowEndsAt).getTime() - new Date(b.windowEndsAt).getTime())[0] ?? null;
}

const countdown = (ms: number) => { const seconds = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`; };

export function HabitsWidget() {
  const [today, setToday] = useState<HabitsToday | null>(null);
  const [failed, setFailed] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const load = useCallback(() => void getToday().then((next) => { setToday(next); setFailed(false); }).catch(() => setFailed(true)), []);

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 60_000);
    const changed = (event: Event) => setToday((event as CustomEvent<HabitsToday>).detail);
    window.addEventListener("habits:changed", changed);
    return () => { window.clearInterval(timer); window.removeEventListener("habits:changed", changed); };
  }, [load]);

  const closing = today ? findClosing(today, now) : null;
  const isClosing = closing !== null;
  // A per-second clock only while a countdown is on screen; otherwise a coarse
  // one, which is still frequent enough to catch the window opening between the
  // 60s data polls without running a 1s timer on the display all day.
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), isClosing ? 1000 : 15_000);
    return () => window.clearInterval(timer);
  }, [isClosing]);

  const openHabits = () => window.dispatchEvent(new CustomEvent("dashboard:navigate", { detail: "habits" }));
  const openCue = <span className="habit-widget-open">View habits<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg></span>;

  if (failed) return <button type="button" className="card habits-card habit-widget-state habit-widget-link" onClick={openHabits}><p className="card-label">Habits</p><strong>Habits unavailable</strong><span>Open the page to try again.</span>{openCue}</button>;
  if (!today) return <article className="card habits-card habit-widget-loading" aria-busy="true"><span className="skeleton line small" /><span className="skeleton block" /><span className="skeleton line" /></article>;
  if (!today.plannedCount) return <button type="button" className="card habits-card habit-widget-state habit-widget-link" onClick={openHabits}><p className="card-label">Habits</p><strong>No habits today</strong><span>Set up your schedule in Admin.</span>{openCue}</button>;
  // The last five minutes of a habit's window: the widget stops being a list of
  // the day and becomes only this one, until the deadline passes and the
  // occurrence resolves to missed — at which point the agenda comes back.
  if (closing) return <button type="button" className="card habits-card habit-widget-closing habit-widget-link" style={{ "--habit-color": closing.habit.color } as React.CSSProperties} onClick={openHabits}>
    <span className="habit-widget-closing-head"><span className="habit-widget-icon"><HabitIcon name={closing.habit.icon} /></span><span className="habit-widget-closing-kicker">Closing soon</span></span>
    <strong className="habit-widget-closing-name">{closing.habit.name}</strong>
    {/* role=timer, and deliberately not a live region: this repaints every second
        and would otherwise be read aloud each time. */}
    <span className="habit-widget-countdown" role="timer" aria-label={`${countdown(new Date(closing.windowEndsAt).getTime() - now)} left to complete ${closing.habit.name}`}><strong>{countdown(new Date(closing.windowEndsAt).getTime() - now)}</strong><em>left</em></span>
    <span className="habit-widget-closing-foot">Until <time dateTime={closing.windowEndsAt}>{formatHabitTime(closing.windowEndsAt)}</time></span>
  </button>;

  const visibleOccurrences = today.occurrences
    .filter((occurrence) => !["completed", "skipped", "missed"].includes(occurrence.status))
    .slice(0, 3);
  if (!visibleOccurrences.length) return <button type="button" className="card habits-card habit-widget-done habit-widget-link" onClick={openHabits}><span className="habit-widget-check"><HabitIcon name="check" /></span><span><span className="card-label">Habits</span><strong>Done for today</strong><span>{today.completedCount} completed</span></span>{openCue}</button>;
  return <button type="button" className="card habits-card habit-widget-agenda habit-widget-link" onClick={openHabits}>
    <span className="calendar-heading">
      <span className="calendar-heading-stack">
        <span className="card-label">Habits · today</span>
        <span className="card-title">Habits</span>
      </span>
      <span className="event-count">{today.plannedCount}<small>today</small></span>
    </span>
    <span className="task-list habit-widget-list">
      {visibleOccurrences.map((occurrence) => {
        const state = getOccurrenceState(occurrence);
        return <span className={`calendar-item habit-item${state === "Overdue" ? " is-overdue" : ""}`} style={{ "--event-color": occurrence.habit.color } as React.CSSProperties} key={occurrence.id}>
          <span className="habit-item-icon"><HabitIcon name={occurrence.habit.icon} /></span>
          <span className="event-line" />
          <span className="habit-item-content">
            <strong>{occurrence.habit.name}</strong>
            <span><time dateTime={occurrence.status === "snoozed" && occurrence.snoozedUntil ? occurrence.snoozedUntil : occurrence.scheduledFor}>{getOccurrenceTime(occurrence)}</time>{state && <em>{state}</em>}</span>
          </span>
        </span>;
      })}
    </span>
  </button>;
}
