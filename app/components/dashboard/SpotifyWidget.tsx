import type { SpotifyNowPlaying } from "@/lib/dashboard/types";
import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { formatDuration } from "./utils";

export function SpotifyWidget({ nowPlaying }: { nowPlaying: SpotifyNowPlaying | null }) {
  const [elapsedMs, setElapsedMs] = useState(0);
  useEffect(() => {
    if (!nowPlaying?.isPlaying) return;
    const timer = window.setInterval(() => setElapsedMs((value) => Math.min(value + 1000, nowPlaying.durationMs - nowPlaying.progressMs)), 1000);
    return () => window.clearInterval(timer);
  }, [nowPlaying?.isPlaying, nowPlaying?.durationMs, nowPlaying?.progressMs]);
  const progressMs = nowPlaying ? Math.min(nowPlaying.progressMs + elapsedMs, nowPlaying.durationMs) : 0;
  const progress = nowPlaying ? (progressMs / nowPlaying.durationMs) * 100 : 0;
  return <article className="card music-card"><span className="card-label">Now playing</span>{nowPlaying ? <>
    <div className={`album-art ${nowPlaying.artworkUrl ? "has-artwork" : ""}`} aria-label={`${nowPlaying.album} album cover`} style={nowPlaying.artworkUrl ? { backgroundImage: `url(${nowPlaying.artworkUrl})` } as CSSProperties : undefined}><span>♫</span></div><div className="track-copy"><h2>{nowPlaying.track}</h2><p>{nowPlaying.artist}</p><small>{nowPlaying.album}</small></div>
    <div className="track-progress" aria-label="Spotify progress" role="progressbar" aria-valuemin={0} aria-valuemax={nowPlaying.durationMs} aria-valuenow={progressMs}><span style={{ width: `${progress}%` }} /></div><div className="track-times"><span>{formatDuration(progressMs)}</span><span>{formatDuration(nowPlaying.durationMs)}</span></div>
  </> : <div className="empty-state">Spotify is quiet.</div>}</article>;
}
