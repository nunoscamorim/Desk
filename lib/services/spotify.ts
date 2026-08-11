import type { SpotifyNowPlaying, SpotifyRecentTrack } from "@/lib/dashboard/types";
export interface SpotifyService { getNowPlaying(): Promise<SpotifyNowPlaying | null>; getRecentlyPlayed(): Promise<SpotifyRecentTrack[]>; }
const MOCK_RECENTLY_PLAYED: Array<{ id: string; track: string; artist: string; minutesAgo: number }> = [
  { id: "track-blinding-lights", track: "Blinding Lights", artist: "The Weeknd", minutesAgo: 35 },
  { id: "track-electric-feel", track: "Electric Feel", artist: "MGMT", minutesAgo: 58 },
  { id: "track-redbone", track: "Redbone", artist: "Childish Gambino", minutesAgo: 80 },
  { id: "track-instant-crush", track: "Instant Crush", artist: "Daft Punk ft. Julian Casablancas", minutesAgo: 112 },
  { id: "track-nights", track: "Nights", artist: "Frank Ocean", minutesAgo: 140 },
  { id: "track-heat-waves", track: "Heat Waves", artist: "Glass Animals", minutesAgo: 175 },
];
export class MockSpotifyService implements SpotifyService {
  async getNowPlaying(): Promise<SpotifyNowPlaying> { return { isPlaying: true, track: "Midnight City", artist: "M83", album: "Hurry Up, We're Dreaming", progressMs: 141000, durationMs: 244000, artworkUrl: null }; }
  async getRecentlyPlayed(): Promise<SpotifyRecentTrack[]> { return MOCK_RECENTLY_PLAYED.map((entry) => ({ id: entry.id, track: entry.track, artist: entry.artist, artworkUrl: null, playedAt: new Date(Date.now() - entry.minutesAgo * 60_000).toISOString() })); }
}
