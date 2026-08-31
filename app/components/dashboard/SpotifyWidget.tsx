import type { SpotifyNowPlaying } from "@/lib/dashboard/types";
import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { formatDuration } from "./utils";

function SpotifyMark({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 1000 1000" aria-hidden="true"><path d="M519.837.402C243.895-10.566 11.324 204.227.402 480.167-10.566 756.108 204.273 988.632 480.168 999.6c275.941 10.969 508.465-203.823 519.433-479.764C1010.52 243.895 795.729 11.324 519.837.402ZM730.88 732.845c-6.214 10.969-18.325 16.454-30.117 14.809a29.814 29.814 0 0 1-10.6-3.612c-66.083-37.611-138.109-62.106-214.063-72.8-75.955-10.694-151.955-6.991-225.852 10.969-16.042 3.883-32.174-5.943-36.058-21.983-3.885-16.04 5.941-32.175 21.981-36.058 81.257-19.742 164.797-23.811 248.246-12.065 83.449 11.745 162.603 38.663 235.312 80.023 14.306 8.18 19.331 26.368 11.197 40.717h-.046Zm65.718-131.252c-10.192 18.829-33.772 25.869-52.6 15.677-77.326-41.817-161.049-69.283-248.841-81.623-87.792-12.337-175.809-9.003-261.682 9.872-4.661 1.006-9.277 1.188-13.756.548-15.584-2.194-28.928-13.8-32.493-30.117-4.616-20.928 8.638-41.631 29.569-46.249 94.918-20.885 192.216-24.585 289.193-10.968 96.932 13.62 189.475 43.966 274.935 90.214 18.875 10.192 25.866 33.726 15.675 52.601v.045Zm72.849-147.932c-9.598 18.463-29.569 28.015-49.038 25.272a49.717 49.717 0 0 1-15.403-4.934c-90.028-46.843-187.006-77.784-288.232-91.998-101.226-14.211-203.003-11.194-302.447 9.003-25.867 5.257-51.048-11.469-56.303-37.292-5.256-25.865 11.47-51.045 37.291-56.303 110.138-22.346 222.744-25.682 334.756-9.962 112.015 15.722 219.318 49.997 319.038 101.868 23.398 12.155 32.492 40.992 20.338 64.392v-.046Z" /></svg>;
}

function SpotifyLabel() {
  return <span className="card-label"><SpotifyMark /><span>Now</span></span>;
}

function TransportIcon({ name }: { name: "previous" | "play" | "pause" | "next" | "shuffle" | "repeat" }) {
  if (name === "play") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 11 7-11 7V5Z" /></svg>;
  if (name === "pause") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h4v14H7V5Zm6 0h4v14h-4V5Z" /></svg>;
  if (name === "next") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 5 9 7-9 7V5Zm10 0h4v14h-4V5Z" /></svg>;
  if (name === "shuffle") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 3h5v5h-2V6.4l-3.3 3.3-1.4-1.4L17.6 5H16V3ZM3 6h3.2c1.1 0 2.2.5 3 1.4l6.6 7.3c.4.4.9.7 1.5.7H19v-2h2v4h-5v-2h1.3c-1.1 0-2.2-.5-3-1.4L7.7 8.7c-.4-.4-.9-.7-1.5-.7H3V6Zm0 12v-2h3.2c.6 0 1.1-.2 1.5-.7l1.2-1.3 1.4 1.4-1.2 1.3c-.8.9-1.9 1.3-3 1.3H3Zm11.1-8.6 1.4-1.4 2 2H21v2h-4.3l-2.6-2.6Z" /></svg>;
  if (name === "repeat") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h10l-2-2 1.4-1.4L21.8 7l-5.4 5.4L15 11l2-2H7a2 2 0 0 0-2 2v1H3v-1a4 4 0 0 1 4-4Zm10 14H7l2 2-1.4 1.4L2.2 17l5.4-5.4L9 13l-2 2h10a2 2 0 0 0 2-2v-1h2v1a4 4 0 0 1-4 4Z" /></svg>;
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m19 5-9 7 9 7V5ZM5 5h4v14H5V5Z" /></svg>;
}

function SpotifyControls({ isPlaying }: { isPlaying: boolean }) {
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState(false);
  const send = async (action: "play" | "pause" | "next" | "previous" | "shuffle" | "repeat", value?: boolean | "context" | "off") => {
    setPending(action);
    setError(false);
    try {
      const response = await fetch("/api/spotify/control", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, value }) });
      if (!response.ok) throw new Error();
      if (action === "shuffle") setShuffle(value === true);
      if (action === "repeat") setRepeat(value === "context");
      window.dispatchEvent(new CustomEvent("spotify:refresh"));
    } catch {
      setError(true);
    } finally { setPending(null); }
  };
  const busy = pending !== null;
  const toggleAction: "play" | "pause" = isPlaying ? "pause" : "play";
  return <div className="spotify-controls" aria-label="Playback controls">
    <button type="button" className={`spotify-control utility ${shuffle ? "active" : ""}`} aria-label={shuffle ? "Turn shuffle off" : "Turn shuffle on"} aria-pressed={shuffle} disabled={busy} onClick={() => void send("shuffle", !shuffle)}><TransportIcon name="shuffle" /></button>
    <div className="spotify-transport">
      <button type="button" className="spotify-control secondary" aria-label="Previous track" disabled={busy} onClick={() => void send("previous")}><TransportIcon name="previous" /></button>
      <button type="button" className="spotify-control primary" aria-label={isPlaying ? "Pause" : "Play"} disabled={busy} onClick={() => void send(toggleAction)}><TransportIcon name={toggleAction} /></button>
      <button type="button" className="spotify-control secondary" aria-label="Next track" disabled={busy} onClick={() => void send("next")}><TransportIcon name="next" /></button>
    </div>
    <button type="button" className={`spotify-control utility ${repeat ? "active" : ""}`} aria-label={repeat ? "Turn repeat off" : "Turn repeat on"} aria-pressed={repeat} disabled={busy} onClick={() => void send("repeat", repeat ? "off" : "context")}><TransportIcon name="repeat" /></button>
    {error && <span className="spotify-control-error" role="status">Couldn’t control Spotify</span>}
  </div>;
}

/**
 * Advances the bar between polls.
 *
 * The caller keys this on the reading it came from, so every new poll remounts
 * it and the count restarts from the server's own figure. That is what keeps
 * the bar honest: without it the locally counted seconds would be added on top
 * of each fresh reading and the position would run away from the real track.
 */
function TrackProgress({ progressMs, durationMs, isPlaying, expanded }: { progressMs: number; durationMs: number; isPlaying: boolean; expanded: boolean }) {
  const [elapsedMs, setElapsedMs] = useState(0);
  useEffect(() => {
    if (!isPlaying) return;
    const timer = window.setInterval(() => setElapsedMs((value) => value + 1000), 1000);
    return () => window.clearInterval(timer);
  }, [isPlaying]);

  const current = Math.min(progressMs + elapsedMs, durationMs);
  const percent = durationMs > 0 ? (current / durationMs) * 100 : 0;
  return <div className="spotify-playback">
    {expanded && <div className="music-screen-times"><span>{formatDuration(current)}</span><span>{formatDuration(durationMs)}</span></div>}
    <div className="track-progress" aria-label="Spotify progress" role="progressbar" aria-valuemin={0} aria-valuemax={durationMs} aria-valuenow={current}><span className="track-progress-fill" style={{ width: `${percent}%` }} /></div>
  </div>;
}

const DEFAULT_ALBUM_TINT = "rgba(255, 255, 255, 0.03)";

/**
 * Samples the dominant color of the current artwork for the expanded screen's
 * background wash, keyed to the artwork it was computed for rather than reset
 * up front. Resetting synchronously at the top of the effect would mean every
 * dependency change forces an extra render before the real state settles; here
 * the render itself falls back to the default the moment the artwork no longer
 * matches what the stored tint was computed for, and a `cancelled` guard stops
 * a slow image load from overwriting a newer track's tint if it resolves late.
 */
function useAlbumTint(artworkUrl: string | null | undefined, expanded: boolean): string {
  const [tint, setTint] = useState<{ artworkUrl: string; expanded: boolean; color: string } | null>(null);
  useEffect(() => {
    if (!expanded || !artworkUrl) return;
    let cancelled = false;
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.src = artworkUrl;
    image.onload = () => {
      if (cancelled) return;
      const canvas = document.createElement("canvas");
      canvas.width = 32;
      canvas.height = 32;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) return;
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      try {
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
        const buckets = new Map<string, { count: number; red: number; green: number; blue: number }>();
        for (let index = 0; index < pixels.length; index += 16) {
          const alpha = pixels[index + 3];
          if (alpha < 128) continue;
          const red = pixels[index];
          const green = pixels[index + 1];
          const blue = pixels[index + 2];
          const key = `${red >> 5}-${green >> 5}-${blue >> 5}`;
          const bucket = buckets.get(key) ?? { count: 0, red: 0, green: 0, blue: 0 };
          bucket.count += 1;
          bucket.red += red;
          bucket.green += green;
          bucket.blue += blue;
          buckets.set(key, bucket);
        }
        const dominant = [...buckets.values()].sort((left, right) => right.count - left.count)[0];
        const color = dominant ? `rgba(${Math.round(dominant.red / dominant.count)}, ${Math.round(dominant.green / dominant.count)}, ${Math.round(dominant.blue / dominant.count)}, 0.72)` : DEFAULT_ALBUM_TINT;
        if (!cancelled) setTint({ artworkUrl, expanded, color });
      } catch {
        if (!cancelled) setTint({ artworkUrl, expanded, color: DEFAULT_ALBUM_TINT });
      }
    };
    return () => { cancelled = true; };
  }, [artworkUrl, expanded]);
  return tint && tint.artworkUrl === artworkUrl && tint.expanded === expanded ? tint.color : DEFAULT_ALBUM_TINT;
}

export function SpotifyWidget({ nowPlaying, expanded = false }: { nowPlaying: SpotifyNowPlaying | null; expanded?: boolean }) {
  const albumTint = useAlbumTint(nowPlaying?.artworkUrl, expanded);
  return <article className={`card music-card ${expanded ? "music-screen-card" : ""}`} style={expanded ? { "--album-tint": albumTint } as CSSProperties : undefined}>{nowPlaying ? <>
    {expanded ? <div className="music-artwork-frame"><div className={`album-art ${nowPlaying.artworkUrl ? "has-artwork" : ""}`} aria-label={`${nowPlaying.album} album cover`} style={nowPlaying.artworkUrl ? { backgroundImage: `url(${nowPlaying.artworkUrl})` } as CSSProperties : undefined}><span>♫</span></div></div> : <div className={`album-art ${nowPlaying.artworkUrl ? "has-artwork" : ""}`} aria-label={`${nowPlaying.album} album cover`} style={nowPlaying.artworkUrl ? { backgroundImage: `url(${nowPlaying.artworkUrl})` } as CSSProperties : undefined}><span>♫</span></div>}<div className="spotify-info"><SpotifyLabel /><div className="track-copy"><h2>{nowPlaying.track}</h2><p>{nowPlaying.artist}</p></div>
    {expanded && <div className="music-screen-details"><span>{nowPlaying.album}</span><span>{nowPlaying.isPlaying ? "Live" : "Paused"}</span></div>}{expanded && <SpotifyControls isPlaying={nowPlaying.isPlaying} />}<TrackProgress key={`${nowPlaying.track}|${nowPlaying.progressMs}|${nowPlaying.isPlaying}`} progressMs={nowPlaying.progressMs} durationMs={nowPlaying.durationMs} isPlaying={nowPlaying.isPlaying} expanded={expanded} /></div>
  </> : <div className="spotify-empty"><SpotifyLabel /><div className="spotify-empty-copy"><SpotifyMark className="spotify-empty-mark" /><strong>No track</strong><span>Spotify is quiet right now.</span></div></div>}</article>;
}
