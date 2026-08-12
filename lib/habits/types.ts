export type HabitCategory = "medication" | "movement" | "focus" | "workout" | "morning" | "evening" | "self-care" | "custom";

export type HabitStep =
  | { id: string; type: "check"; title: string }
  | { id: string; type: "focus"; title: string; targetMinutes: number };

export type Habit = {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  category: HabitCategory;
  enabled: boolean;
  order: number;
  days: number[];
  time: string;
  windowBeforeMinutes: number;
  windowAfterMinutes: number;
  estimatedDurationMinutes: number;
  reminders: {
    enabled: boolean;
    upcomingMinutes: number;
    overdueMinutes: number;
    defaultSnoozeMinutes: number;
  };
  steps: HabitStep[];
  createdAt: string;
  updatedAt: string;
};

export type HabitOccurrenceStatus = "upcoming" | "available" | "snoozed" | "completed" | "skipped" | "missed";

export type HabitOccurrence = {
  id: string;
  habitId: string;
  date: string;
  scheduledFor: string;
  windowStartsAt: string;
  windowEndsAt: string;
  status?: "completed" | "skipped";
  completedAt?: string;
  skippedAt?: string;
  snoozedUntil?: string;
  completedStepIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type HabitOccurrenceView = Omit<HabitOccurrence, "status"> & {
  status: HabitOccurrenceStatus;
  timing: "early" | "due" | "overdue" | "finished";
  habit: Habit;
};

export type HabitsToday = {
  generatedAt: string;
  date: string;
  occurrences: HabitOccurrenceView[];
  next: HabitOccurrenceView | null;
  completedCount: number;
  plannedCount: number;
  week: {
    completedDays: number;
    days: Array<{ date: string; completed: boolean; isToday: boolean }>;
  };
};

export type HabitsStore = { habits: Habit[]; occurrences: HabitOccurrence[] };
