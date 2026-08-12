"use client";

import { useEffect, useMemo, useState } from "react";
import { HabitIcon, habitIconOptions } from "@/app/components/habits/HabitIcon";
import type { Habit, HabitCategory, HabitOccurrence, HabitStep } from "@/lib/habits/types";
import { useConfirm } from "../ConfirmContext";
import { useToast } from "../ToastContext";

type HabitsPayload = { habits: Habit[]; history: HabitOccurrence[] };
type HabitDraft = Omit<Habit, "id" | "createdAt" | "updatedAt"> & { id?: string };

const dayLabels = ["S", "M", "T", "W", "T", "F", "S"];
const categoryLabels: Record<HabitCategory, string> = { medication: "Medication", movement: "Movement", focus: "Focus", workout: "Workout", morning: "Morning", evening: "Evening", "self-care": "Self-care", custom: "Custom" };
const emptyDraft = (): HabitDraft => ({ name: "", description: "", icon: "check", color: "#c9ff52", category: "custom", enabled: true, order: 0, days: [1, 2, 3, 4, 5], time: "09:00", windowBeforeMinutes: 0, windowAfterMinutes: 60, estimatedDurationMinutes: 5, reminders: { enabled: true, upcomingMinutes: 10, overdueMinutes: 15, defaultSnoozeMinutes: 10 }, steps: [] });
const templates: Array<{ label: string; draft: Partial<HabitDraft> }> = [
  { label: "Medication", draft: { name: "Take medication", icon: "pill", category: "medication", days: [0, 1, 2, 3, 4, 5, 6], time: "08:00", windowAfterMinutes: 60 } },
  { label: "Stretch", draft: { name: "Stretch", icon: "stretch", category: "movement", estimatedDurationMinutes: 5, steps: [{ id: "stretch-step", type: "check", title: "Complete a short stretch" }] } },
  { label: "Focus block", draft: { name: "Focus block", icon: "focus", category: "focus", estimatedDurationMinutes: 25, steps: [{ id: "focus-step", type: "focus", title: "Complete a focus session", targetMinutes: 25 }] } },
  { label: "Evening reset", draft: { name: "Evening reset", icon: "moon", category: "evening", time: "19:00", steps: [{ id: "review", type: "check", title: "Review tomorrow" }, { id: "clear", type: "check", title: "Clear the desk" }] } },
];

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="habit-field"><span>{label}</span>{children}</label>; }

export function HabitsAdmin() {
  const confirm = useConfirm();
  const showToast = useToast();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [history, setHistory] = useState<HabitOccurrence[]>([]);
  const [draft, setDraft] = useState<HabitDraft>(emptyDraft);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const response = await fetch("/api/habits", { cache: "no-store" });
    if (!response.ok) throw new Error("Could not load habits");
    const payload = await response.json() as HabitsPayload;
    setHabits(payload.habits);
    setHistory(payload.history);
  };
  useEffect(() => { queueMicrotask(() => { void load().catch(() => showToast("Could not load habits", "error")).finally(() => setLoading(false)); }); }, [showToast]);

  const selected = useMemo(() => habits.find((habit) => habit.id === draft.id), [draft.id, habits]);
  const edit = (habit: Habit) => setDraft({ ...habit, reminders: { ...habit.reminders }, days: [...habit.days], steps: habit.steps.map((step) => ({ ...step })) });
  const startNew = (template?: Partial<HabitDraft>) => setDraft({ ...emptyDraft(), ...template, reminders: { ...emptyDraft().reminders, ...template?.reminders }, days: template?.days ? [...template.days] : emptyDraft().days, steps: template?.steps?.map((step) => ({ ...step })) ?? [] });
  const update = <K extends keyof HabitDraft>(key: K, value: HabitDraft[K]) => setDraft((current) => ({ ...current, [key]: value }));

  const save = async () => {
    if (!draft.name.trim()) { showToast("Give the habit a name", "error"); return; }
    if (!draft.days.length) { showToast("Choose at least one day", "error"); return; }
    setSaving(true);
    try {
      const response = await fetch("/api/habits", { method: draft.id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) });
      if (!response.ok) throw new Error("Save failed");
      const saved = await response.json() as Habit;
      await load();
      edit(saved);
      showToast(draft.id ? "Habit updated" : "Habit added");
    } catch { showToast("Could not save the habit", "error"); } finally { setSaving(false); }
  };

  const toggleEnabled = async (habit: Habit) => {
    const response = await fetch("/api/habits", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: habit.id, enabled: !habit.enabled }) });
    if (response.ok) { await load(); showToast(habit.enabled ? "Habit paused" : "Habit resumed"); } else showToast("Could not update the habit", "error");
  };

  const duplicate = async (habit: Habit) => {
    const response = await fetch("/api/habits", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...habit, id: undefined, createdAt: undefined, updatedAt: undefined, name: `${habit.name} copy` }) });
    if (response.ok) { const saved = await response.json() as Habit; await load(); edit(saved); showToast("Habit duplicated"); } else showToast("Could not duplicate the habit", "error");
  };

  const remove = async (habit: Habit) => {
    if (!(await confirm({ title: `Delete ${habit.name}?`, description: "Its saved history will remain, but it will no longer appear in your day.", confirmLabel: "Delete", danger: true }))) return;
    const response = await fetch("/api/habits", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: habit.id }) });
    if (response.ok) { await load(); startNew(); showToast("Habit deleted"); } else showToast("Could not delete the habit", "error");
  };

  const move = async (habit: Habit, direction: -1 | 1) => {
    const index = habits.findIndex((item) => item.id === habit.id);
    const other = habits[index + direction];
    if (!other) return;
    await Promise.all([habit, other].map((item, itemIndex) => fetch("/api/habits", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: item.id, order: itemIndex === 0 ? other.order : habit.order }) })));
    await load();
  };

  const addStep = (type: HabitStep["type"]) => update("steps", [...draft.steps, type === "focus" ? { id: crypto.randomUUID(), type, title: "Focus session", targetMinutes: 25 } : { id: crypto.randomUUID(), type, title: "New step" }]);
  const updateStep = (id: string, patch: Partial<HabitStep>) => update("steps", draft.steps.map((step) => step.id === id ? { ...step, ...patch } as HabitStep : step));

  return <>
    <header className="admin-header"><div><p className="admin-eyebrow">Dashboard / Habits</p><h1>Habits.</h1><p>Set up gentle prompts for the things that keep your day moving.</p></div><button className="btn" type="button" onClick={() => void save()} disabled={saving}>{saving ? "Saving…" : draft.id ? "Save changes" : "Add habit"}</button></header>
    <div className="habits-admin-workspace">
      <section className="admin-panel habits-library">
        <div className="panel-heading"><div><h2>Your habits</h2></div><span>{habits.filter((habit) => habit.enabled).length} active</span></div>
        {loading ? <div className="habit-admin-loading"><span className="skeleton" /><span className="skeleton" /><span className="skeleton" /></div> : habits.length ? <div className="habit-admin-list">{habits.map((habit) => <button type="button" className={`habit-admin-row ${draft.id === habit.id ? "selected" : ""}`} key={habit.id} onClick={() => edit(habit)}><span className="habit-admin-icon" style={{ color: habit.color, background: `color-mix(in srgb, ${habit.color} 16%, #252522)` }}><HabitIcon name={habit.icon} /></span><span className="habit-admin-copy"><strong>{habit.name}</strong><small>{habit.time} · {habit.days.length === 7 ? "Every day" : `${habit.days.length} days`} · {habit.estimatedDurationMinutes} min</small></span><span className={`habit-state-dot ${habit.enabled ? "on" : ""}`} aria-label={habit.enabled ? "Active" : "Paused"} /></button>)}</div> : <div className="empty-panel"><strong>No habits yet</strong><span>Choose a starter below or create one from scratch.</span></div>}
        <button className="btn btn-secondary btn-block habit-new" type="button" onClick={() => startNew()}>New habit</button>
        {selected && <div className="habit-list-actions"><button type="button" onClick={() => void move(selected, -1)} disabled={habits[0]?.id === selected.id} aria-label="Move habit up">↑</button><button type="button" onClick={() => void move(selected, 1)} disabled={habits.at(-1)?.id === selected.id} aria-label="Move habit down">↓</button><button type="button" onClick={() => void toggleEnabled(selected)}>{selected.enabled ? "Pause" : "Resume"}</button><button type="button" onClick={() => void duplicate(selected)}>Duplicate</button><button className="danger" type="button" onClick={() => void remove(selected)}>Delete</button></div>}
        <div className="habit-templates"><span>Start from a template</span>{templates.map((template) => <button type="button" key={template.label} onClick={() => startNew(template.draft)}>{template.label}</button>)}</div>
      </section>

      <section className="admin-panel habit-editor">
        <div className="habit-editor-head"><div className="habit-editor-preview" style={{ color: draft.color, background: `color-mix(in srgb, ${draft.color} 16%, #252522)` }}><HabitIcon name={draft.icon} /></div><div><h2>{draft.id ? draft.name : "New habit"}</h2><p>{draft.enabled ? "Active in your daily schedule" : "Paused"}</p></div></div>
        <div className="habit-form-grid">
          <Field label="Name"><input value={draft.name} onChange={(event) => update("name", event.target.value)} placeholder="Take medication" /></Field>
          <Field label="Category"><select value={draft.category} onChange={(event) => update("category", event.target.value as HabitCategory)}>{Object.entries(categoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
          <Field label="Short instruction"><input value={draft.description} onChange={(event) => update("description", event.target.value)} placeholder="Optional" /></Field>
          <Field label="Estimated minutes"><input type="number" min="1" max="240" value={draft.estimatedDurationMinutes} onChange={(event) => update("estimatedDurationMinutes", Number(event.target.value))} /></Field>
        </div>
        <div className="habit-icon-picker" role="group" aria-label="Habit icon">{habitIconOptions.map((icon) => <button type="button" key={icon.id} className={draft.icon === icon.id ? "selected" : ""} aria-label={icon.label} title={icon.label} onClick={() => update("icon", icon.id)}><HabitIcon name={icon.id} /></button>)}<input type="color" aria-label="Habit color" title="Habit color" value={draft.color} onChange={(event) => update("color", event.target.value)} /></div>

        <div className="habit-section"><div><h3>Schedule</h3><p>Choose when this habit should enter your day.</p></div><div className="habit-days" role="group" aria-label="Scheduled days">{dayLabels.map((day, index) => <button type="button" className={draft.days.includes(index) ? "selected" : ""} aria-pressed={draft.days.includes(index)} key={`${day}-${index}`} onClick={() => update("days", draft.days.includes(index) ? draft.days.filter((value) => value !== index) : [...draft.days, index].sort())}>{day}</button>)}</div><div className="habit-form-grid three"><Field label="Time"><input type="time" value={draft.time} onChange={(event) => update("time", event.target.value)} /></Field><Field label="Available before"><select value={draft.windowBeforeMinutes} onChange={(event) => update("windowBeforeMinutes", Number(event.target.value))}><option value="0">At scheduled time</option><option value="30">30 min before</option><option value="60">1 hour before</option><option value="120">2 hours before</option></select></Field><Field label="Due window"><select value={draft.windowAfterMinutes} onChange={(event) => update("windowAfterMinutes", Number(event.target.value))}><option value="30">30 minutes</option><option value="60">1 hour</option><option value="120">2 hours</option><option value="240">4 hours</option><option value="1440">Any time today</option></select></Field></div></div>

        <div className="habit-section"><div className="habit-section-title"><div><h3>Steps</h3><p>Focus steps open the Focus page and use its existing Pomodoro.</p></div><div><button type="button" className="btn btn-secondary btn-sm" onClick={() => addStep("check")}>Add check</button><button type="button" className="btn btn-secondary btn-sm" onClick={() => addStep("focus")}>Add focus</button></div></div>{draft.steps.length ? <div className="habit-step-editor">{draft.steps.map((step, index) => <div key={step.id}><span>{index + 1}</span><select value={step.type} onChange={(event) => updateStep(step.id, event.target.value === "focus" ? { type: "focus", targetMinutes: 25 } : { type: "check" })}><option value="check">Check</option><option value="focus">Focus</option></select><input value={step.title} onChange={(event) => updateStep(step.id, { title: event.target.value })} />{step.type === "focus" ? <input className="step-minutes" type="number" min="1" max="180" aria-label="Focus minutes" value={step.targetMinutes} onChange={(event) => updateStep(step.id, { targetMinutes: Number(event.target.value) })} /> : <span className="step-minutes-placeholder" />}<button type="button" aria-label={`Remove ${step.title}`} onClick={() => update("steps", draft.steps.filter((item) => item.id !== step.id))}>×</button></div>)}</div> : <p className="habit-no-steps">No steps. This habit can be completed with one tap.</p>}</div>

        <div className="habit-section habit-reminders"><div className="habit-section-title"><div><h3>Reminders</h3><p>Keep reminders limited and easy to postpone.</p></div><label className="habit-switch"><input type="checkbox" checked={draft.reminders.enabled} onChange={(event) => update("reminders", { ...draft.reminders, enabled: event.target.checked })} /><span />{draft.reminders.enabled ? "On" : "Off"}</label></div>{draft.reminders.enabled && <div className="habit-form-grid three"><Field label="Upcoming"><select value={draft.reminders.upcomingMinutes} onChange={(event) => update("reminders", { ...draft.reminders, upcomingMinutes: Number(event.target.value) })}><option value="0">None</option><option value="5">5 min before</option><option value="10">10 min before</option><option value="30">30 min before</option></select></Field><Field label="Overdue"><select value={draft.reminders.overdueMinutes} onChange={(event) => update("reminders", { ...draft.reminders, overdueMinutes: Number(event.target.value) })}><option value="0">None</option><option value="10">After 10 min</option><option value="15">After 15 min</option><option value="30">After 30 min</option></select></Field><Field label="Default later"><select value={draft.reminders.defaultSnoozeMinutes} onChange={(event) => update("reminders", { ...draft.reminders, defaultSnoozeMinutes: Number(event.target.value) })}><option value="5">5 minutes</option><option value="10">10 minutes</option><option value="30">30 minutes</option></select></Field></div>}</div>
      </section>

      <section className="admin-panel habit-history"><div className="panel-heading"><div><h2>Recent activity</h2></div><span>{history.length} saved</span></div>{history.length ? <div className="habit-history-list">{history.slice(0, 12).map((entry) => { const habit = habits.find((item) => item.id === entry.habitId); return <div key={entry.id}><span className={entry.status ?? "open"} /><strong>{habit?.name ?? "Deleted habit"}</strong><time dateTime={entry.completedAt ?? entry.scheduledFor}>{new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(entry.completedAt ?? entry.skippedAt ?? entry.scheduledFor))}</time><em>{entry.status ?? "In progress"}</em></div>; })}</div> : <div className="empty-panel"><strong>No activity yet</strong><span>Completed and skipped habits will appear here.</span></div>}</section>
    </div>
  </>;
}
