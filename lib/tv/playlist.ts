import { fetchWithRetry } from "@/lib/http/fetch-with-retry";
import { MAX_CHANNELS, parseM3u, type Channel } from "./m3u";
import { readFile } from "node:fs/promises";
import { readPlaylists, uploadPath, type Playlist } from "./playlist-store";

export type PlaylistResult = {
  id: string;
  name: string;
  source: "url" | "upload";
  /** Host for a URL playlist, or a size summary for an upload. The full URL is
   *  never sent out: it carries the subscription credentials. */
  host: string;
  channelCount: number;
  truncated: boolean;
  error: string | null;
};

export type ChannelSet = { channels: Channel[]; playlists: PlaylistResult[] };

// Public aggregate playlists are several megabytes, and the per-attempt timeout
// covers the whole body read, not just the connection — 8s was enough to reject
// a file that was downloading perfectly well.
const FETCH_TIMEOUT_MS = 45000;
const FETCH_BUDGET_MS = 90000;
// Playlists change rarely and are the largest thing this app downloads, so a
// short cache keeps a screen that is opened and closed repeatedly from
// re-pulling megabytes each time.
const CACHE_TTL_MS = 5 * 60 * 1000;
/**
 * Ceiling on the download, guarding memory rather than policing what kind of
 * playlist is acceptable. iptv-org's country index alone is around 6 MB, so a
 * limit tight enough to exclude it excludes most of what people actually have.
 */
const MAX_BODY_BYTES = 40 * 1024 * 1024;

const cache = new Map<string, { expiresAt: number; channels: Channel[]; truncated: boolean }>();

const hostOf = (url: string): string => { try { return new URL(url).host; } catch { return "invalid URL"; } };

const message = (error: unknown): string => (error instanceof Error ? error.message : String(error));

const oversized = (bytes: number) => new Error(`Playlist is ${Math.round(bytes / 1024 / 1024)} MB, over the ${MAX_BODY_BYTES / 1024 / 1024} MB limit`);

/** Uploads are read from disk; URL playlists are fetched. */
async function readBody(playlist: Playlist): Promise<string> {
  if (playlist.source === "upload") {
    try { return await readFile(uploadPath(playlist.file), "utf8"); }
    catch { throw new Error("Uploaded file is missing — re-upload it"); }
  }

  // Without a User-Agent this goes out identifying itself as Node, and a fair
  // number of public playlist hosts answer that with a 403 while serving the
  // same URL to a player. The proxy route already had to do this.
  const response = await fetchWithRetry(playlist.url, { cache: "no-store", redirect: "follow", headers: { "user-agent": "VLC/3.0.20 LibVLC/3.0.20", accept: "*/*" } }, { label: `tv:${playlist.name}`, timeoutMs: FETCH_TIMEOUT_MS, budgetMs: FETCH_BUDGET_MS });

  // A bare status code is not enough to act on: a refusal from the host, a
  // Cloudflare challenge and a login page all arrive as an error page, and only
  // what came back distinguishes them. The URL itself is never echoed — it
  // carries the subscription credentials.
  if (!response.ok) throw new Error(`Playlist request failed (${response.status} ${response.statusText || ""})`.trim() + describe(response, await response.text().catch(() => "")));

  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) throw oversized(declared);

  const body = await response.text();
  // Content-Length is advisory and often absent on generated playlists, so the
  // real size is checked again once it has actually arrived.
  if (body.length > MAX_BODY_BYTES) throw oversized(body.length);
  if (!body.trim()) throw new Error(`Playlist is empty${describe(response, "")}`);
  return body;
}

/** Short, safe summary of what a response actually contained. */
function describe(response: Response, body: string): string {
  const type = response.headers.get("content-type")?.split(";")[0]?.trim();
  const snippet = body.replace(/\s+/g, " ").trim().slice(0, 90);
  const parts = [type && `type ${type}`, snippet && `starts "${snippet}${body.length > 90 ? "…" : ""}"`].filter(Boolean);
  return parts.length ? ` — ${parts.join(", ")}` : "";
}

async function loadOne(playlist: Playlist): Promise<{ channels: Channel[]; truncated: boolean }> {
  const cacheKey = playlist.source === "upload" ? `upload:${playlist.file}` : playlist.url;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return { channels: cached.channels, truncated: cached.truncated };

  const body = await readBody(playlist);
  const parsed = parseM3u(body);
  // Saying what did arrive turns "no channels" from a dead end into something
  // actionable: an HTML page here means the host served something other than
  // the playlist, which is a different problem from a playlist that parsed badly.
  if (parsed.channels.length === 0) throw new Error(`No channels found — received ${(body.length / 1024).toFixed(0)} KB starting "${body.replace(/\s+/g, " ").trim().slice(0, 90)}"`);

  cache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, channels: parsed.channels, truncated: parsed.truncated });
  return parsed;
}

/**
 * Loads every configured playlist and merges them into one channel list.
 *
 * Each playlist is loaded independently, so one dead or malformed URL drops out
 * with its reason attached instead of emptying the screen — the same behaviour
 * the iCalendar backend has for feeds, and for the same reason: these are other
 * people's servers and one of them is usually down.
 */
export async function getChannels(): Promise<ChannelSet> {
  const playlists = await readPlaylists();
  const settled = await Promise.all(playlists.map(async (playlist): Promise<{ result: PlaylistResult; channels: Channel[] }> => {
    const base = { id: playlist.id, name: playlist.name, source: playlist.source, host: playlist.source === "upload" ? `uploaded file · ${(playlist.bytes / 1024).toFixed(0)} KB` : hostOf(playlist.url) };
    try {
      const { channels, truncated } = await loadOne(playlist);
      return { result: { ...base, channelCount: channels.length, truncated, error: null }, channels };
    } catch (error) {
      console.warn(`[tv] playlist "${playlist.name}" failed: ${message(error)}`);
      return { result: { ...base, channelCount: 0, truncated: false, error: message(error) }, channels: [] };
    }
  }));

  // Playlist ids prefix channel ids so two playlists carrying the same channel
  // stay separately selectable rather than colliding on a React key.
  const channels = settled.flatMap(({ result, channels: list }) => list.map((channel) => ({ ...channel, id: `${result.id}:${channel.id}` }))).slice(0, MAX_CHANNELS);
  return { channels, playlists: settled.map(({ result }) => result) };
}

/** Drops cached playlist bodies so the next read re-fetches. */
export function invalidatePlaylistCache() { cache.clear(); }
