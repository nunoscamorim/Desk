"use client";

import { useEffect, useMemo, useState } from "react";
import { TvPlayer } from "@/app/components/tv/TvPlayer";
import type { Channel } from "@/lib/tv/m3u";
import type { PlaylistResult } from "@/lib/tv/playlist";

type LoadState =
  | { status: "loading" }
  | { status: "ready"; channels: Channel[]; playlists: PlaylistResult[] }
  | { status: "error"; message: string };

/**
 * Provider logos are arbitrary remote images: a fair share 404, and on a slow or
 * blocked host the request can hang rather than fail. So the initials are always
 * rendered underneath and the image simply covers them once it decodes — a tile
 * is never a blank rectangle waiting on somebody else's CDN.
 */
function ChannelTile({ channel, onSelect }: { channel: Channel; onSelect: () => void }) {
  const [logoFailed, setLogoFailed] = useState(false);
  const [logoLoaded, setLogoLoaded] = useState(false);
  const initials = channel.name.replace(/[^\p{L}\p{N} ]/gu, "").split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]?.toUpperCase()).join("") || "TV";
  return <button type="button" className="tv-tile" onClick={onSelect}>
    <span className="tv-tile-art">
      {/* Kept until the logo has actually decoded — not merely until it has
          failed — because a blocked host leaves the request pending forever and
          onError never arrives. */}
      {!logoLoaded && <i aria-hidden="true">{initials}</i>}
      {channel.logo && !logoFailed &&
        // eslint-disable-next-line @next/next/no-img-element -- provider logos are arbitrary remote hosts; next/image would need each one allowlisted.
        <img src={channel.logo} alt="" loading="lazy" onLoad={() => setLogoLoaded(true)} onError={() => setLogoFailed(true)} />}
    </span>
    <span className="tv-tile-name">{channel.name}</span>
    {channel.group && <span className="tv-tile-group">{channel.group}</span>}
  </button>;
}

/**
 * Tiles rendered at once. A public aggregate playlist runs to five figures, and
 * putting that many nodes on the page locks an iPad up for seconds — so the list
 * is capped and the search box is what reaches the rest.
 */
const VISIBLE_LIMIT = 300;

export function TvScreen() {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [playing, setPlaying] = useState<Channel | null>(null);
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("");

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

  // Memoised so the empty-array branch does not hand the filters below a fresh
  // identity on every render.
  const channels = useMemo(() => (state.status === "ready" ? state.channels : []), [state]);
  const groups = useMemo(() => [...new Set(channels.map((channel) => channel.group).filter((value): value is string => Boolean(value)))].sort((a, b) => a.localeCompare(b)), [channels]);
  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return channels.filter((channel) => (!group || channel.group === group) && (!needle || channel.name.toLowerCase().includes(needle)));
  }, [channels, query, group]);

  if (playing) return <TvPlayer key={playing.id} channel={playing} onBack={() => setPlaying(null)} />;
  if (state.status === "loading") return <section className="tv-screen tv-message"><span>Loading channels…</span></section>;
  if (state.status === "error") return <section className="tv-screen tv-message"><strong>Channels unavailable</strong><span>{state.message}</span></section>;

  const failed = state.playlists.filter((playlist) => playlist.error);
  const truncated = state.playlists.filter((playlist) => playlist.truncated);

  if (state.channels.length === 0) {
    return <section className="tv-screen tv-message">
      <strong>No channels yet</strong>
      <span>{state.playlists.length === 0 ? "Add an M3U playlist in /admin — paste a URL or upload a file." : "Every configured playlist failed to load."}</span>
      {failed.map((playlist) => <span key={playlist.id} className="tv-warning">{playlist.name}: {playlist.error}</span>)}
    </section>;
  }

  const visible = matches.slice(0, VISIBLE_LIMIT);

  return <section className="tv-screen">
    <div className="tv-filters">
      <input className="tv-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${channels.length.toLocaleString()} channels…`} aria-label="Search channels" />
      {groups.length > 1 && <select className="tv-group" value={group} onChange={(event) => setGroup(event.target.value)} aria-label="Filter by group">
        <option value="">All groups</option>
        {groups.map((name) => <option key={name} value={name}>{name}</option>)}
      </select>}
      <span className="tv-count">{matches.length === channels.length ? `${channels.length.toLocaleString()} channels` : `${matches.length.toLocaleString()} of ${channels.length.toLocaleString()}`}</span>
    </div>
    {(failed.length > 0 || truncated.length > 0) && <div className="tv-notices">
      {failed.map((playlist) => <span key={playlist.id} className="tv-warning">{playlist.name}: {playlist.error}</span>)}
      {truncated.map((playlist) => <span key={playlist.id} className="tv-warning">{playlist.name}: showing the first {playlist.channelCount.toLocaleString()} channels only.</span>)}
    </div>}
    {matches.length === 0
      ? <div className="tv-grid-empty">No channel matches that search.</div>
      : <div className="tv-grid">{visible.map((channel) => <ChannelTile key={channel.id} channel={channel} onSelect={() => setPlaying(channel)} />)}</div>}
    {matches.length > visible.length && <p className="tv-more">Showing the first {visible.length} — keep typing to narrow it down.</p>}
  </section>;
}
