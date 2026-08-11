"use client";

import { useEffect, useState } from "react";
import type { PlaylistResult } from "@/lib/tv/playlist";

/**
 * Manages the M3U playlists behind the TV screen.
 *
 * Saved URLs are never sent back to the browser — they carry the subscription's
 * username and password — so an existing entry is edited by name only, and
 * replacing its URL means pasting a new one. Each row reports its channel count
 * or its parse error, so a bad URL is obvious here rather than as an empty grid
 * on the iPad later.
 */
export function TvPlaylistsPanel() {
  const [playlists, setPlaylists] = useState<PlaylistResult[]>([]);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => fetch("/api/tv/playlists", { cache: "no-store" })
    .then(async (response) => { if (response.status === 401) throw new Error("Sign in to manage playlists."); return response.json() as Promise<{ playlists: PlaylistResult[] }>; })
    .then((data) => setPlaylists(data.playlists ?? []))
    .catch((error: unknown) => setStatus(error instanceof Error ? error.message : "Could not read playlists."));

  useEffect(() => { void load(); }, []);

  const save = async (next: Array<{ id?: string; name: string; url?: string }>) => {
    setBusy(true);
    setStatus("Loading playlist…");
    try {
      const response = await fetch("/api/tv/playlists", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ playlists: next }) });
      if (!response.ok) throw new Error("Save failed");
      const data = await response.json() as { playlists: PlaylistResult[] };
      setPlaylists(data.playlists ?? []);
      setStatus("Saved.");
    } catch { setStatus("Couldn’t save — try again."); } finally { setBusy(false); }
  };

  const add = async () => {
    if (!url.trim()) { setStatus("Paste an M3U URL first."); return; }
    await save([...playlists.map((playlist) => ({ id: playlist.id, name: playlist.name })), { name: name.trim() || "Playlist", url: url.trim() }]);
    setName(""); setUrl("");
  };

  const remove = (id: string) => save(playlists.filter((playlist) => playlist.id !== id).map((playlist) => ({ id: playlist.id, name: playlist.name })));

  return <section className="admin-panel tv-panel">
    <div className="panel-heading"><div><p className="admin-eyebrow">TV</p><h2>M3U playlists</h2></div><span>{playlists.length} configured</span></div>

    <div className="tv-playlist-rows">
      {playlists.length === 0 && <p className="settings-note">No playlists yet. Paste an M3U URL below — it is stored encrypted, since these usually carry your subscription credentials.</p>}
      {playlists.map((playlist) => <div className="tv-playlist-row" key={playlist.id}>
        <span className={`integration-dot ${playlist.error ? "" : "connected"}`} />
        <span className="tv-playlist-copy">
          <strong>{playlist.name}</strong>
          <small>{playlist.host}</small>
        </span>
        <span className={`tv-playlist-status ${playlist.error ? "error" : ""}`}>
          {playlist.error ? playlist.error : `${playlist.channelCount} channels${playlist.truncated ? " (truncated)" : ""}`}
        </span>
        <button type="button" onClick={() => void remove(playlist.id)} disabled={busy}>Remove</button>
      </div>)}
    </div>

    <div className="tv-playlist-add">
      <label>Name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Living room" /></label>
      <label>M3U URL<input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://…/playlist.m3u" autoComplete="off" spellCheck={false} /></label>
      <button type="button" onClick={() => void add()} disabled={busy}>{busy ? "Loading…" : "Add playlist"}</button>
    </div>
    {status && <p className="settings-note">{status}</p>}
  </section>;
}
