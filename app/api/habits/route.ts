import { isAdminAuthenticated, isPasswordConfigured } from "@/lib/auth";
import { materializeDay } from "@/lib/habits/schedule";
import { mutateHabitsStore, normalizeHabit, readHabitsStore } from "@/lib/habits/store";
import type { Habit } from "@/lib/habits/types";

async function canManage() { return !isPasswordConfigured() || await isAdminAuthenticated(); }

export async function GET() {
  const store = await readHabitsStore();
  return Response.json({ habits: store.habits.sort((a, b) => a.order - b.order), today: materializeDay(store), history: store.occurrences.slice().sort((a, b) => b.scheduledFor.localeCompare(a.scheduledFor)).slice(0, 100) });
}
export async function POST(request: Request) {
  if (!(await canManage())) return Response.json({ error: "Authentication required" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const habit = await mutateHabitsStore((store) => {
    const next = normalizeHabit({ ...body, order: store.habits.length });
    store.habits.push(next);
    return next;
  });
  return Response.json(habit, { status: 201 });
}

export async function PATCH(request: Request) {
  if (!(await canManage())) return Response.json({ error: "Authentication required" }, { status: 401 });
  const body = await request.json().catch(() => ({})) as Partial<Habit> & { id?: string };
  if (!body.id) return Response.json({ error: "id is required" }, { status: 400 });
  const habit = await mutateHabitsStore((store) => {
    const index = store.habits.findIndex((item) => item.id === body.id);
    if (index < 0) return null;
    store.habits[index] = normalizeHabit(body, store.habits[index]);
    return store.habits[index];
  });
  return habit ? Response.json(habit) : Response.json({ error: "Habit not found" }, { status: 404 });
}

export async function DELETE(request: Request) {
  if (!(await canManage())) return Response.json({ error: "Authentication required" }, { status: 401 });
  const body = await request.json().catch(() => ({})) as { id?: string };
  if (!body.id) return Response.json({ error: "id is required" }, { status: 400 });
  const removed = await mutateHabitsStore((store) => {
    const present = store.habits.some((item) => item.id === body.id);
    store.habits = store.habits.filter((item) => item.id !== body.id);
    return present;
  });
  return removed ? Response.json({ ok: true }) : Response.json({ error: "Habit not found" }, { status: 404 });
}
