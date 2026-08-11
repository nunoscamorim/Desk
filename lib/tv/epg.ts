import { fetchWithRetry } from "@/lib/http/fetch-with-retry";
import { readFile } from "node:fs/promises";
import { readEpgSources, epgUploadPath, type EpgSource } from "./epg-store";
import { MAX_PROGRAMMES, parseXmltv, type EpgChannel, type EpgProgramme } from "./xmltv";

export type EpgSourceResult = {
  id: string;
  name: string;
  source: "url" | "upload";
  /** Host for a URL source, or a size summary for an upload. The full URL is
   *  never sent out: it may carry subscription credentials. */
  host: string;
  channelCount: number;
  programmeCount: number;
  truncated: boolean;
  error: string | null;
};

export type EpgSet = { channels: EpgChannel[]; programmes: EpgProgramme[]; sources: EpgSourceResult[] };

// Same budget as TV playlists (lib/tv/playlist.ts) — XMLTV feeds are at least
// as large, and this is the same class of "someone else's slow server" fetch.
const FETCH_TIMEOUT_MS = 45000;
const FETCH_BUDGET_MS = 90000;
const CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_BODY_BYTES = 40 * 1024 * 1024;

const cache = new Map<string, { expiresAt: number; channels: EpgChannel[]; programmes: EpgProgramme[]; truncated: boolean }>();

const hostOf = (url: string): string => { try { return new URL(url).host; } catch { return "invalid URL"; } };

const message = (error: unknown): string => (error instanceof Error ? error.message : String(error));

const oversized = (bytes: number) => new Error(`EPG file is ${Math.round(bytes / 1024 / 1024)} MB, over the ${MAX_BODY_BYTES / 1024 / 1024} MB limit`);

/** Short, safe summary of what a response actually contained. */
function describe(response: Response, body: string): string {
  const type = response.headers.get("content-type")?.split(";")[0]?.trim();
  const snippet = body.replace(/\s+/g, " ").trim().slice(0, 90);
  const parts = [type && `type ${type}`, snippet && `starts "${snippet}${body.length > 90 ? "…" : ""}"`].filter(Boolean);
  return parts.length ? ` — ${parts.join(", ")}` : "";
}

/** Uploads are read from disk; URL sources are fetched. */
async function readBody(source: EpgSource): Promise<string> {
  if (source.source === "upload") {
    try { return await readFile(epgUploadPath(source.file), "utf8"); }
    catch { throw new Error("Uploaded file is missing — re-upload it"); }
  }

  const response = await fetchWithRetry(source.url, { cache: "no-store", redirect: "follow", headers: { "user-agent": "VLC/3.0.20 LibVLC/3.0.20", accept: "*/*" } }, { label: `epg:${source.name}`, timeoutMs: FETCH_TIMEOUT_MS, budgetMs: FETCH_BUDGET_MS });

  if (!response.ok) throw new Error(`EPG request failed (${response.status} ${response.statusText || ""})`.trim() + describe(response, await response.text().catch(() => "")));

  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) throw oversized(declared);

  const body = await response.text();
  if (body.length > MAX_BODY_BYTES) throw oversized(body.length);
  if (!body.trim()) throw new Error(`EPG file is empty${describe(response, "")}`);
  return body;
}

async function loadOne(source: EpgSource): Promise<{ channels: EpgChannel[]; programmes: EpgProgramme[]; truncated: boolean }> {
  const cacheKey = source.source === "upload" ? `upload:${source.file}` : source.url;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached;

  const body = await readBody(source);
  const parsed = parseXmltv(body);
  if (parsed.channels.length === 0) throw new Error(`No channels found — received ${(body.length / 1024).toFixed(0)} KB starting "${body.replace(/\s+/g, " ").trim().slice(0, 90)}"`);

  cache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, ...parsed });
  return parsed;
}

/**
 * Loads every configured EPG source and merges them into one set.
 *
 * Each source is loaded independently, so one dead or malformed feed drops
 * out with its reason attached instead of emptying the guide — the same
 * behaviour lib/tv/playlist.ts has for M3U playlists.
 */
export async function getEpg(): Promise<EpgSet> {
  const sources = await readEpgSources();
  const settled = await Promise.all(sources.map(async (source): Promise<{ result: EpgSourceResult; channels: EpgChannel[]; programmes: EpgProgramme[] }> => {
    const base = { id: source.id, name: source.name, source: source.source, host: source.source === "upload" ? `uploaded file · ${(source.bytes / 1024).toFixed(0)} KB` : hostOf(source.url) };
    try {
      const { channels, programmes, truncated } = await loadOne(source);
      return { result: { ...base, channelCount: channels.length, programmeCount: programmes.length, truncated, error: null }, channels, programmes };
    } catch (error) {
      console.warn(`[tv] EPG source "${source.name}" failed: ${message(error)}`);
      return { result: { ...base, channelCount: 0, programmeCount: 0, truncated: false, error: message(error) }, channels: [], programmes: [] };
    }
  }));

  const channels = settled.flatMap(({ channels: list }) => list);
  const programmes = settled.flatMap(({ programmes: list }) => list).slice(0, MAX_PROGRAMMES);
  return { channels, programmes, sources: settled.map(({ result }) => result) };
}

/** Drops cached EPG bodies so the next read re-fetches. */
export function invalidateEpgCache() { cache.clear(); }

export type NowPlaying = { title: string; stop: string };

/**
 * The programme airing right now on each EPG channel id, keyed the same way
 * an M3U channel's tvg-id would be — for annotating the TV screen's channel
 * tiles with what's actually on. Reuses getEpg()'s own cache, so calling this
 * per-request is cheap rather than needing a cache layer of its own.
 */
export async function getNowPlayingByChannel(): Promise<Record<string, NowPlaying>> {
  const { programmes } = await getEpg();
  const now = Date.now();
  const result: Record<string, NowPlaying> = {};
  for (const programme of programmes) {
    const start = Date.parse(programme.start);
    const stop = Date.parse(programme.stop);
    if (Number.isNaN(start) || Number.isNaN(stop) || start > now || now >= stop) continue;
    // A messy feed can carry overlapping entries for one channel; the first
    // match wins rather than picking "latest start" — good enough for a
    // preview annotation, not a scheduling authority.
    if (!(programme.channelId in result)) result[programme.channelId] = { title: programme.title, stop: programme.stop };
  }
  return result;
}
