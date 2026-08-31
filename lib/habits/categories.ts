import type { HabitCategory } from "./types";

/**
 * What each category is called, and the one colour it is drawn in.
 *
 * Colour used to be picked per habit, which meant two focus blocks could be two
 * different blues and a category told you nothing at a glance. It is a property
 * of the category now: every movement habit is the same green, everywhere it
 * appears, and the eight are spaced around the wheel so no two read as the same
 * colour on the dark canvas.
 *
 * Kept out of the widget stylesheet on purpose — the admin list needs the same
 * values, and those two sheets use scales that must not be mixed.
 */
export const HABIT_CATEGORIES: Record<HabitCategory, { label: string; color: string }> = {
  medication: { label: "Medication", color: "#ff8080" },
  workout: { label: "Workout", color: "#ff9f5c" },
  morning: { label: "Morning", color: "#f5cd5c" },
  movement: { label: "Movement", color: "#5fd18e" },
  "self-care": { label: "Self-care", color: "#4ecdc4" },
  focus: { label: "Focus", color: "#7aa7ff" },
  evening: { label: "Evening", color: "#b78bff" },
  custom: { label: "Custom", color: "#e78bc4" },
};

/** Falls back to custom, so a category dropped from the union still draws. */
export const habitCategory = (category: HabitCategory) => HABIT_CATEGORIES[category] ?? HABIT_CATEGORIES.custom;
export const habitColor = (category: HabitCategory) => habitCategory(category).color;
export const habitCategoryLabel = (category: HabitCategory) => habitCategory(category).label;
