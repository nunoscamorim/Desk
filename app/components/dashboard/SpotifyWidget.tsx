import type { SpotifyNowPlaying } from "@/lib/dashboard/types";
import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { formatDuration } from "./utils";

function SpotifyMark({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 1000 1000" aria-hidden="true"><path d="M519.837.402C243.895-10.566 11.324 204.227.402 480.167-10.566 756.108 204.273 988.632 480.168 999.6c275.941 10.969 508.465-203.823 519.433-479.764C1010.52 243.895 795.729 11.324 519.837.402ZM730.88 732.845c-6.214 10.969-18.325 16.454-30.117 14.809a29.814 29.814 0 0 1-10.6-3.612c-66.083-37.611-138.109-62.106-214.063-72.8-75.955-10.694-151.955-6.991-225.852 10.969-16.042 3.883-32.174-5.943-36.058-21.983-3.885-16.04 5.941-32.175 21.981-36.058 81.257-19.742 164.797-23.811 248.246-12.065 83.449 11.745 162.603 38.663 235.312 80.023 14.306 8.18 19.331 26.368 11.197 40.717h-.046Zm65.718-131.252c-10.192 18.829-33.772 25.869-52.6 15.677-77.326-41.817-161.049-69.283-248.841-81.623-87.792-12.337-175.809-9.003-261.682 9.872-4.661 1.006-9.277 1.188-13.756.548-15.584-2.194-28.928-13.8-32.493-30.117-4.616-20.928 8.638-41.631 29.569-46.249 94.918-20.885 192.216-24.585 289.193-10.968 96.932 13.62 189.475 43.966 274.935 90.214 18.875 10.192 25.866 33.726 15.675 52.601v.045Zm72.849-147.932c-9.598 18.463-29.569 28.015-49.038 25.272a49.717 49.717 0 0 1-15.403-4.934c-90.028-46.843-187.006-77.784-288.232-91.998-101.226-14.211-203.003-11.194-302.447 9.003-25.867 5.257-51.048-11.469-56.303-37.292-5.256-25.865 11.47-51.045 37.291-56.303 110.138-22.346 222.744-25.682 334.756-9.962 112.015 15.722 219.318 49.997 319.038 101.868 23.398 12.155 32.492 40.992 20.338 64.392v-.046Z" /></svg>;
}

function SpotifyLabel() {
  return <span className="card-label"><SpotifyMark /><span>Now playing</span></span>;
}

export function SpotifyWidget({ nowPlaying, expanded = false }: { nowPlaying: SpotifyNowPlaying | null; expanded?: boolean }) {
  const [elapsedMs, setElapsedMs] = useState(0);
  useEffect(() => {
    if (!nowPlaying?.isPlaying) return;
    const timer = window.setInterval(() => setElapsedMs((value) => Math.min(value + 1000, nowPlaying.durationMs - nowPlaying.progressMs)), 1000);
    return () => window.clearInterval(timer);
  }, [nowPlaying?.isPlaying, nowPlaying?.durationMs, nowPlaying?.progressMs]);
  const progressMs = nowPlaying ? Math.min(nowPlaying.progressMs + elapsedMs, nowPlaying.durationMs) : 0;
  const progress = nowPlaying ? (progressMs / nowPlaying.durationMs) * 100 : 0;
  return <article className={`card music-card ${expanded ? "music-screen-card" : ""}`}>{nowPlaying ? <>
    <div className={`album-art ${nowPlaying.artworkUrl ? "has-artwork" : ""}`} aria-label={`${nowPlaying.album} album cover`} style={nowPlaying.artworkUrl ? { backgroundImage: `url(${nowPlaying.artworkUrl})` } as CSSProperties : undefined}><span>♫</span></div><div className="spotify-info"><SpotifyLabel /><div className="track-copy"><h2>{nowPlaying.track}</h2><p>{nowPlaying.artist}</p></div>
    {expanded && <div className="music-screen-details"><span>{nowPlaying.album}</span><span>{nowPlaying.isPlaying ? "Playing" : "Paused"}</span></div>}<div className="spotify-playback">{expanded && <div className="music-screen-times"><span>{formatDuration(progressMs)}</span><span>{formatDuration(nowPlaying.durationMs)}</span></div>}<div className="track-progress" aria-label="Spotify progress" role="progressbar" aria-valuemin={0} aria-valuemax={nowPlaying.durationMs} aria-valuenow={progressMs}><span className="track-progress-fill" style={{ width: `${progress}%` }} /></div></div></div>
  </> : <div className="spotify-empty"><SpotifyLabel /><div className="spotify-empty-copy"><SpotifyMark className="spotify-empty-mark" /><strong>Nothing playing</strong><span>Spotify is quiet right now.</span></div></div>}</article>;
}
