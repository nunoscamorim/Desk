"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type { Task } from "@/lib/dashboard/types";

const listColors: Record<string, string> = {
  Betano: "#f5a623",
  Personal: "#a78bfa",
  Work: "#34d399",
  Health: "#f472b6",
  Finance: "#60a5fa",
};

const fallbackColors = ["#818cf8", "#fb923c", "#2dd4bf", "#e879f9", "#fbbf24"];

function getListColor(project: string | null): string {
  if (project && listColors[project]) return listColors[project];
  if (!project) return fallbackColors[0];
  let hash = 0;
  for (let i = 0; i < project.length; i++) hash = project.charCodeAt(i) + ((hash << 5) - hash);
  return fallbackColors[Math.abs(hash) % fallbackColors.length];
}

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

/**
 * Shared by the light home-widget row and the tasks screen's row — the
 * screen-only bits (a mark-as-done button, an expandable detail panel) only
 * ever render when a caller opts in, so the widget's markup is untouched.
 */
function TaskItem({ task, now, detail: detailProps }: { task: Task; now: number; detail?: { expanded: boolean; onToggleExpand: () => void; completing: boolean; onComplete: () => void } }) {
  const due = dueLabel(task.dueAt, now);
  // No dedicated due column — Schedule keeps its clock-time column since a
  // meeting time is exact, but a task's due date is a rough label ("Tmrw",
  // "Late") that doesn't earn the same fixed-width space. It rides in the
  // subtitle instead, next to whichever list the task came from.
  const summary = [due, task.project ?? task.priority].filter(Boolean).join(" · ");
  if (!detailProps) return <li className={`calendar-item task-item ${due === "Late" ? "task-overdue" : ""}`} style={{ "--event-color": getListColor(task.project) } as CSSProperties}>
    <span className="event-line" />
    <div><strong>{task.title}</strong>{summary && <span className="task-detail">{summary}</span>}</div>
  </li>;

  const { expanded, onToggleExpand, completing, onComplete } = detailProps;
  return <li className={`calendar-item task-item task-item-interactive ${due === "Late" ? "task-overdue" : ""} ${expanded ? "is-expanded" : ""}`} style={{ "--event-color": getListColor(task.project) } as CSSProperties}>
    <span className="event-line" />
    <div className="task-item-body" role="button" tabIndex={0} aria-expanded={expanded} onClick={onToggleExpand} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onToggleExpand(); } }}>
      <strong>{task.title}</strong>{summary && <span className="task-detail">{summary}</span>}
      {expanded && <div className="task-detail-panel">
        <p className={task.notes ? undefined : "task-detail-empty"}>{task.notes || "No additional details."}</p>
        <dl>
          <div><dt>List</dt><dd>{task.project ?? "—"}</dd></div>
          <div><dt>Due</dt><dd>{task.dueAt ? new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short" }).format(new Date(task.dueAt)) : "No due date"}</dd></div>
          <div><dt>Status</dt><dd>{task.status === "in_progress" ? "In progress" : "To do"}</dd></div>
          {task.priority && <div><dt>Priority</dt><dd>{task.priority}</dd></div>}
        </dl>
      </div>}
    </div>
    {/* Named rather than a bare circle: on a wall display the control has to say
        what it does without being tapped to find out. It sits outside the body so
        marking a task done never doubles as expanding it. */}
    <button type="button" className={`task-complete ${completing ? "is-busy" : ""}`} aria-label={`Mark “${task.title}” as done`} disabled={completing} onClick={onComplete}>{completing ? "Marking…" : "Mark as done"}</button>
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
  const openTasks = tasks.filter((task) => task.status !== "done");
  return <article className="card tasks-card"><div className="calendar-heading"><div><span className="card-label">Tasks · today</span><h2 className="card-title">Tasks</h2></div><span className="event-count">{openTasks.length}<small>open</small></span></div>{openTasks.length ? <ul className="task-list">{openTasks.slice(0, 3).map((task) => <TaskItem key={task.id} task={task} now={now} />)}</ul> : <div className="empty-state">All caught up.</div>}</article>;
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
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);
  // A completed task has to disappear immediately rather than wait on the next
  // dashboard poll, but only the ids cleared here are held locally — the list
  // itself stays derived from props. Mirroring the whole array into state meant
  // an effect copying props back over it on every poll, which both trips the
  // hooks lint and lets a poll in flight during a tap resurrect the row.
  const [completedIds, setCompletedIds] = useState<string[]>([]);
  const localTasks = useMemo(() => tasks.filter((task) => !completedIds.includes(task.id)), [tasks, completedIds]);

  const complete = async (task: Task) => {
    setCompletingId(task.id);
    setCompletedIds((current) => [...current, task.id]);
    try {
      const response = await fetch("/api/tasks/complete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: task.id, listId: task.listId }) });
      if (!response.ok) throw new Error();
    } catch {
      // The source never actually completed it — put it back rather than
      // leave the display lying about what's still outstanding.
      setCompletedIds((current) => current.filter((id) => id !== task.id));
    } finally {
      setCompletingId((current) => (current === task.id ? null : current));
    }
  };

  const lists = useMemo(() => {
    const counts = new Map<string, number>();
    for (const task of localTasks) if (task.project) counts.set(task.project, (counts.get(task.project) ?? 0) + 1);
    return [...counts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [localTasks]);

  // A filter naming a list that no longer has tasks would show an empty screen
  // with no clue why, so it falls back to everything.
  const active = selected && lists.some((list) => list.name === selected) ? selected : null;
  const visible = active ? localTasks.filter((task) => task.project === active) : localTasks;

  return <section className="tasks-screen">
    <article className="card tasks-card tasks-screen-main">
      <div className="calendar-heading"><div><span className="card-label">Tasks</span><h2 className="card-title">{active ?? "All tasks"}</h2></div><span className="event-count">{visible.length}<small>open</small></span></div>
      {visible.length ? <ul className="task-list task-list-scroll">{visible.map((task) => <TaskItem key={task.id} task={task} now={now} detail={{ expanded: expandedId === task.id, onToggleExpand: () => setExpandedId((current) => (current === task.id ? null : task.id)), completing: completingId === task.id, onComplete: () => void complete(task) }} />)}</ul> : <div className="empty-state">All caught up.</div>}
    </article>
    <aside className="task-filters" aria-label="Filter by list">
      <p className="card-label">Lists</p>
      <button type="button" className={`task-filter ${active === null ? "active" : ""}`} aria-pressed={active === null} onClick={() => setSelected(null)}>
        <span>All tasks</span><strong>{localTasks.length}</strong>
      </button>
      {lists.map((list) => <button key={list.name} type="button" className={`task-filter ${active === list.name ? "active" : ""}`} aria-pressed={active === list.name} style={{ "--event-color": getListColor(list.name) } as CSSProperties} onClick={() => setSelected(list.name)}>
        <span><i />{list.name}</span><strong>{list.count}</strong>
      </button>)}
    </aside>
  </section>;
}
