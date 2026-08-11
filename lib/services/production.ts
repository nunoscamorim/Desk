import { fetchWithRetry } from "@/lib/http/fetch-with-retry";
import type { SpotifyNowPlaying, SpotifyRecentTrack, Weather } from "@/lib/dashboard/types";
import type { CoolifyService, CoolifyStatus } from "./coolify";
import type { SpotifyService } from "./spotify";
import type { WeatherService } from "./weather";

const weatherCondition = (code: number) => {
  if (code === 0) return "Clear";
  if (code <= 2) return "Partly cloudy";
  if (code === 3) return "Overcast";
  if (code === 45 || code === 48) return "Fog";
  if (code >= 51 && code <= 57) return "Drizzle";
  if (code >= 61 && code <= 67) return "Rain";
  if (code >= 71 && code <= 77) return "Snow";
  if (code >= 80 && code <= 82) return "Rain showers";
  if (code === 85 || code === 86) return "Snow showers";
  if (code >= 95) return "Thunderstorm";
  return "Unknown";
};

export class OpenMeteoApiService implements WeatherService {
  constructor(
    private readonly location = "Leça do Balio",
    private readonly latitude = 41.2077,
    private readonly longitude = -8.6224,
  ) {}

  async getCurrentWeather(): Promise<Weather> {
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.search = new URLSearchParams({
      latitude: String(this.latitude),
      longitude: String(this.longitude),
      current: "temperature_2m,apparent_temperature,weather_code",
      daily: "temperature_2m_max,temperature_2m_min",
      forecast_days: "1",
      timezone: "auto",
    }).toString();
    const response = await fetchWithRetry(url, { cache: "no-store" }, { label: "open-meteo" });
    if (!response.ok) throw new Error(`Weather request failed (${response.status})`);
    const data = await response.json() as {
      current: { temperature_2m: number; apparent_temperature: number; weather_code: number };
      daily: { temperature_2m_max: number[]; temperature_2m_min: number[] };
    };
    return {
      location: this.location,
      temperatureC: Math.round(data.current.temperature_2m),
      feelsLikeC: Math.round(data.current.apparent_temperature),
      condition: weatherCondition(data.current.weather_code),
      highC: Math.round(data.daily.temperature_2m_max[0]),
      lowC: Math.round(data.daily.temperature_2m_min[0]),
    };
  }
}

export class SpotifyApiService implements SpotifyService {
  constructor(private readonly getAccessToken: () => Promise<string | null>) {}
  async getNowPlaying(): Promise<SpotifyNowPlaying | null> {
    const accessToken = await this.getAccessToken();
    if (!accessToken) return null;
    const response = await fetchWithRetry("https://api.spotify.com/v1/me/player/currently-playing", { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" }, { label: "spotify-now-playing" });
    if (response.status === 204) return null;
    if (!response.ok) throw new Error(`Spotify request failed (${response.status})`);
    const data = await response.json() as { is_playing: boolean; progress_ms: number; item?: { name: string; duration_ms: number; artists?: Array<{ name: string }>; album?: { name: string; images?: Array<{ url: string }> } } };
    if (!data.item) return null;
    return { isPlaying: data.is_playing, track: data.item.name, artist: data.item.artists?.map((artist) => artist.name).join(", ") ?? "Unknown artist", album: data.item.album?.name ?? "", progressMs: data.progress_ms, durationMs: data.item.duration_ms, artworkUrl: data.item.album?.images?.[0]?.url ?? null };
  }

  // Spotify can list the same track more than once if it was replayed; deduped
  // by track id, keeping the first (most recent) occurrence, so the row reads
  // as distinct tracks rather than the same cover repeated.
  async getRecentlyPlayed(): Promise<SpotifyRecentTrack[]> {
    const accessToken = await this.getAccessToken();
    if (!accessToken) return [];
    const response = await fetchWithRetry("https://api.spotify.com/v1/me/player/recently-played?limit=10", { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" }, { label: "spotify-recently-played" });
    if (!response.ok) throw new Error(`Spotify request failed (${response.status})`);
    const data = await response.json() as { items?: Array<{ played_at: string; track: { id: string; name: string; artists?: Array<{ name: string }>; album?: { images?: Array<{ url: string }> } } }> };
    const seen = new Set<string>();
    const tracks: SpotifyRecentTrack[] = [];
    for (const item of data.items ?? []) {
      if (seen.has(item.track.id)) continue;
      seen.add(item.track.id);
      tracks.push({ id: item.track.id, track: item.track.name, artist: item.track.artists?.map((artist) => artist.name).join(", ") ?? "Unknown artist", artworkUrl: item.track.album?.images?.[0]?.url ?? null, playedAt: item.played_at });
      if (tracks.length >= 8) break;
    }
    return tracks;
  }
}

export class CoolifyApiService implements CoolifyService {
  constructor(private readonly baseUrl: string, private readonly token?: string) {}
  async getStatus(): Promise<CoolifyStatus> {
    try { const response = await fetchWithRetry(`${this.baseUrl.replace(/\/$/, "")}/api/v1/healthcheck`, { headers: this.token ? { Authorization: `Bearer ${this.token}` } : undefined, cache: "no-store" }, { label: "coolify-healthcheck" }); return { status: response.ok ? "online" : "offline", version: null, checkedAt: new Date().toISOString() }; } catch { return { status: "offline", version: null, checkedAt: new Date().toISOString() }; }
  }
}
