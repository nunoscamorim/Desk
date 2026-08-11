"use client";

import { useState } from "react";
import type { Channel } from "@/lib/tv/m3u";
import { TvStream, type TvStreamState } from "./TvStream";

/** Full-screen chrome (back button, header, state badge) around TvStream. */
export function TvPlayer({ channel, poster, onBack }: { channel: Channel; poster: string | null; onBack: () => void }) {
  const [state, setState] = useState<TvStreamState>("connecting");
  return <section className="tv-player">
    <header className="tv-player-bar">
      <button type="button" className="tv-back" onClick={onBack}>‹ Channels</button>
      <div className="tv-now"><strong>{channel.name}</strong>{channel.group && <span>{channel.group}</span>}</div>
      <span className={`tv-state tv-state-${state}`}>{state === "playing" ? "Live" : state === "connecting" ? "Connecting…" : state === "stalled" ? "Buffering…" : "Unavailable"}</span>
    </header>
    <TvStream channel={channel} poster={poster} controls onStateChange={setState} />
  </section>;
}
