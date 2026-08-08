import type { Task } from "@/lib/dashboard/types";

function TaskItem({ task }: { task: Task }) {
  return <li className="task-item"><span className={`task-check ${task.status}`} aria-hidden="true">{task.status === "done" ? "✓" : ""}</span><div><strong>{task.title}</strong><span>{task.project ?? task.priority}</span></div><span className={`priority priority-${task.priority}`}>{task.priority}</span></li>;
}

export function TasksWidget({ tasks }: { tasks: Task[] }) {
  return <article className="card tasks-card"><div className="card-title-row"><h2>Tasks</h2><span>{tasks.filter((task) => task.status !== "done").length} open</span></div>{tasks.length ? <ul className="task-list">{tasks.slice(0, 3).map((task) => <TaskItem key={task.id} task={task} />)}</ul> : <div className="empty-state">All caught up.</div>}</article>;
}
