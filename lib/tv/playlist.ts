import { fetchWithRetry } from "@/lib/http/fetch-with-retry";
import { MAX_CHANNELS, parseM3u, type Channel } from "./m3u";
import { readPlaylists, type Playlist } from "./playlist-store";

export type PlaylistResult = {
  id: string;
  name: string;
  /** Host only — the full URL carries the subscription credentials. */
  host: string;
  channelCount: number;
  truncated: boolean;
  error: string | null;
};

export type ChannelSet = { channels: Channel[]; playlists: PlaylistResult[] };

const FETCH_TIMEOUT_MS = 8000;
const FETCH_BUDGET_MS = 15000;
// Playlists change rarely and are the largest thing this app downloads, so a
// short cache keeps a screen that is opened and closed repeatedly from
// re-pulling megabytes each time.
const CACHE_TTL_MS = 5 * 60 * 1000;
/**
 * A curated playlist is kilobytes. Anything approaching this is a full provider
 * dump, and buffering it whole would cost more memory than the parse is worth —
 * so it is refused before it is read rather than after.
 */
const MAX_BODY_BYTES = 5 * 1024 * 1024;

const cache = new Map<string, { expiresAt: number; channels: Channel[]; truncated: boolean }>();

const hostOf = (url: string): string => { try { return new URL(url).host; } catch { return "invalid URL"; } };

const message = (error: unknown): string => (error instanceof Error ? error.message : String(error));

async function loadOne(playlist: Playlist): Promise<{ channels: Channel[]; truncated: boolean }> {
  const cached = cache.get(playlist.url);
  if (cached && cached.expiresAt > Date.now()) return { channels: cached.channels, truncated: cached.truncated };

  const response = await fetchWithRetry(playlist.url, { cache: "no-store" }, { label: `tv:${playlist.name}`, timeoutMs: FETCH_TIMEOUT_MS, budgetMs: FETCH_BUDGET_MS });
  if (!response.ok) throw new Error(`Playlist request failed (${response.status})`);

  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) throw new Error(`Playlist is ${Math.round(declared / 1024 / 1024)} MB — too large for this screen, use a curated list`);

  const body = await response.text();
  // Content-Length is advisory and often absent on generated playlists, so the
  // real size is checked again once it has actually arrived.
  if (body.length > MAX_BODY_BYTES) throw new Error(`Playlist is ${Math.round(body.length / 1024 / 1024)} MB — too large for this screen, use a curated list`);

  const parsed = parseM3u(body);
  if (parsed.channels.length === 0) throw new Error("No channels found — is this an M3U playlist?");

  cache.set(playlist.url, { expiresAt: Date.now() + CACHE_TTL_MS, channels: parsed.channels, truncated: parsed.truncated });
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
    const base = { id: playlist.id, name: playlist.name, host: hostOf(playlist.url) };
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
