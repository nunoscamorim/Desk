import type { SpotifyNowPlaying } from "@/lib/dashboard/types";
export interface SpotifyService { getNowPlaying(): Promise<SpotifyNowPlaying | null>; }
export class MockSpotifyService implements SpotifyService { async getNowPlaying(): Promise<SpotifyNowPlaying> { return { isPlaying: true, track: "Midnight City", artist: "M83", album: "Hurry Up, We're Dreaming", progressMs: 141000, durationMs: 244000, artworkUrl: null }; } }
