import type { Habit, HabitOccurrence, HabitOccurrenceStatus, HabitOccurrenceView, HabitsStore, HabitsToday } from "./types";

export function localDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
function scheduledDate(dateKey: string, time: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

function occurrenceFor(habit: Habit, dateKey: string, existing?: HabitOccurrence): HabitOccurrence {
  if (existing) return existing;
  const scheduled = scheduledDate(dateKey, habit.time);
  const now = new Date().toISOString();
  return {
    id: `${habit.id}:${dateKey}`,
    habitId: habit.id,
    date: dateKey,
    scheduledFor: scheduled.toISOString(),
    windowStartsAt: new Date(scheduled.getTime() - habit.windowBeforeMinutes * 60_000).toISOString(),
    windowEndsAt: new Date(scheduled.getTime() + habit.windowAfterMinutes * 60_000).toISOString(),
    completedStepIds: [],
    createdAt: now,
    updatedAt: now,
  };
}

function resolvedStatus(occurrence: HabitOccurrence, now: Date): { status: HabitOccurrenceStatus; timing: HabitOccurrenceView["timing"] } {
  if (occurrence.status === "completed") return { status: "completed", timing: "finished" };
  if (occurrence.status === "skipped") return { status: "skipped", timing: "finished" };
  if (occurrence.snoozedUntil && new Date(occurrence.snoozedUntil) > now) return { status: "snoozed", timing: "due" };
  const scheduled = new Date(occurrence.scheduledFor);
  if (now < new Date(occurrence.windowStartsAt)) return { status: "upcoming", timing: "early" };
  if (now <= new Date(occurrence.windowEndsAt)) return { status: "available", timing: now < scheduled ? "early" : now.getTime() - scheduled.getTime() > 60_000 ? "overdue" : "due" };
  return { status: "missed", timing: "finished" };
}

export function materializeDay(store: HabitsStore, now = new Date(), dateKey = localDateKey(now)): HabitsToday {
  const [year, month, day] = dateKey.split("-").map(Number);
  const weekday = new Date(year, month - 1, day, 12).getDay();
  const scheduledHabits = store.habits.filter((habit) => habit.enabled && habit.days.includes(weekday)).sort((a, b) => a.order - b.order || a.time.localeCompare(b.time));
  const occurrences = scheduledHabits.map((habit) => {
    const occurrence = occurrenceFor(habit, dateKey, store.occurrences.find((item) => item.id === `${habit.id}:${dateKey}`));
    const state = resolvedStatus(occurrence, now);
    return { ...occurrence, ...state, habit };
  }).sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor) || a.habit.order - b.habit.order);
  const actionable = occurrences.filter((entry) => !["completed", "skipped", "missed"].includes(entry.status));
  const next = actionable.find((entry) => entry.status === "available") ?? actionable.find((entry) => entry.status === "snoozed") ?? actionable[0] ?? null;
  return { generatedAt: now.toISOString(), date: dateKey, occurrences, next, completedCount: occurrences.filter((entry) => entry.status === "completed").length, plannedCount: occurrences.length };
}

export function ensureOccurrence(store: HabitsStore, occurrenceId: string): HabitOccurrence | null {
  const [habitId, dateKey] = occurrenceId.split(":");
  const habit = store.habits.find((item) => item.id === habitId);
  if (!habit || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey ?? "")) return null;
  let occurrence = store.occurrences.find((item) => item.id === occurrenceId);
  if (!occurrence) {
    occurrence = occurrenceFor(habit, dateKey);
    store.occurrences.push(occurrence);
  }
  return occurrence;
}
