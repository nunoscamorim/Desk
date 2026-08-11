import type { CSSProperties } from "react";
import type { SpotifyNowPlaying, SpotifyRecentTrack } from "@/lib/dashboard/types";
import { SpotifyWidget } from "./SpotifyWidget";

function RecentTrackTile({ track }: { track: SpotifyRecentTrack }) {
  return <div className="recent-track-tile">
    <div className={`recent-track-art ${track.artworkUrl ? "has-artwork" : ""}`} style={track.artworkUrl ? { backgroundImage: `url(${track.artworkUrl})` } as CSSProperties : undefined}><span>♫</span></div>
    <span className="recent-track-name">{track.track}</span>
    <span className="recent-track-artist">{track.artist}</span>
  </div>;
}

// The now-playing card sizes itself to its content (see .music-screen-card in
// globals.css) rather than stretching to the full screen height, which is what
// leaves room for this section underneath it.
export function MusicScreen({ nowPlaying, recentlyPlayed }: { nowPlaying: SpotifyNowPlaying | null; recentlyPlayed: SpotifyRecentTrack[] }) {
  return <section className="music-screen">
    <SpotifyWidget nowPlaying={nowPlaying} expanded />
    {recentlyPlayed.length > 0 && <div className="recently-played">
      <p className="card-label">Recently played</p>
      <div className="recently-played-row">{recentlyPlayed.map((track) => <RecentTrackTile key={track.id} track={track} />)}</div>
    </div>}
  </section>;
}
