"use client";

import { useEffect, useRef, useState } from "react";
import type { Channel } from "@/lib/tv/m3u";

type PlayerState = "connecting" | "playing" | "stalled" | "failed";

const proxied = (url: string) => `/api/tv/proxy?url=${encodeURIComponent(url)}`;

/**
 * Plays one channel.
 *
 * Safari — which is what the iPad this dashboard runs on uses — plays HLS
 * natively, so it gets the stream URL straight on the video element. That path
 * needs no library, and native playback is not subject to CORS, so the stream
 * goes source-to-device without touching this server.
 *
 * Every other browser needs hls.js, which is imported only on that branch so the
 * iPad never downloads it. hls.js fetches segments over XHR and so *is*
 * CORS-bound; most providers send no CORS headers, and that surfaces as a
 * network error rather than anything more specific. So a network failure is
 * retried once through the proxy before the channel is called dead.
 */
export function TvPlayer({ channel, onBack }: { channel: Channel; onBack: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<PlayerState>("connecting");
  const [detail, setDetail] = useState<string | null>(null);
  const [viaProxy, setViaProxy] = useState(false);

  // Callers key this on the channel id, so switching channels remounts rather
  // than resetting three pieces of state and hoping none is missed.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const source = viaProxy ? proxied(channel.url) : channel.url;
    let disposed = false;
    let destroyHls: (() => void) | null = null;

    const fail = (message: string) => { if (!disposed) { setState("failed"); setDetail(message); } };

    // Safari and iOS report native HLS support here; everywhere else this is "".
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = source;
      video.play().catch(() => { /* autoplay may need the tap that is already coming */ });
    } else {
      void (async () => {
        try {
          const { default: Hls } = await import("hls.js");
          if (disposed) return;
          if (!Hls.isSupported()) { fail("This browser cannot play HLS."); return; }
          const hls = new Hls({ enableWorker: true, lowLatencyMode: false });
          destroyHls = () => hls.destroy();
          hls.on(Hls.Events.ERROR, (_event, data) => {
            if (!data.fatal) return;
            // A CORS rejection arrives as a generic network error, so the proxy
            // is tried once before giving up rather than being assumed upfront.
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
    const onNativeError = () => { if (!viaProxy && video.canPlayType("application/vnd.apple.mpegurl")) { setViaProxy(true); return; } fail("The stream could not be played."); };
    video.addEventListener("playing", onPlaying);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("error", onNativeError);

    return () => {
      disposed = true;
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("error", onNativeError);
      destroyHls?.();
      video.removeAttribute("src");
      video.load();
    };
  }, [channel.id, channel.url, viaProxy]);

  return <section className="tv-player">
    <header className="tv-player-bar">
      <button type="button" className="tv-back" onClick={onBack}>‹ Channels</button>
      <div className="tv-now"><strong>{channel.name}</strong>{channel.group && <span>{channel.group}</span>}</div>
      <span className={`tv-state tv-state-${state}`}>{state === "playing" ? "Live" : state === "connecting" ? "Connecting…" : state === "stalled" ? "Buffering…" : "Unavailable"}</span>
    </header>
    <div className="tv-stage">
      {/* playsInline is not optional: without it iOS takes every play() into its
          own fullscreen player and the dashboard disappears behind it. */}
      <video ref={videoRef} className="tv-video" playsInline autoPlay controls preload="none" />
      {state !== "playing" && <div className="tv-overlay" role="status">
        <strong>{state === "failed" ? "Channel unavailable" : state === "stalled" ? "Buffering" : "Connecting"}</strong>
        {detail && <span>{detail}</span>}
        {state === "failed" && <button type="button" onClick={() => { setViaProxy(false); setState("connecting"); setDetail(null); }}>Try again</button>}
      </div>}
    </div>
  </section>;
}
