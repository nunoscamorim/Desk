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
type GoogleTask = { id?: string; title?: string; status?: string; due?: string; parent?: string; position?: string };

let cachedLists: { expiresAt: number; key: string; lists: TaskList[] } | null = null;

export class GoogleTasksApiService implements TasksRemindersService {
  constructor(private readonly getAccessToken: (options?: { forceRefresh?: boolean }) => Promise<string | null>, private readonly listNames: string[] = []) {}

  /** Mirrors the calendar's handling: a 401 buys one forced re-mint and retry. */
  private async request(path: string): Promise<unknown> {
    const token = await this.getAccessToken();
    if (!token) throw new Error("Google Tasks is not connected");
    const call = (accessToken: string) => fetchWithRetry(`${TASKS_API}${path}`, { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" }, { label: "google-tasks", timeoutMs: REQUEST_TIMEOUT_MS, budgetMs: REQUEST_BUDGET_MS });

    let response = await call(token);
    if (response.status === 401) {
      const refreshed = await this.getAccessToken({ forceRefresh: true });
      if (!refreshed) throw new Error("Google Tasks is not connected");
      response = await call(refreshed);
    }
    if (response.status === 403) throw new Error("Google Tasks access was refused — reconnect the account in /admin/credentials to grant the tasks scope");
    if (!response.ok) throw new Error(`Google Tasks request failed (${response.status})`);
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
}
