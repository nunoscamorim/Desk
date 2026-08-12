import { ensureOccurrence, materializeDay } from "@/lib/habits/schedule";
import { mutateHabitsStore } from "@/lib/habits/store";

type HabitAction = { occurrenceId?: string; action?: "complete" | "skip" | "snooze" | "step"; minutes?: number; stepId?: string };

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as HabitAction;
  if (!body.occurrenceId || !body.action) return Response.json({ error: "occurrenceId and action are required" }, { status: 400 });
  const today = await mutateHabitsStore((store) => {
    const occurrence = ensureOccurrence(store, body.occurrenceId!);
    if (!occurrence) return null;
    const now = new Date();
    if (body.action === "complete") {
      occurrence.status = "completed";
      occurrence.completedAt = now.toISOString();
      occurrence.snoozedUntil = undefined;
    } else if (body.action === "skip") {
      occurrence.status = "skipped";
      occurrence.skippedAt = now.toISOString();
      occurrence.snoozedUntil = undefined;
    } else if (body.action === "snooze") {
      const minutes = Math.min(240, Math.max(1, Math.round(body.minutes ?? 10)));
      occurrence.snoozedUntil = new Date(now.getTime() + minutes * 60_000).toISOString();
    } else if (body.action === "step" && body.stepId) {
      if (!occurrence.completedStepIds.includes(body.stepId)) occurrence.completedStepIds.push(body.stepId);
      const habit = store.habits.find((item) => item.id === occurrence.habitId);
      if (habit?.steps.length && habit.steps.every((step) => occurrence.completedStepIds.includes(step.id))) {
        occurrence.status = "completed";
        occurrence.completedAt = now.toISOString();
      }
    }
    occurrence.updatedAt = now.toISOString();
    return materializeDay(store, now);
  });
  return today ? Response.json(today) : Response.json({ error: "Habit occurrence not found" }, { status: 404 });
}
