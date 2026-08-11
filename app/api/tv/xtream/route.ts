import { isAdminAuthenticated, isPasswordConfigured } from "@/lib/auth";
import { fetchWithRetry } from "@/lib/http/fetch-with-retry";

async function guard() { return !isPasswordConfigured() || (await isAdminAuthenticated()); }

export async function POST(request: Request) {
  if (!(await guard())) return Response.json({ error: "Authentication required" }, { status: 401 });
  const body = await request.json().catch(() => ({})) as { server?: string; username?: string; password?: string };
  const server = body.server?.trim().replace(/\/+$/, "");
  const username = body.username?.trim();
  const password = body.password?.trim();
  if (!server || !username || !password) return Response.json({ error: "Server, username, and password are required" }, { status: 400 });
  try { const parsed = new URL(server); if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error("Server must use http or https"); } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Invalid server URL" }, { status: 400 }); }

  const params = { username, password };
  const read = async <T>(action: string) => { const api = new URL(`${server}/player_api.php`); api.search = new URLSearchParams({ ...params, action }).toString(); const response = await fetchWithRetry(api, { cache: "no-store" }, { label: `tv:xtream:${action}` }); if (!response.ok) throw new Error(`Xtream request failed (${response.status})`); return response.json() as Promise<T>; };
  try {
    const [categories, streams] = await Promise.all([read<Array<{ category_id?: string; category_name?: string }>>("get_live_categories"), read<Array<{ stream_id?: number; name?: string; category_id?: string; stream_icon?: string; container_extension?: string; stream_type?: string }>>("get_live_streams")]);
    const names = new Map(categories.map((category) => [String(category.category_id ?? ""), category.category_name?.trim() || "General"]));
    return Response.json({ groups: categories.map((category) => ({ id: String(category.category_id ?? ""), name: category.category_name?.trim() || "General" })).filter((category) => category.id), channels: streams.filter((stream) => Number.isFinite(stream.stream_id)).map((stream) => ({ id: String(stream.stream_id), name: stream.name?.trim() || "Untitled channel", groupId: String(stream.category_id ?? ""), group: names.get(String(stream.category_id ?? "")) ?? "General", logo: stream.stream_icon || null })) });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Could not load Xtream channels" }, { status: 502 }); }
}
