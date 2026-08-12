import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Habit, HabitCategory, HabitOccurrence, HabitsStore, HabitStep } from "./types";

const dataDir = path.join(process.cwd(), "data");
const storePath = path.join(dataDir, "habits.json");
const emptyStore: HabitsStore = { habits: [], occurrences: [] };
let writeQueue = Promise.resolve();

const categories = new Set<HabitCategory>(["medication", "movement", "focus", "workout", "morning", "evening", "self-care", "custom"]);
const clamp = (value: unknown, fallback: number, minimum: number, maximum: number) => typeof value === "number" && Number.isFinite(value) ? Math.min(maximum, Math.max(minimum, Math.round(value))) : fallback;
const safeTime = (value: unknown) => typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : "09:00";
const safeColor = (value: unknown) => typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value : "#c9ff52";

function normalizeStep(value: unknown): HabitStep | null {
  if (!value || typeof value !== "object") return null;
  const step = value as Partial<HabitStep>;
  if (typeof step.title !== "string" || !step.title.trim()) return null;
  const id = typeof step.id === "string" && step.id ? step.id : randomUUID();
  if (step.type === "focus") return { id, type: "focus", title: step.title.trim(), targetMinutes: clamp(step.targetMinutes, 25, 1, 180) };
  return { id, type: "check", title: step.title.trim() };
}
export function normalizeHabit(value: unknown, existing?: Habit): Habit {
  const input = value && typeof value === "object" ? value as Partial<Habit> : {};
  const now = new Date().toISOString();
  const days = Array.isArray(input.days) ? [...new Set(input.days.filter((day): day is number => Number.isInteger(day) && day >= 0 && day <= 6))].sort() : existing?.days ?? [1, 2, 3, 4, 5];
  const steps = Array.isArray(input.steps) ? input.steps.map(normalizeStep).filter((step): step is HabitStep => step !== null) : existing?.steps ?? [];
  return {
    id: existing?.id ?? randomUUID(),
    name: typeof input.name === "string" && input.name.trim() ? input.name.trim().slice(0, 80) : existing?.name ?? "Untitled habit",
    description: typeof input.description === "string" ? input.description.trim().slice(0, 180) : existing?.description ?? "",
    icon: typeof input.icon === "string" && input.icon ? input.icon.slice(0, 24) : existing?.icon ?? "check",
    color: safeColor(input.color ?? existing?.color),
    category: categories.has(input.category as HabitCategory) ? input.category as HabitCategory : existing?.category ?? "custom",
    enabled: typeof input.enabled === "boolean" ? input.enabled : existing?.enabled ?? true,
    order: clamp(input.order, existing?.order ?? 0, 0, 10_000),
    days: days.length ? days : existing?.days ?? [1, 2, 3, 4, 5],
    time: safeTime(input.time ?? existing?.time),
    windowBeforeMinutes: clamp(input.windowBeforeMinutes, existing?.windowBeforeMinutes ?? 0, 0, 720),
    windowAfterMinutes: clamp(input.windowAfterMinutes, existing?.windowAfterMinutes ?? 60, 0, 1_440),
    estimatedDurationMinutes: clamp(input.estimatedDurationMinutes, existing?.estimatedDurationMinutes ?? 5, 1, 240),
    reminders: {
      enabled: typeof input.reminders?.enabled === "boolean" ? input.reminders.enabled : existing?.reminders.enabled ?? true,
      upcomingMinutes: clamp(input.reminders?.upcomingMinutes, existing?.reminders.upcomingMinutes ?? 10, 0, 240),
      overdueMinutes: clamp(input.reminders?.overdueMinutes, existing?.reminders.overdueMinutes ?? 15, 0, 240),
      defaultSnoozeMinutes: clamp(input.reminders?.defaultSnoozeMinutes, existing?.reminders.defaultSnoozeMinutes ?? 10, 1, 240),
    },
    steps,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
}

export async function readHabitsStore(): Promise<HabitsStore> {
  try {
    const parsed = JSON.parse(await readFile(storePath, "utf8")) as Partial<HabitsStore>;
    const habits = Array.isArray(parsed.habits) ? parsed.habits.map((habit, index) => normalizeHabit({ ...habit, order: (habit as Habit).order ?? index }, habit as Habit)) : [];
    const occurrences = Array.isArray(parsed.occurrences) ? parsed.occurrences.filter((entry): entry is HabitOccurrence => Boolean(entry && typeof entry.id === "string" && typeof entry.habitId === "string")) : [];
    return { habits, occurrences };
  } catch { return { ...emptyStore }; }
}

export async function writeHabitsStore(store: HabitsStore): Promise<void> {
  const write = async () => {
    await mkdir(dataDir, { recursive: true });
    const temporaryPath = `${storePath}.${process.pid}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(store, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
    await rename(temporaryPath, storePath);
  };
  writeQueue = writeQueue.then(write, write);
  await writeQueue;
}

export async function mutateHabitsStore<T>(mutation: (store: HabitsStore) => T | Promise<T>): Promise<T> {
  let result!: T;
  const operation = async () => {
    const store = await readHabitsStore();
    result = await mutation(store);
    await mkdir(dataDir, { recursive: true });
    const temporaryPath = `${storePath}.${process.pid}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(store, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
    await rename(temporaryPath, storePath);
  };
  writeQueue = writeQueue.then(operation, operation);
  await writeQueue;
  return result;
}
