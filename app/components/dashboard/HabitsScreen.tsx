"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { HabitIcon } from "@/app/components/habits/HabitIcon";
import type { HabitOccurrenceView, HabitsToday, HabitStep } from "@/lib/habits/types";
import { formatHabitTime, runHabitAction } from "./HabitsWidget";

export type HabitFocusContext = { occurrenceId: string; stepId: string; habitName: string; targetMinutes: number };

async function fetchToday() {
  const response = await fetch("/api/habits/today", { cache: "no-store" });
  if (!response.ok) throw new Error("Could not load habits");
  return response.json() as Promise<HabitsToday>;
}

function statusCopy(occurrence: HabitOccurrenceView) {
  if (occurrence.status === "completed") return `Completed ${occurrence.completedAt ? formatHabitTime(occurrence.completedAt) : ""}`;
  if (occurrence.status === "skipped") return "Skipped";
  if (occurrence.status === "missed") return "Window ended";
  if (occurrence.status === "snoozed" && occurrence.snoozedUntil) return `Later at ${formatHabitTime(occurrence.snoozedUntil)}`;
  return `${formatHabitTime(occurrence.scheduledFor)} · ${occurrence.habit.estimatedDurationMinutes} min`;
}

/**
 * A waiting habit's clock time is the one thing worth scanning the column for,
 * so it is lifted out of the status sentence into a column of its own — the same
 * shape the home widget's rows already use — leaving the sentence to carry only
 * what the time cannot say.
 */
const queueTime = (occurrence: HabitOccurrenceView) => (occurrence.status === "snoozed" && occurrence.snoozedUntil ? occurrence.snoozedUntil : occurrence.scheduledFor);
const queueMeta = (occurrence: HabitOccurrenceView) => (occurrence.status === "snoozed" ? "Moved later" : `${occurrence.habit.estimatedDurationMinutes} min`);

export function HabitsScreen({ onStartFocus }: { onStartFocus?: (context: HabitFocusContext) => void }) {
  const [today, setToday] = useState<HabitsToday | null>(null);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmingMedication, setConfirmingMedication] = useState<string | null>(null);
  const load = useCallback(() => void fetchToday().then((next) => { setToday(next); setError(false); }).catch(() => setError(true)), []);
  useEffect(() => {
    load();
    const timer = window.setInterval(load, 60_000);
    const changed = (event: Event) => setToday((event as CustomEvent<HabitsToday>).detail);
    window.addEventListener("habits:changed", changed);
    return () => { window.clearInterval(timer); window.removeEventListener("habits:changed", changed); };
  }, [load]);

  const grouped = useMemo(() => {
    const entries = today?.occurrences ?? [];
    return { later: entries.filter((entry) => ["upcoming", "snoozed"].includes(entry.status) && entry.id !== today?.next?.id), completed: entries.filter((entry) => ["completed", "skipped", "missed"].includes(entry.status)) };
  }, [today]);

  const act = async (occurrenceId: string, action: "complete" | "skip" | "snooze" | "step", extra?: { minutes?: number; stepId?: string }) => {
    setBusy(`${occurrenceId}:${action}`);
    try { setToday(await runHabitAction(occurrenceId, action, extra)); } catch { setError(true); } finally { setBusy(null); }
  };

  const completeStep = (occurrence: HabitOccurrenceView, step: HabitStep) => {
    if (step.type === "focus" && onStartFocus) { onStartFocus({ occurrenceId: occurrence.id, stepId: step.id, habitName: occurrence.habit.name, targetMinutes: step.targetMinutes }); return; }
    void act(occurrence.id, "step", { stepId: step.id });
  };

  if (error) return <section className="habits-screen habit-screen-message"><HabitIcon name="check" /><h2>Habits are unavailable</h2><p>The latest schedule could not be loaded.</p><button type="button" onClick={load}>Try again</button></section>;
  if (!today) return <section className="habits-screen habit-screen-loading" aria-busy="true"><span className="skeleton" /><span className="skeleton" /><span className="skeleton" /></section>;
  if (!today.plannedCount) return <section className="habits-screen habit-screen-message"><HabitIcon name="sun" /><h2>Your day is open</h2><p>No habits are scheduled for today. Add one in Admin when you are ready.</p></section>;

  const current = today.next;
  const completeCurrent = () => {
    if (!current) return;
    if (current.habit.category === "medication" && confirmingMedication !== current.id) { setConfirmingMedication(current.id); return; }
    setConfirmingMedication(null);
    void act(current.id, "complete");
  };
  return <section className="habits-screen">
    <div className="habits-day-head"><div><h2>Today’s habits</h2><p>{today.completedCount} of {today.plannedCount} completed</p></div><strong className="habit-day-count">{today.completedCount}<span>/{today.plannedCount}</span></strong></div>
    <div className="habit-day-progress" aria-label={`${today.completedCount} of ${today.plannedCount} habits completed`}><span style={{ width: `${today.plannedCount ? today.completedCount / today.plannedCount * 100 : 0}%` }} /></div>
    <div className="habits-day-layout">
      <div className="habit-now-column">
        {current ? <article className={`habit-now${current.timing === "overdue" ? " is-overdue" : ""}`} style={{ "--habit-color": current.habit.color } as React.CSSProperties}>
          <div className="habit-now-heading"><span className="habit-now-icon"><HabitIcon name={current.habit.icon} /></span><div><p>{current.timing === "overdue" ? "Ready when you are" : current.status === "snoozed" ? "Saved for later" : "Now"}</p><h3>{current.habit.name}</h3></div><time dateTime={current.scheduledFor}>{formatHabitTime(current.scheduledFor)}</time></div>
          {/* How long the habit stays open is the question the card was silent on,
              and it is the one that decides whether to do it now or tap Later. */}
          <div className="habit-now-meta">
            <span>Open until {formatHabitTime(current.windowEndsAt)}</span>
            <span>{current.habit.estimatedDurationMinutes} min</span>
            <span className="habit-now-category">{current.habit.category}</span>
          </div>
          {current.habit.description && <p className="habit-now-description">{current.habit.description}</p>}
          {current.habit.steps.length > 0 && <div className="habit-runner-steps">{current.habit.steps.map((step, index) => { const done = current.completedStepIds.includes(step.id); return <button type="button" className={done ? "done" : ""} disabled={done || busy !== null} key={step.id} onClick={() => completeStep(current, step)}><span>{done ? <HabitIcon name="check" /> : index + 1}</span><strong>{step.title}</strong>{step.type === "focus" && <em>{step.targetMinutes} min · Open Focus</em>}</button>; })}</div>}
          <div className="habit-now-actions"><button type="button" disabled={busy !== null} onClick={() => { setConfirmingMedication(null); void act(current.id, "skip"); }}>Skip today</button><button type="button" disabled={busy !== null} onClick={() => { setConfirmingMedication(null); void act(current.id, "snooze", { minutes: current.habit.reminders.defaultSnoozeMinutes }); }}>Later</button><button className="primary" type="button" disabled={busy !== null} onClick={completeCurrent}><HabitIcon name="check" />{confirmingMedication === current.id ? "Confirm taken" : "Done"}</button></div>
        </article> : <article className="habit-now habit-day-complete"><HabitIcon name="check" /><h3>All clear for today</h3><p>You can come back tomorrow without doing anything else here.</p></article>}
      </div>
      <div className="habit-queue-column">
        <div className="habit-queue-head"><h3>Later today</h3><span>{grouped.later.length}</span></div>
        <div className="habit-queue">{grouped.later.length ? grouped.later.map((occurrence) => <article key={occurrence.id}><span className="habit-queue-icon" style={{ "--habit-color": occurrence.habit.color } as React.CSSProperties}><HabitIcon name={occurrence.habit.icon} /></span><div><strong>{occurrence.habit.name}</strong><span>{queueMeta(occurrence)}</span></div><time dateTime={queueTime(occurrence)}>{formatHabitTime(queueTime(occurrence))}</time></article>) : <p>Nothing else is waiting.</p>}</div>
        <div className="habit-queue-head completed"><h3>Finished</h3><span>{grouped.completed.length}</span></div>
        <div className="habit-queue habit-finished">{grouped.completed.map((occurrence) => <article key={occurrence.id} className={occurrence.status === "completed" ? "is-done" : ""}><span className="habit-queue-icon"><HabitIcon name={occurrence.status === "completed" ? "check" : occurrence.habit.icon} /></span><div><strong>{occurrence.habit.name}</strong><span>{statusCopy(occurrence)}</span></div></article>)}</div>
      </div>
    </div>
  </section>;
}
