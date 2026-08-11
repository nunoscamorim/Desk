"use client";

import { useEffect, useRef, useState } from "react";
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
  const fileRef = useRef<HTMLInputElement>(null);

  const load = (refresh = false) => fetch(`/api/tv/playlists${refresh ? "?refresh=1" : ""}`, { cache: "no-store" })
    .then(async (response) => { if (response.status === 401) throw new Error("Sign in to manage playlists."); return response.json() as Promise<{ playlists: PlaylistResult[] }>; })
    .then((data) => setPlaylists(data.playlists ?? []))
    .catch((error: unknown) => setStatus(error instanceof Error ? error.message : "Could not read playlists."));

  useEffect(() => { void load(); }, []);

  // Re-contacts each host rather than replaying the cached answer, so a
  // playlist that failed can be retried after fixing whatever was wrong.
  const recheck = async () => {
    setBusy(true);
    setStatus("Re-checking…");
    try { await load(true); setStatus("Re-checked."); }
    finally { setBusy(false); }
  };

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

  // Uploads have their own endpoint: the file has to be parsed and written to
  // disk before it can join the list, which a JSON save cannot do.
  const upload = async (file: File) => {
    setBusy(true);
    setStatus(`Reading ${file.name}…`);
    try {
      const form = new FormData();
      form.set("file", file);
      if (name.trim()) form.set("name", name.trim());
      const response = await fetch("/api/tv/playlists/upload", { method: "POST", body: form });
      const data = await response.json() as { playlists?: PlaylistResult[]; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Upload failed");
      setPlaylists(data.playlists ?? []);
      setName("");
      setStatus(`Added ${file.name}.`);
    } catch (error) { setStatus(error instanceof Error ? error.message : "Upload failed."); }
    finally { setBusy(false); if (fileRef.current) fileRef.current.value = ""; }
  };

  // Removal is a list replacement: whatever is left is saved, and the server
  // deletes any upload file no longer referenced.
  const remove = (id: string) => save(playlists.filter((playlist) => playlist.id !== id).map((playlist) => ({ id: playlist.id, name: playlist.name })));

  return <section className="admin-panel tv-panel">
    <div className="panel-heading"><div><p className="admin-eyebrow">TV</p><h2>M3U playlists</h2></div><span className="tv-panel-actions"><button type="button" onClick={() => void recheck()} disabled={busy}>Re-check</button>{playlists.length} configured</span></div>

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
    <div className="tv-playlist-upload">
      <span>…or upload an M3U file</span>
      <input ref={fileRef} type="file" accept=".m3u,.m3u8,audio/x-mpegurl,application/vnd.apple.mpegurl,text/plain" disabled={busy}
        onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); }} />
    </div>
    {status && <p className="settings-note">{status}</p>}
  </section>;
}
