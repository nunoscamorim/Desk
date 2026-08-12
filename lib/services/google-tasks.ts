import { fetchWithRetry } from "@/lib/http/fetch-with-retry";
import type { Task } from "@/lib/dashboard/types";
import type { TasksRemindersService } from "./tasks-reminders";

/**
 * Google Tasks, read through the same OAuth connection as the calendar.
 *
 * Reading tasks needs its own scope, so an account connected before this
 * existed holds a grant that covers the calendar and nothing else. Google
 * answers those with 403 rather than anything self-healing — the only cure is
 * running the connect flow again to consent to the wider scope, so that case is
 * reported as exactly that instead of a bare status code.
 */

const TASKS_API = "https://tasks.googleapis.com/tasks/v1";
const REQUEST_TIMEOUT_MS = 6000;
const REQUEST_BUDGET_MS = 9000;
// Task lists change far less often than their contents.
const LIST_TTL_MS = 10 * 60 * 1000;

type TaskList = { id: string; title: string };
type GoogleTask = { id?: string; title?: string; status?: string; due?: string; notes?: string; parent?: string; position?: string };

let cachedLists: { expiresAt: number; key: string; lists: TaskList[] } | null = null;

/** Google reports why it refused in the body; a bare status code hides it. */
async function googleErrorMessage(response: Response): Promise<string | null> {
  try {
    const body = await response.json() as { error?: { message?: string } };
    return body.error?.message ?? null;
  } catch { return null; }
}

export class GoogleTasksApiService implements TasksRemindersService {
  constructor(private readonly getAccessToken: (options?: { forceRefresh?: boolean }) => Promise<string | null>, private readonly listNames: string[] = []) {}

  /** Mirrors the calendar's handling: a 401 buys one forced re-mint and retry. */
  private async request(path: string, init?: { method?: string; body?: unknown }): Promise<unknown> {
    const token = await this.getAccessToken();
    if (!token) throw new Error("Google Tasks is not connected");
    const call = (accessToken: string) => fetchWithRetry(`${TASKS_API}${path}`, { method: init?.method, headers: { Authorization: `Bearer ${accessToken}`, ...(init?.body ? { "Content-Type": "application/json" } : {}) }, body: init?.body ? JSON.stringify(init.body) : undefined, cache: "no-store" }, { label: "google-tasks", timeoutMs: REQUEST_TIMEOUT_MS, budgetMs: REQUEST_BUDGET_MS });

    let response = await call(token);
    if (response.status === 401) {
      const refreshed = await this.getAccessToken({ forceRefresh: true });
      if (!refreshed) throw new Error("Google Tasks is not connected");
      response = await call(refreshed);
    }
    if (!response.ok) {
      const detail = await googleErrorMessage(response);
      // 403 has two quite different causes and Google's own text is the only
      // thing that separates them: the Tasks API not enabled on the Cloud
      // project, or a grant that predates the tasks scope. Pass it through
      // rather than asserting one and sending someone down the wrong path.
      if (response.status === 403) throw new Error(`Google Tasks access refused${detail ? `: ${detail}` : ""} — enable the Tasks API in the Google Cloud project, and reconnect the account in /admin/credentials if the connection predates the tasks scope`);
      throw new Error(`Google Tasks request failed (${response.status})${detail ? `: ${detail}` : ""}`);
    }
    return response.json();
  }

  private async lists(): Promise<TaskList[]> {
    const key = this.listNames.join(",");
    if (cachedLists && cachedLists.key === key && cachedLists.expiresAt > Date.now()) return cachedLists.lists;

    const payload = await this.request("/users/@me/lists?maxResults=100") as { items?: Array<{ id?: string; title?: string }> };
    const all = (payload.items ?? []).flatMap((list) => (list.id ? [{ id: list.id, title: list.title ?? "Tasks" }] : []));
    // An empty filter means every list; names are matched loosely so the
    // configured value need not match Google's casing exactly.
    const wanted = this.listNames.length ? all.filter((list) => this.listNames.some((name) => list.title.toLowerCase() === name.toLowerCase())) : all;

    cachedLists = { expiresAt: Date.now() + LIST_TTL_MS, key, lists: wanted };
    return wanted;
  }

  async getTasks(): Promise<Task[]> {
    const lists = await this.lists();
    if (!lists.length) throw new Error("No matching Google Tasks lists found");

    // One failing list should not blank the widget.
    const results = await Promise.allSettled(lists.map(async (list) => {
      // showCompleted=false also drops the completed-but-hidden repeats Google
      // keeps around, so only outstanding work reaches the display.
      const payload = await this.request(`/lists/${encodeURIComponent(list.id)}/tasks?showCompleted=false&showHidden=false&maxResults=100`) as { items?: GoogleTask[] };
      return (payload.items ?? []).flatMap((task): Task[] => {
        const title = task.title?.trim();
        // Google keeps untitled rows as real tasks; they are noise on a display.
        if (!task.id || !title || task.status === "completed") return [];
        const due = task.due ? new Date(task.due) : null;
        return [{
          id: task.id,
          title,
          status: "todo",
          dueAt: due && !Number.isNaN(due.getTime()) ? due.toISOString() : null,
          project: list.title,
          notes: task.notes?.trim() || null,
          listId: list.id,
        }];
      });
    }));

    const failures = results.filter((result): result is PromiseRejectedResult => result.status === "rejected");
    if (failures.length === lists.length) throw new Error(`All Google Tasks lists failed: ${failures.map((failure) => String(failure.reason)).join("; ")}`);
    for (const failure of failures) console.error("[google-tasks] list failed:", failure.reason);

    const tasks = results.flatMap((result) => (result.status === "fulfilled" ? result.value : []));

    // Only the first few rows are shown, so the soonest due has to sort to the
    // top. Google Tasks carries no priority, so its own manual ordering breaks
    // ties among undated work.
    return tasks.sort((a, b) => {
      if (a.dueAt && b.dueAt) return a.dueAt.localeCompare(b.dueAt);
      if (a.dueAt) return -1;
      if (b.dueAt) return 1;
      return a.title.localeCompare(b.title);
    });
  }

  /**
   * PATCH rather than DELETE: Google Tasks treats completion as a status
   * change, and a deleted task can't be un-completed from the Tasks app the
   * way a completed one can.
   */
  async completeTask(taskId: string, listId: string | null): Promise<void> {
    if (!listId) throw new Error("This task has no list to complete it in");
    await this.request(`/lists/${encodeURIComponent(listId)}/tasks/${encodeURIComponent(taskId)}`, { method: "PATCH", body: { status: "completed" } });
  }
}
