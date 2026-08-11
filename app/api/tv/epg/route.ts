import { randomUUID } from "node:crypto";
import { pruneEpgUploads, readEpgSources, writeEpgSources, type EpgSource } from "@/lib/tv/epg-store";
import { getEpg, invalidateEpgCache } from "@/lib/tv/epg";
import { isAdminAuthenticated, isPasswordConfigured } from "@/lib/auth";

async function guard() { return !isPasswordConfigured() || (await isAdminAuthenticated()); }

/**
 * Reports the configured EPG sources and how each one is doing.
 *
 * Only the name and a source summary go out — never a URL, which may carry
 * subscription credentials the same way an M3U playlist URL does.
 */
export async function GET(request: Request) {
  if (!(await guard())) return Response.json({ error: "Authentication required" }, { status: 401 });
  // ?refresh=1 drops the cached bodies first, so re-checking a source that
  // failed actually re-contacts the host instead of replaying the last answer.
  if (new URL(request.url).searchParams.get("refresh")) invalidateEpgCache();
  const { sources } = await getEpg();
  return Response.json({ sources });
}

/**
 * Replaces the EPG source list. This is how removal happens: the admin sends
 * back the entries it wants kept, and anything absent is dropped — and any
 * upload file it referenced is deleted from disk with it.
 */
export async function PUT(request: Request) {
  if (!(await guard())) return Response.json({ error: "Authentication required" }, { status: 401 });
  const body = await request.json().catch(() => ({})) as { sources?: Array<{ id?: string; name?: string; url?: string }> };
  if (!Array.isArray(body.sources)) return Response.json({ error: "sources must be an array" }, { status: 400 });

  const existing = await readEpgSources();
  const next: EpgSource[] = [];

  for (const entry of body.sources) {
    const name = (typeof entry.name === "string" && entry.name.trim()) || "EPG source";
    const saved = existing.find((item) => item.id === entry.id);

    // An entry with no url is one the admin sent back unchanged — it never
    // received the real one, so it is matched to what is already stored. That
    // is also the only way an upload survives a save.
    if (!entry.url?.trim()) { if (saved) next.push({ ...saved, name }); continue; }

    const url = entry.url.trim();
    try { const parsed = new URL(url); if (parsed.protocol !== "http:" && parsed.protocol !== "https:") continue; } catch { continue; }
    next.push({ id: saved?.id ?? entry.id ?? randomUUID(), name, source: "url", url });
  }

  await writeEpgSources(next);
  await pruneEpgUploads(next);
  invalidateEpgCache();
  const { sources } = await getEpg();
  return Response.json({ sources });
}
