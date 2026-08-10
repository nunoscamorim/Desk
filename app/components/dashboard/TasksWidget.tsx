"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type { Task } from "@/lib/dashboard/types";

const colors = ["#b8d86b", "#c4a9ff", "#ff9b64", "#7ed9e8"];

const dayKey = (value: Date) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;

/**
 * A short due label for the column the calendar uses for a clock time.
 *
 * Deliberately a date and never a time: Google Tasks due dates carry no
 * meaningful time of day, so formatting one would print the reader's offset
 * from UTC — the same thing that made all-day events read as 01:00.
 */
function dueLabel(dueAt: string | null, now: number): string | null {
  if (!dueAt) return null;
  const due = new Date(dueAt);
  if (Number.isNaN(due.getTime())) return null;
  // A due date is a floating day, so it is compared by its own calendar date
  // rather than by how many hours away the instant is.
  const dueDay = dueAt.slice(0, 10);
  const today = new Date(now);
  if (dueDay === dayKey(today)) return "Today";
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (dueDay === dayKey(tomorrow)) return "Tmrw";
  // "Overdue" wraps mid-word in the 46px due column; "Late" says the same
  // thing and fits on one line at the same size as every other label here.
  if (due.getTime() < today.setHours(0, 0, 0, 0)) return "Late";
  return new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" }).format(due);
}

function TaskItem({ task, index, now }: { task: Task; index: number; now: number }) {
  const due = dueLabel(task.dueAt, now);
  const detail = task.project ?? task.priority;
  return <li className={`calendar-item task-item ${due === "Late" ? "task-overdue" : ""}`} style={{ "--event-color": colors[index % colors.length] } as CSSProperties}>
    <span className="task-due">{due}</span>
    <span className="event-line" />
    <div><strong>{task.title}</strong>{detail && <span>{detail}</span>}</div>
  </li>;
}

/** Ticks slowly so "Today" and "Late" roll over without a reload. */
function useToday() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 60000); return () => window.clearInterval(timer); }, []);
  return now;
}

export function TasksWidget({ tasks }: { tasks: Task[] }) {
  const now = useToday();
  return <article className="card tasks-card"><div className="card-title-row"><h2>Tasks</h2><span>{tasks.filter((task) => task.status !== "done").length} open</span></div>{tasks.length ? <ul className="task-list">{tasks.slice(0, 3).map((task, index) => <TaskItem key={task.id} task={task} index={index} now={now} />)}</ul> : <div className="empty-state">All caught up.</div>}</article>;
}

/**
 * The full tasks screen: every task, with the lists they came from offered as
 * filters alongside. The widget on the dashboard only has room for the next few
 * rows, so this is where a list that matters occasionally — groceries, someday —
 * can be looked at without it crowding the display the rest of the time.
 */
export function TasksScreen({ tasks }: { tasks: Task[] }) {
  const now = useToday();
  const [selected, setSelected] = useState<string | null>(null);

  const lists = useMemo(() => {
    const counts = new Map<string, number>();
    for (const task of tasks) if (task.project) counts.set(task.project, (counts.get(task.project) ?? 0) + 1);
    return [...counts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [tasks]);

  // A filter naming a list that no longer has tasks would show an empty screen
  // with no clue why, so it falls back to everything.
  const active = selected && lists.some((list) => list.name === selected) ? selected : null;
  const visible = active ? tasks.filter((task) => task.project === active) : tasks;

  return <section className="tasks-screen">
    <article className="card tasks-card tasks-screen-main">
      <div className="card-title-row"><h2>{active ?? "All tasks"}</h2><span>{visible.length} open</span></div>
      {visible.length ? <ul className="task-list task-list-scroll">{visible.map((task, index) => <TaskItem key={task.id} task={task} index={index} now={now} />)}</ul> : <div className="empty-state">All caught up.</div>}
    </article>
    <aside className="task-filters" aria-label="Filter by list">
      <p className="card-label">Lists</p>
      <button type="button" className={`task-filter ${active === null ? "active" : ""}`} aria-pressed={active === null} onClick={() => setSelected(null)}>
        <span>All tasks</span><strong>{tasks.length}</strong>
      </button>
      {lists.map((list, index) => <button key={list.name} type="button" className={`task-filter ${active === list.name ? "active" : ""}`} aria-pressed={active === list.name} style={{ "--event-color": colors[index % colors.length] } as CSSProperties} onClick={() => setSelected(list.name)}>
        <span><i />{list.name}</span><strong>{list.count}</strong>
      </button>)}
    </aside>
  </section>;
}
