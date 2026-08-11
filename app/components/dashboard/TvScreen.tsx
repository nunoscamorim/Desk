"use client";

import { useEffect, useState } from "react";
import { TvPlayer } from "@/app/components/tv/TvPlayer";
import type { Channel } from "@/lib/tv/m3u";
import type { PlaylistResult } from "@/lib/tv/playlist";

type LoadState =
  | { status: "loading" }
  | { status: "ready"; channels: Channel[]; playlists: PlaylistResult[] }
  | { status: "error"; message: string };

/** Logos are provider-hosted and a fair share of them 404, so each tile falls
 *  back to the channel's initials rather than a broken-image icon. */
function ChannelTile({ channel, onSelect }: { channel: Channel; onSelect: () => void }) {
  const [logoFailed, setLogoFailed] = useState(false);
  const initials = channel.name.replace(/[^\p{L}\p{N} ]/gu, "").split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]?.toUpperCase()).join("") || "TV";
  return <button type="button" className="tv-tile" onClick={onSelect}>
    <span className="tv-tile-art">
      {channel.logo && !logoFailed
        // eslint-disable-next-line @next/next/no-img-element -- provider logos are arbitrary remote hosts; next/image would need each one allowlisted.
        ? <img src={channel.logo} alt="" loading="lazy" onError={() => setLogoFailed(true)} />
        : <i aria-hidden="true">{initials}</i>}
    </span>
    <span className="tv-tile-name">{channel.name}</span>
    {channel.group && <span className="tv-tile-group">{channel.group}</span>}
  </button>;
}

export function TvScreen() {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [playing, setPlaying] = useState<Channel | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/tv/channels", { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        if (response.status === 401) throw new Error("Sign in at /admin to load channels.");
        if (!response.ok) throw new Error(`Channels request failed (${response.status})`);
        return response.json() as Promise<{ channels: Channel[]; playlists: PlaylistResult[] }>;
      })
      .then((data) => setState({ status: "ready", channels: data.channels, playlists: data.playlists }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setState({ status: "error", message: error instanceof Error ? error.message : "Could not load channels." });
      });
    return () => controller.abort();
  }, []);

  if (playing) return <TvPlayer key={playing.id} channel={playing} onBack={() => setPlaying(null)} />;
  if (state.status === "loading") return <section className="tv-screen tv-message"><span>Loading channels…</span></section>;
  if (state.status === "error") return <section className="tv-screen tv-message"><strong>Channels unavailable</strong><span>{state.message}</span></section>;

  const failed = state.playlists.filter((playlist) => playlist.error);
  const truncated = state.playlists.filter((playlist) => playlist.truncated);

  if (state.channels.length === 0) {
    return <section className="tv-screen tv-message">
      <strong>No channels yet</strong>
      <span>{state.playlists.length === 0 ? "Add an M3U playlist URL in /admin to get started." : "Every configured playlist failed to load."}</span>
      {failed.map((playlist) => <span key={playlist.id} className="tv-warning">{playlist.name}: {playlist.error}</span>)}
    </section>;
  }

  return <section className="tv-screen">
    {(failed.length > 0 || truncated.length > 0) && <div className="tv-notices">
      {failed.map((playlist) => <span key={playlist.id} className="tv-warning">{playlist.name}: {playlist.error}</span>)}
      {truncated.map((playlist) => <span key={playlist.id} className="tv-warning">{playlist.name}: showing the first {playlist.channelCount} channels only.</span>)}
    </div>}
    <div className="tv-grid">
      {state.channels.map((channel) => <ChannelTile key={channel.id} channel={channel} onSelect={() => setPlaying(channel)} />)}
    </div>
  </section>;
}
