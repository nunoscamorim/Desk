"use client";

import { useCallback, useEffect, useState } from "react";
import { HabitIcon } from "@/app/components/habits/HabitIcon";
import type { HabitsToday } from "@/lib/habits/types";

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

export function HabitsWidget() {
  const [today, setToday] = useState<HabitsToday | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmingMedication, setConfirmingMedication] = useState(false);
  const load = useCallback(() => void getToday().then((next) => { setToday(next); setFailed(false); }).catch(() => setFailed(true)), []);

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 60_000);
    const changed = (event: Event) => setToday((event as CustomEvent<HabitsToday>).detail);
    window.addEventListener("habits:changed", changed);
    return () => { window.clearInterval(timer); window.removeEventListener("habits:changed", changed); };
  }, [load]);

  const act = async (action: "complete" | "snooze") => {
    if (!today?.next) return;
    setBusy(true);
    try { setToday(await runHabitAction(today.next.id, action, action === "snooze" ? { minutes: today.next.habit.reminders.defaultSnoozeMinutes } : undefined)); } finally { setBusy(false); }
  };

  if (failed) return <article className="card habits-card habit-widget-state"><p className="card-label">Habits</p><strong>Habits unavailable</strong><button type="button" onClick={load}>Try again</button></article>;
  if (!today) return <article className="card habits-card habit-widget-loading" aria-busy="true"><span className="skeleton line small" /><span className="skeleton block" /><span className="skeleton line" /></article>;
  if (!today.plannedCount) return <article className="card habits-card habit-widget-state"><p className="card-label">Habits</p><strong>No habits today</strong><span>Set up your schedule in Admin.</span></article>;
  if (!today.next) return <article className="card habits-card habit-widget-done"><span className="habit-widget-check"><HabitIcon name="check" /></span><div><p className="card-label">Habits</p><strong>Done for today</strong><span>{today.completedCount} completed</span></div></article>;
  const occurrence = today.next;
  const complete = () => {
    if (occurrence.habit.category === "medication" && !confirmingMedication) { setConfirmingMedication(true); return; }
    setConfirmingMedication(false);
    void act("complete");
  };
  return <article className="card habits-card" style={{ "--habit-color": occurrence.habit.color } as React.CSSProperties}>
    <div className="habit-widget-top"><span className="habit-widget-icon"><HabitIcon name={occurrence.habit.icon} /></span><p className="card-label">{occurrence.status === "snoozed" ? "Later" : occurrence.timing === "overdue" ? "Ready when you are" : "Up next"}</p><span className="habit-widget-count">{today.completedCount}/{today.plannedCount}</span></div>
    <div className="habit-widget-copy"><strong>{occurrence.habit.name}</strong><span>{occurrence.status === "snoozed" && occurrence.snoozedUntil ? `Remind at ${formatHabitTime(occurrence.snoozedUntil)}` : `${formatHabitTime(occurrence.scheduledFor)} · about ${occurrence.habit.estimatedDurationMinutes} min`}</span></div>
    <div className="habit-widget-actions"><button type="button" disabled={busy} onClick={() => { setConfirmingMedication(false); void act("snooze"); }}>Later</button><button className="primary" type="button" disabled={busy} onClick={complete}><HabitIcon name="check" />{confirmingMedication ? "Confirm taken" : "Done"}</button></div>
  </article>;
}
