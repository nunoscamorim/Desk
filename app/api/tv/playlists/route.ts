import { randomUUID } from "node:crypto";
import { pruneUploads, readPlaylists, writePlaylists, type Playlist } from "@/lib/tv/playlist-store";
import { getChannels, invalidatePlaylistCache } from "@/lib/tv/playlist";
import { isAdminAuthenticated, isPasswordConfigured } from "@/lib/auth";

async function guard() { return !isPasswordConfigured() || (await isAdminAuthenticated()); }

/**
 * Reports the configured playlists and how each one is doing.
 *
 * Only the name and a source summary go out — never a URL, which carries the
 * subscription credentials. The admin panel does not need it back to edit the
 * list, and a saved secret that can be read again is a secret waiting to leak.
 */
export async function GET(request: Request) {
  if (!(await guard())) return Response.json({ error: "Authentication required" }, { status: 401 });
  // ?refresh=1 drops the cached bodies first, so re-checking a playlist that
  // failed actually re-contacts the host instead of replaying the last answer.
  if (new URL(request.url).searchParams.get("refresh")) invalidatePlaylistCache();
  const { playlists } = await getChannels();
  return Response.json({ playlists });
}

/**
 * Replaces the playlist list. This is how removal happens: the admin sends back
 * the entries it wants kept, and anything absent is dropped — and any upload
 * file it referenced is deleted from disk with it.
 */
export async function PUT(request: Request) {
  if (!(await guard())) return Response.json({ error: "Authentication required" }, { status: 401 });
  const body = await request.json().catch(() => ({})) as { playlists?: Array<{ id?: string; name?: string; url?: string; source?: "url" | "xtream"; server?: string; username?: string; password?: string; categories?: string[]; channels?: string[] }> };
  if (!Array.isArray(body.playlists)) return Response.json({ error: "playlists must be an array" }, { status: 400 });

  const existing = await readPlaylists();
  const next: Playlist[] = [];

  for (const entry of body.playlists) {
    const name = (typeof entry.name === "string" && entry.name.trim()) || "Playlist";
    const saved = existing.find((item) => item.id === entry.id);

    // An entry with no url is one the admin sent back unchanged — it never
    // received the real one, so it is matched to what is already stored. That
    // is also the only way an upload survives a save.
    if (!entry.url?.trim() && entry.source !== "xtream") { if (saved) next.push({ ...saved, name }); continue; }

    if (entry.source === "xtream") {
      const server = entry.server?.trim() ?? "";
      const username = entry.username?.trim() ?? "";
      const password = entry.password?.trim() ?? "";
      try { const parsed = new URL(server); if (parsed.protocol !== "http:" && parsed.protocol !== "https:") continue; } catch { continue; }
      if (!username || !password) continue;
      next.push({ id: saved?.id ?? entry.id ?? randomUUID(), name, source: "xtream", server, username, password, categories: Array.isArray(entry.categories) ? entry.categories.map((value) => value.trim()).filter(Boolean) : [], channels: Array.isArray(entry.channels) ? entry.channels.map((value) => value.trim()).filter(Boolean) : [] });
      continue;
    }

    const url = entry.url?.trim();
    if (!url) continue;
    try { const parsed = new URL(url); if (parsed.protocol !== "http:" && parsed.protocol !== "https:") continue; } catch { continue; }
    next.push({ id: saved?.id ?? entry.id ?? randomUUID(), name, source: "url", url });
  }

  await writePlaylists(next);
  await pruneUploads(next);
  invalidatePlaylistCache();
  const { playlists } = await getChannels();
  return Response.json({ playlists });
}
