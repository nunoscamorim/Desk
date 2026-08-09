import ical from "node-ical";
import { discoverCollections, fetchCollectionObjects, type CalDavAccount } from "./caldav";
import type { Task } from "@/lib/dashboard/types";
import type { TasksRemindersService } from "./tasks-reminders";

/**
 * Apple Reminders, read over iCloud CalDAV.
 *
 * Each reminder list is a CalDAV collection of `VTODO` items, so the list name
 * becomes the task's project and the todo itself supplies the rest. Completed
 * reminders are dropped rather than shown struck through: this feeds a
 * three-row widget on a glanceable display, where an open item is always worth
 * more than a finished one.
 */

export const ICLOUD_CALDAV_URL = "https://caldav.icloud.com";

// Discovery costs three round trips before a single reminder is read, and lists
// are not created or renamed often, so the result is held briefly per process.
const DISCOVERY_TTL_MS = 10 * 60 * 1000;
let discovered: { expiresAt: number; key: string; collections: Awaited<ReturnType<typeof discoverCollections>> } | null = null;

/**
 * RFC 5545 numbers priority 1 (highest) to 9 (lowest), and Reminders writes 1,
 * 5 and 9 for its High, Medium and Low. Anything absent or 0 is "no priority",
 * which has no equivalent in the dashboard's three-level scale — it maps to low
 * so that explicitly flagged reminders still stand out on the display.
 */
function toPriority(value: unknown): Task["priority"] {
  const priority = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(priority) || priority <= 0) return "low";
  if (priority <= 4) return "high";
  if (priority === 5) return "medium";
  return "low";
}

function toStatus(value: unknown): Task["status"] | null {
  switch (typeof value === "string" ? value.toUpperCase() : "") {
    case "COMPLETED": return "done";
    case "IN-PROCESS": return "in_progress";
    case "CANCELLED": return null; // Dropped: not done, but not worth showing either.
    default: return "todo";
  }
}

const text = (value: unknown): string | undefined => {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "val" in value) {
    const inner = (value as { val: unknown }).val;
    return typeof inner === "string" ? inner : undefined;
  }
  return undefined;
};

function parseTodos(icsText: string, project: string): Task[] {
  const parsed = ical.sync.parseICS(icsText);
  return Object.values(parsed).flatMap((component) => {
    const todo = component as { type?: string; uid?: unknown; summary?: unknown; status?: unknown; priority?: unknown; due?: unknown; completed?: unknown };
    if (todo.type !== "VTODO") return [];

    const status = toStatus(todo.status);
    // A reminder with a completion date but no STATUS still counts as done.
    if (status === null || status === "done" || todo.completed) return [];

    const title = text(todo.summary);
    if (!title) return [];
    const due = todo.due instanceof Date ? todo.due : todo.due ? new Date(String(todo.due)) : null;

    return [{
      id: text(todo.uid) ?? crypto.randomUUID(),
      title,
      status,
      priority: toPriority(todo.priority),
      dueAt: due && !Number.isNaN(due.getTime()) ? due.toISOString() : null,
      project,
    }];
  });
}

const priorityRank = { high: 0, medium: 1, low: 2 } as const;

export class AppleRemindersService implements TasksRemindersService {
  constructor(private readonly account: CalDavAccount, private readonly listNames: string[] = []) {}

  private async collections() {
    const key = `${this.account.username}|${this.listNames.join(",")}`;
    if (discovered && discovered.key === key && discovered.expiresAt > Date.now()) return discovered.collections;

    const all = await discoverCollections(this.account, "VTODO");
    // An empty filter means every reminder list; names are matched loosely so
    // the configured value does not have to match Apple's casing exactly.
    const wanted = this.listNames.length
      ? all.filter((collection) => this.listNames.some((name) => collection.displayName.toLowerCase() === name.toLowerCase()))
      : all;

    discovered = { expiresAt: Date.now() + DISCOVERY_TTL_MS, key, collections: wanted };
    return wanted;
  }

  async getTasks(): Promise<Task[]> {
    const collections = await this.collections();
    if (!collections.length) throw new Error("No matching iCloud reminder lists found");

    // One unreachable list should not blank the widget.
    const results = await Promise.allSettled(collections.map(async (collection) => {
      const objects = await fetchCollectionObjects(this.account, collection.url, "VTODO");
      return objects.flatMap((object) => parseTodos(object, collection.displayName || "Reminders"));
    }));

    const failures = results.filter((result): result is PromiseRejectedResult => result.status === "rejected");
    if (failures.length === collections.length) throw new Error(`All reminder lists failed: ${failures.map((failure) => String(failure.reason)).join("; ")}`);
    for (const failure of failures) console.error("[reminders] list failed:", failure.reason);

    const tasks = results.flatMap((result) => (result.status === "fulfilled" ? result.value : []));

    // The widget only shows the first few, so the most urgent have to sort to
    // the top: soonest due first, undated last, priority breaking ties.
    return tasks.sort((a, b) => {
      if (a.dueAt && b.dueAt) return a.dueAt.localeCompare(b.dueAt) || priorityRank[a.priority] - priorityRank[b.priority];
      if (a.dueAt) return -1;
      if (b.dueAt) return 1;
      return priorityRank[a.priority] - priorityRank[b.priority] || a.title.localeCompare(b.title);
    });
  }
}
