import { randomUUID } from "node:crypto";
import { readPlaylists, writePlaylists, type Playlist } from "@/lib/tv/playlist-store";
import { getChannels, invalidatePlaylistCache } from "@/lib/tv/playlist";
import { isAdminAuthenticated, isPasswordConfigured } from "@/lib/auth";

async function guard() { return !isPasswordConfigured() || (await isAdminAuthenticated()); }

/**
 * Reports the configured playlists and how each one is doing.
 *
 * Only the name and host go out — never the URL, which carries the subscription
 * credentials. The admin panel does not need it back to edit the list, and a
 * saved secret that can be read again is a secret waiting to be leaked.
 */
export async function GET() {
  if (!(await guard())) return Response.json({ error: "Authentication required" }, { status: 401 });
  const { playlists } = await getChannels();
  return Response.json({ playlists });
}

export async function PUT(request: Request) {
  if (!(await guard())) return Response.json({ error: "Authentication required" }, { status: 401 });
  const body = await request.json().catch(() => ({})) as { playlists?: Array<Partial<Playlist>> };
  if (!Array.isArray(body.playlists)) return Response.json({ error: "playlists must be an array" }, { status: 400 });

  const existing = await readPlaylists();
  const next: Playlist[] = [];
  for (const entry of body.playlists) {
    // An entry with no url is one the admin sent back unchanged — it never
    // received the real one, so it is matched to what is already stored.
    const url = typeof entry.url === "string" && entry.url.trim() ? entry.url.trim() : existing.find((item) => item.id === entry.id)?.url;
    if (!url) continue;
    try { const parsed = new URL(url); if (parsed.protocol !== "http:" && parsed.protocol !== "https:") continue; } catch { continue; }
    next.push({ id: typeof entry.id === "string" && entry.id ? entry.id : randomUUID(), name: (typeof entry.name === "string" && entry.name.trim()) || "Playlist", url });
  }

  await writePlaylists(next);
  invalidatePlaylistCache();
  const { playlists } = await getChannels();
  return Response.json({ playlists });
}
