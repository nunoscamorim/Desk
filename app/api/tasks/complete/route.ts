import { buildTasksService } from "@/lib/dashboard/get-dashboard";
import { getServiceConfiguration } from "@/lib/services/config";

/**
 * Marks a task done at its source.
 *
 * Open the same way GET /api/dashboard is: this only ever runs from the
 * kiosk or the live dashboard the account owner is already looking at, and a
 * task's title carries no more of a secret than the rest of that screen does.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { id?: string; listId?: string | null };
  if (!body.id) return Response.json({ error: "id is required" }, { status: 400 });

  const service = await buildTasksService(getServiceConfiguration());
  try {
    await service.completeTask(body.id, body.listId ?? null);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not complete the task" }, { status: 502 });
  }
}
