"use client";

import { useEffect, useRef, useState } from "react";
import type { Channel } from "@/lib/tv/m3u";

export type TvStreamState = "connecting" | "playing" | "stalled" | "failed";

const proxied = (url: string) => `/api/tv/proxy?url=${encodeURIComponent(url)}`;

export const initialsFor = (name: string) => name.replace(/[^\p{L}\p{N} ]/gu, "").split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]?.toUpperCase()).join("") || "TV";

/**
 * Xtream Codes-style IPTV providers commonly hand out raw MPEG-TS URLs
 * (`.../live/user/pass/12345.ts`) rather than an HLS manifest. hls.js expects
 * `.m3u8` text it can parse as a playlist — fed a `.ts` URL it tries to read
 * the binary transport stream as that text and fails immediately, which reads
 * to a user as "nothing plays." Detected by extension since that's the only
 * signal available before any request is made.
 */
const isRawTransportStream = (url: string) => /\.ts(\?|#|$)/i.test(url);

/**
 * Plays one channel's live stream. Shared by the full-screen player and the
 * channel-list preview, which differ only in the chrome around this (controls,
 * a back button, whether audio plays) — not in how the stream itself connects.
 *
 * Three delivery paths, picked in this order:
 * 1. Raw MPEG-TS (see isRawTransportStream) goes through mpegts.js, which
 *    demuxes a continuous live TS response into fragments MSE can play — the
 *    same job hls.js does for segmented HLS, but for an unsegmented stream.
 * 2. Safari — which is what the iPad this dashboard runs on uses — plays HLS
 *    natively, so it gets the stream URL straight on the video element. That
 *    path needs no library, and native playback is not subject to CORS, so
 *    the stream goes source-to-device without touching this server.
 * 3. Every other browser needs hls.js for HLS, imported only on that branch
 *    so the iPad never downloads it.
 *
 * Both mpegts.js and hls.js fetch over XHR/fetch and so *are* CORS-bound;
 * most providers send no CORS headers, and that surfaces as a network error
 * rather than anything more specific. So a network failure is retried once
 * through the proxy before the channel is called dead.
 *
 * While not playing, the video's native `poster` shows the resolved channel
 * logo when there is one; when there isn't, the overlay carries the channel's
 * initials instead, so a channel is never a blank black rectangle.
 */
export function TvStream({ channel, poster, muted = false, controls = true, className, onStateChange }: { channel: Channel; poster: string | null; muted?: boolean; controls?: boolean; className?: string; onStateChange?: (state: TvStreamState) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<TvStreamState>("connecting");
  const [detail, setDetail] = useState<string | null>(null);
  const [viaProxy, setViaProxy] = useState(false);

  // Mirrors every state change out to the caller, including the initial
  // mount — a caller showing its own "Live" badge (TvScreen's preview) needs
  // to know playback just reset to "connecting" for a freshly selected
  // channel, not keep reporting the previous channel's state.
  useEffect(() => { onStateChange?.(state); }, [state, onStateChange]);

  // Callers key this on the channel id, so switching channels remounts rather
  // than resetting three pieces of state and hoping none is missed.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const source = viaProxy ? proxied(channel.url) : channel.url;
    const rawTs = isRawTransportStream(channel.url);
    let disposed = false;
    let destroyPlayer: (() => void) | null = null;

    const fail = (message: string) => { if (!disposed) { setState("failed"); setDetail(message); } };

    if (rawTs) {
      void (async () => {
        try {
          const { default: mpegts } = await import("mpegts.js");
          if (disposed) return;
          if (!mpegts.isSupported()) { fail("This browser cannot play this stream."); return; }
          // enableWorker is left off: mpegts.js's worker bootstrapping doesn't
          // resolve cleanly through Turbopack's dev bundling (fails with "is
          // not a constructor" once the worker tries to spin up) — demuxing
          // on the main thread costs a little but works everywhere.
          const player = mpegts.createPlayer({ type: "mpegts", isLive: true, url: source }, { liveBufferLatencyChasing: true });
          destroyPlayer = () => player.destroy();
          player.on(mpegts.Events.ERROR, (type: string) => {
            // A CORS rejection arrives as a generic network error, so the
            // proxy is tried once before giving up rather than assumed upfront.
            if (type === mpegts.ErrorTypes.NETWORK_ERROR && !viaProxy) { setViaProxy(true); return; }
            fail(type === mpegts.ErrorTypes.NETWORK_ERROR ? "Could not reach the stream." : "The stream could not be decoded.");
          });
          player.attachMediaElement(video);
          player.load();
          void Promise.resolve(player.play()).catch(() => undefined);
        } catch { fail("Could not load the player."); }
      })();
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      // Safari and iOS report native HLS support here; everywhere else this is "".
      video.src = source;
      video.play().catch(() => { /* autoplay may need the tap that is already coming */ });
    } else {
      void (async () => {
        try {
          const { default: Hls } = await import("hls.js");
          if (disposed) return;
          if (!Hls.isSupported()) { fail("This browser cannot play HLS."); return; }
          const hls = new Hls({ enableWorker: true, lowLatencyMode: false });
          destroyPlayer = () => hls.destroy();
          hls.on(Hls.Events.ERROR, (_event, data) => {
            if (!data.fatal) return;
            if (data.type === Hls.ErrorTypes.NETWORK_ERROR && !viaProxy) { setViaProxy(true); return; }
            fail(data.type === Hls.ErrorTypes.NETWORK_ERROR ? "Could not reach the stream." : "The stream could not be decoded.");
          });
          hls.loadSource(source);
          hls.attachMedia(video);
          hls.on(Hls.Events.MANIFEST_PARSED, () => { void video.play().catch(() => undefined); });
        } catch { fail("Could not load the player."); }
      })();
    }

    const onPlaying = () => { if (!disposed) { setState("playing"); setDetail(null); } };
    const onWaiting = () => { if (!disposed) setState((current) => (current === "playing" ? "stalled" : current)); };
    // mpegts.js reports its own errors above; the bare <video> element's
    // native error event isn't a meaningful signal for MSE-driven playback
    // and can fire incidentally while the player attaches, so it's ignored
    // on that path rather than double-reporting or overriding the real reason.
    const onNativeError = () => {
      if (rawTs) return;
      if (!viaProxy && video.canPlayType("application/vnd.apple.mpegurl")) { setViaProxy(true); return; }
      fail("The stream could not be played.");
    };
    video.addEventListener("playing", onPlaying);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("error", onNativeError);

    return () => {
      disposed = true;
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("error", onNativeError);
      destroyPlayer?.();
      video.removeAttribute("src");
      video.load();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setState/onStateChange intentionally excluded: they're stable enough here and including them would re-run the connect effect on every render.
  }, [channel.id, channel.url, viaProxy]);

  const retry = () => { setViaProxy(false); setState("connecting"); setDetail(null); };

  return <div className={`tv-stage${className ? ` ${className}` : ""}`}>
    {/* playsInline is not optional: without it iOS takes every play() into its
        own fullscreen player and the dashboard disappears behind it. */}
    <video ref={videoRef} className="tv-video" poster={poster ?? undefined} playsInline autoPlay muted={muted} controls={controls} preload="none" />
    {state !== "playing" && <div className="tv-overlay" role="status">
      {!poster && <span className="tv-overlay-mark" aria-hidden="true">{initialsFor(channel.name)}</span>}
      <strong>{state === "failed" ? "Channel unavailable" : state === "stalled" ? "Buffering" : "Connecting"}</strong>
      {detail && <span>{detail}</span>}
      {state === "failed" && <button type="button" onClick={retry}>Try again</button>}
    </div>}
  </div>;
}
