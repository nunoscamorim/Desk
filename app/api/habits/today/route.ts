import { materializeDay } from "@/lib/habits/schedule";
import { readHabitsStore } from "@/lib/habits/store";

export async function GET() {
  return Response.json(materializeDay(await readHabitsStore()), { headers: { "Cache-Control": "no-store" } });
}
