import type { CSSProperties } from "react";
import type { SpotifyNowPlaying, SpotifyPlaylist } from "@/lib/dashboard/types";
import { SpotifyWidget } from "./SpotifyWidget";
import { useState } from "react";

function PlaylistTile({ playlist, pending, onPlay }: { playlist: SpotifyPlaylist; pending: boolean; onPlay: () => void }) {
  return <button type="button" className={`playlist-tile${pending ? " is-pending" : ""}`} aria-label={`Play ${playlist.name}`} disabled={pending} onClick={onPlay}>
    <div className={`playlist-art ${playlist.artworkUrl ? "has-artwork" : ""}`} style={playlist.artworkUrl ? { backgroundImage: `url(${playlist.artworkUrl})` } as CSSProperties : undefined}><span>♫</span></div>
    <span className="playlist-name" title={playlist.name}>{playlist.name}</span>
    <span className="playlist-count">{playlist.trackCount} {playlist.trackCount === 1 ? "track" : "tracks"}</span>
  </button>;
}

// The now-playing card sizes itself to its content (see .music-screen-card in
// globals.css) rather than stretching to the full screen height, which is what
// leaves room for this section underneath it.
export function MusicScreen({ nowPlaying, playlists }: { nowPlaying: SpotifyNowPlaying | null; playlists: SpotifyPlaylist[] }) {
  const [pendingPlaylist, setPendingPlaylist] = useState<string | null>(null);
  const [playlistError, setPlaylistError] = useState(false);
  const playPlaylist = async (playlistId: string) => {
    setPendingPlaylist(playlistId);
    setPlaylistError(false);
    try {
      const response = await fetch("/api/spotify/control", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "play", contextUri: `spotify:playlist:${playlistId}` }) });
      if (!response.ok) throw new Error();
      window.dispatchEvent(new CustomEvent("spotify:refresh"));
    } catch {
      setPlaylistError(true);
    } finally {
      setPendingPlaylist(null);
    }
  };
  return <section className="music-screen">
    <SpotifyWidget nowPlaying={nowPlaying} expanded />
    {playlists.length > 0 && <div className="spotify-playlists">
      <p className="card-label">Your playlists</p>
      <div className="spotify-playlists-row">{playlists.map((playlist) => <PlaylistTile key={playlist.id} playlist={playlist} pending={pendingPlaylist === playlist.id} onPlay={() => void playPlaylist(playlist.id)} />)}</div>
      {playlistError && <span className="playlist-error" role="status">Couldn’t start playlist</span>}
    </div>}
  </section>;
}
