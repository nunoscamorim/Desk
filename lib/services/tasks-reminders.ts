import type { Task } from "@/lib/dashboard/types";

export interface TasksRemindersService {
  getTasks(): Promise<Task[]>;
  /**
   * Marks a task done at the source. `listId` is whatever `getTasks()` put in
   * `Task.listId` — opaque to callers, required by sources (like Google Tasks)
   * that need it to address the right list the task lives in.
   */
  completeTask(taskId: string, listId: string | null): Promise<void>;
}

/**
 * Completed ids, kept at module scope so a task marked done during a dev
 * session stays done across requests instead of reappearing on the next
 * poll — the same "behaves like the real thing" spirit the rest of the mock
 * services follow, without needing real persistence for a dev-only path.
 */
const completedIds = new Set<string>();

export class MockTasksRemindersService implements TasksRemindersService {
  async getTasks(): Promise<Task[]> {
    const all: Task[] = [
      { id: "task-dashboard-api", title: "Build dashboard API", status: "in_progress", priority: "high", dueAt: new Date(Date.now() + 14400000).toISOString(), project: "Desk Dashboard", notes: "Wire up the /api/dashboard route and get every widget reading from it instead of its own mock data.", listId: null },
      { id: "task-review-prototype", title: "Review dashboard prototype", status: "todo", priority: "medium", dueAt: new Date(Date.now() + 86400000).toISOString(), project: "Desk Dashboard", notes: null, listId: null },
      { id: "task-submit-expenses", title: "Submit monthly expenses", status: "todo", priority: "low", dueAt: null, project: "Admin", notes: "Receipts are in the shared drive under August.", listId: null },
    ];
    return all.filter((task) => !completedIds.has(task.id));
  }

  async completeTask(taskId: string): Promise<void> { completedIds.add(taskId); }
}
