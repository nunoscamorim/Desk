import { buildSpotifyService } from "@/lib/dashboard/get-dashboard";
import { getServiceConfiguration } from "@/lib/services";
import type { SpotifyNowPlaying } from "@/lib/dashboard/types";

/**
 * Now playing, on its own endpoint.
 *
 * The dashboard payload is built from every integration at once and refreshes
 * on the display's configured interval, which is the right cadence for weather
 * and a calendar but far too slow for a track that changes every few minutes.
 * Polling this route instead keeps the music widget close to live without
 * dragging the rest of the dashboard — and its cost is one upstream request.
 */

// Collapses requests that arrive together — the ESP display is rarely the only
// viewer — so the upstream call rate stays flat however many are watching.
// Deliberately shorter than the client's polling interval: its job is to absorb
// concurrent viewers, not to throttle a single one into reading stale data.
const CACHE_TTL_MS = 1500;
// A failed poll serves the last good reading briefly rather than blanking the
// widget: a dropped request should not read as "nothing is playing".
const STALE_GRACE_MS = 30000;

let cache: { at: number; value: SpotifyNowPlaying | null } | null = null;

const json = (value: SpotifyNowPlaying | null) => Response.json(value, { headers: { "Cache-Control": "no-store" } });

export async function GET() {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return json(cache.value);

  try {
    const service = await buildSpotifyService(getServiceConfiguration());
    const value = await service.getNowPlaying();
    cache = { at: Date.now(), value };
    return json(value);
  } catch (error) {
    console.error("[spotify] now playing unavailable:", error instanceof Error ? error.message : error);
    if (cache && Date.now() - cache.at < STALE_GRACE_MS) return json(cache.value);
    return json(null);
  }
}
