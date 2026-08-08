import type { SpotifyNowPlaying, Weather } from "@/lib/dashboard/types";
import type { CoolifyService, CoolifyStatus } from "./coolify";
import type { SpotifyService } from "./spotify";
import type { WeatherService } from "./weather";

export class OpenWeatherApiService implements WeatherService {
  constructor(private readonly apiKey: string, private readonly location = "Leça do Balio") {}
  async getCurrentWeather(): Promise<Weather> {
    const response = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(this.location)}&units=metric&appid=${this.apiKey}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`Weather request failed (${response.status})`);
    const data = await response.json() as { name: string; main: { temp: number; feels_like: number; temp_max: number; temp_min: number }; weather?: Array<{ main?: string }> };
    return { location: data.name, temperatureC: Math.round(data.main.temp), feelsLikeC: Math.round(data.main.feels_like), condition: data.weather?.[0]?.main ?? "Unknown", highC: Math.round(data.main.temp_max), lowC: Math.round(data.main.temp_min) };
  }
}

export class SpotifyApiService implements SpotifyService {
  constructor(private readonly accessToken: string) {}
  async getNowPlaying(): Promise<SpotifyNowPlaying | null> {
    const response = await fetch("https://api.spotify.com/v1/me/player", { headers: { Authorization: `Bearer ${this.accessToken}` }, cache: "no-store" });
    if (response.status === 204) return null;
    if (!response.ok) throw new Error(`Spotify request failed (${response.status})`);
    const data = await response.json() as { is_playing: boolean; progress_ms: number; item?: { name: string; duration_ms: number; artists?: Array<{ name: string }>; album?: { name: string; images?: Array<{ url: string }> } } };
    if (!data.item) return null;
    return { isPlaying: data.is_playing, track: data.item.name, artist: data.item.artists?.map((artist) => artist.name).join(", ") ?? "Unknown artist", album: data.item.album?.name ?? "", progressMs: data.progress_ms, durationMs: data.item.duration_ms, artworkUrl: data.item.album?.images?.[0]?.url ?? null };
  }
}

export class CoolifyApiService implements CoolifyService {
  constructor(private readonly baseUrl: string, private readonly token?: string) {}
  async getStatus(): Promise<CoolifyStatus> {
    try { const response = await fetch(`${this.baseUrl.replace(/\/$/, "")}/api/v1/healthcheck`, { headers: this.token ? { Authorization: `Bearer ${this.token}` } : undefined, cache: "no-store" }); return { status: response.ok ? "online" : "offline", version: null, checkedAt: new Date().toISOString() }; } catch { return { status: "offline", version: null, checkedAt: new Date().toISOString() }; }
  }
}
