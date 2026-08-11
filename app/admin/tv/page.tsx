"use client";

import { TvPlaylistsPanel } from "../TvPlaylistsPanel";
import { TvEpgPanel } from "../TvEpgPanel";

export default function AdminTvPage() {
  return <>
    <TvPlaylistsPanel />
    <TvEpgPanel />
  </>;
}
