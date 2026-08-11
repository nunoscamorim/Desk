"use client";

import { TvPlaylistsPanel } from "../TvPlaylistsPanel";

export default function AdminTvPage() {
  return <>
    <header className="admin-header"><div><p className="admin-eyebrow">Dashboard / Configuration</p><h1>TV playlists.</h1><p>Manage the M3U playlists behind the TV screen.</p></div></header>
    <div className="admin-workspace">
      <TvPlaylistsPanel />
    </div>
  </>;
}
