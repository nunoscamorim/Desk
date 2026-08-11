"use client";

import { useEffect, useRef, useState } from "react";
import type { PlaylistResult } from "@/lib/tv/playlist";
import { useConfirm } from "./ConfirmContext";
import { useToast } from "./ToastContext";

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
  const confirm = useConfirm();
  const showToast = useToast();
  const [playlists, setPlaylists] = useState<PlaylistResult[]>([]);
  const [name, setName] = useState("");
  const [source, setSource] = useState<"url" | "xtream">("url");
  const [url, setUrl] = useState("");
  const [server, setServer] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [categories, setCategories] = useState("");
  const [xtreamGroups, setXtreamGroups] = useState<Array<{ id: string; name: string }>>([]);
  const [xtreamChannels, setXtreamChannels] = useState<Array<{ id: string; name: string; groupId: string; group: string; logo: string | null }>>([]);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [loadingXtream, setLoadingXtream] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = (refresh = false) => fetch(`/api/tv/playlists${refresh ? "?refresh=1" : ""}`, { cache: "no-store" })
    .then(async (response) => { if (response.status === 401) throw new Error("Sign in to manage playlists."); return response.json() as Promise<{ playlists: PlaylistResult[] }>; })
    .then((data) => { setPlaylists(data.playlists ?? []); setLoadError(""); return true; })
    .catch((error: unknown) => { setLoadError(error instanceof Error ? error.message : "Could not read playlists."); return false; });

  useEffect(() => { void load().finally(() => setLoading(false)); }, []);

  // Re-contacts each host rather than replaying the cached answer, so a
  // playlist that failed can be retried after fixing whatever was wrong.
  const recheck = async () => {
    setBusy(true);
    try { const ok = await load(true); showToast(ok ? "Re-checked playlists" : loadError, ok ? "success" : "error"); }
    finally { setBusy(false); }
  };

  const save = async (next: Array<{ id?: string; name: string; url?: string; source?: "url" | "xtream"; server?: string; username?: string; password?: string; categories?: string[]; channels?: string[] }>) => {
    setBusy(true);
    try {
      const response = await fetch("/api/tv/playlists", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ playlists: next }) });
      if (!response.ok) throw new Error("Save failed");
      const data = await response.json() as { playlists: PlaylistResult[] };
      setPlaylists(data.playlists ?? []);
      return true;
    } catch { return false; } finally { setBusy(false); }
  };

  const add = async () => {
    if (source === "url" && !url.trim()) { showToast("Paste an M3U URL first.", "error"); return; }
    if (source === "xtream" && (!server.trim() || !username.trim() || !password.trim())) { showToast("Enter the Xtream server, username, and password.", "error"); return; }
    const label = name.trim() || "Playlist";
    const next = source === "xtream"
      ? { name: label, source, server: server.trim(), username: username.trim(), password: password.trim(), categories: selectedGroups.length ? selectedGroups : categories.split(",").map((value) => value.trim()).filter(Boolean), channels: selectedChannels }
      : { name: label, source, url: url.trim() };
    const ok = await save([...playlists.map((playlist) => ({ id: playlist.id, name: playlist.name })), next]);
    showToast(ok ? `Added ${label}` : "Couldn’t save — try again", ok ? "success" : "error");
    if (ok) { setName(""); setUrl(""); setServer(""); setUsername(""); setPassword(""); setCategories(""); setXtreamGroups([]); setXtreamChannels([]); setSelectedGroups([]); setSelectedChannels([]); }
  };

  const loadXtream = async () => {
    if (!server.trim() || !username.trim() || !password.trim()) { showToast("Enter the Xtream server, username, and password first.", "error"); return; }
    setLoadingXtream(true);
    try { const response = await fetch("/api/tv/xtream", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ server, username, password }) }); const data = await response.json() as { groups?: typeof xtreamGroups; channels?: typeof xtreamChannels; error?: string }; if (!response.ok) throw new Error(data.error ?? "Could not load Xtream channels"); setXtreamGroups(data.groups ?? []); setXtreamChannels(data.channels ?? []); setSelectedGroups([]); setSelectedChannels([]); } catch (error) { showToast(error instanceof Error ? error.message : "Could not load Xtream channels", "error"); } finally { setLoadingXtream(false); }
  };

  // Uploads have their own endpoint: the file has to be parsed and written to
  // disk before it can join the list, which a JSON save cannot do.
  const upload = async (file: File) => {
    setBusy(true);
    try {
      const form = new FormData();
      form.set("file", file);
      if (name.trim()) form.set("name", name.trim());
      const response = await fetch("/api/tv/playlists/upload", { method: "POST", body: form });
      const data = await response.json() as { playlists?: PlaylistResult[]; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Upload failed");
      setPlaylists(data.playlists ?? []);
      setName("");
      showToast(`Added ${file.name}`);
    } catch (error) { showToast(error instanceof Error ? error.message : "Upload failed.", "error"); }
    finally { setBusy(false); if (fileRef.current) fileRef.current.value = ""; }
  };

  // Removal is a list replacement: whatever is left is saved, and the server
  // deletes any upload file no longer referenced.
  const remove = async (playlist: PlaylistResult) => {
    const confirmed = await confirm({ title: `Remove ${playlist.name}?`, description: "The TV screen loses these channels immediately.", confirmLabel: "Remove", danger: true });
    if (!confirmed) return;
    const ok = await save(playlists.filter((item) => item.id !== playlist.id).map((item) => ({ id: item.id, name: item.name })));
    showToast(ok ? `Removed ${playlist.name}` : "Couldn’t save — try again", ok ? "success" : "error");
  };

  return <>
    {/* Matches the Dashboard/Display pattern of a page-level action button
        sitting in .admin-header, rather than lower down inside the panel —
        every admin page keeps its primary action at the same top offset. */}
    <header className="admin-header"><div><p className="admin-eyebrow">Dashboard / Configuration</p><h1>TV playlists.</h1><p>Manage the M3U playlists behind the TV screen.</p></div><button type="button" className="btn btn-secondary" onClick={() => void recheck()} disabled={busy}>Re-check</button></header>
    <div className="admin-workspace">
    <section className="admin-panel tv-panel">
    <div className="panel-heading"><div><p className="admin-eyebrow">TV</p><h2>M3U playlists</h2></div><span className="tv-panel-actions">{playlists.length} configured</span></div>

    <div className="tv-playlist-rows">
      {loading && Array.from({ length: 2 }, (_, index) => <div className="tv-playlist-row skeleton-row" key={index}><span className="skeleton" style={{ width: 8, height: 8, borderRadius: "50%" }} /><span className="skeleton" style={{ height: 28 }} /><span className="skeleton" style={{ width: 80, height: 12, justifySelf: "end" }} /><span className="skeleton" style={{ width: 64, height: 30 }} /></div>)}
      {!loading && playlists.length === 0 && <div className="empty-panel"><strong>No playlists yet</strong><span>{loadError || "Paste an M3U URL below — it is stored encrypted, since these usually carry your subscription credentials."}</span></div>}
      {!loading && playlists.map((playlist) => <div className="tv-playlist-row" key={playlist.id}>
        <span className={`integration-dot ${playlist.error ? "" : "connected"}`} />
        <span className="tv-playlist-copy">
          <strong>{playlist.name}</strong>
          <small>{playlist.host}</small>
        </span>
        <span className={`tv-playlist-status ${playlist.error ? "error" : ""}`}>
          {playlist.error ? playlist.error : `${playlist.channelCount} channels${playlist.truncated ? " (truncated)" : ""}`}
        </span>
        <button type="button" className="btn btn-danger btn-sm" onClick={() => void remove(playlist)} disabled={busy}>Remove</button>
      </div>)}
    </div>

    <div className="tv-playlist-add">
      <label>Name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Living room" /></label>
      <label>Source<select value={source} onChange={(event) => setSource(event.target.value as "url" | "xtream")}><option value="url">M3U URL</option><option value="xtream">Xtream Codes</option></select></label>
      {source === "url" ? <label>M3U URL<input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://…/playlist.m3u" autoComplete="off" spellCheck={false} /></label> : <>
        <label>Server URL<input value={server} onChange={(event) => setServer(event.target.value)} placeholder="https://provider.example:8080" autoComplete="off" /></label>
        <label>Username<input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="off" /></label>
        <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" /></label>
        <label>Channel filters<input value={categories} onChange={(event) => setCategories(event.target.value)} placeholder="Optional group names" /></label>
        <button type="button" className="btn btn-secondary" onClick={() => void loadXtream()} disabled={busy || loadingXtream}>{loadingXtream ? "Loading channels…" : "Load groups and channels"}</button>
      </>}
      <button type="button" className="btn" onClick={() => void add()} disabled={busy}>{busy ? "Loading…" : "Add playlist"}</button>
    </div>
    {source === "xtream" && xtreamGroups.length > 0 && <div className="xtream-picker"><div><p className="admin-eyebrow">Xtream filters</p><h3>Choose groups</h3>{xtreamGroups.map((group) => <label key={group.id} className="xtream-check"><input type="checkbox" checked={selectedGroups.includes(group.id)} onChange={(event) => setSelectedGroups((current) => event.target.checked ? [...current, group.id] : current.filter((id) => id !== group.id))} />{group.name}</label>)}</div><div><p className="admin-eyebrow">Channels in selected groups</p><h3>Choose channels</h3>{xtreamChannels.filter((channel) => selectedGroups.includes(channel.groupId)).map((channel) => <label key={channel.id} className="xtream-check"><input type="checkbox" checked={selectedChannels.includes(channel.id)} onChange={(event) => setSelectedChannels((current) => event.target.checked ? [...current, channel.id] : current.filter((id) => id !== channel.id))} />{channel.name}<small>{channel.group}</small></label>)}</div></div>}
    <div className="tv-playlist-upload">
      <span>…or upload an M3U file</span>
      <input ref={fileRef} type="file" accept=".m3u,.m3u8,audio/x-mpegurl,application/vnd.apple.mpegurl,text/plain" disabled={busy}
        onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); }} />
    </div>
    </section>
    </div>
  </>;
}
