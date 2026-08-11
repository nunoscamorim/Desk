"use client";

import { useEffect, useRef, useState } from "react";
import type { EpgSourceResult } from "@/lib/tv/epg";
import { useConfirm } from "./ConfirmContext";
import { useToast } from "./ToastContext";

/**
 * Manages the XMLTV programme-guide sources behind the TV screen.
 *
 * Mirrors TvPlaylistsPanel.tsx — same shape of problem, fetch-or-upload a
 * text feed, parse it, store multiple sources encrypted. Saved URLs are never
 * sent back to the browser for the same reason M3U playlist URLs aren't: they
 * can carry a subscription's credentials.
 */
export function TvEpgPanel() {
  const confirm = useConfirm();
  const showToast = useToast();
  const [sources, setSources] = useState<EpgSourceResult[]>([]);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = (refresh = false) => fetch(`/api/tv/epg${refresh ? "?refresh=1" : ""}`, { cache: "no-store" })
    .then(async (response) => { if (response.status === 401) throw new Error("Sign in to manage the EPG."); return response.json() as Promise<{ sources: EpgSourceResult[] }>; })
    .then((data) => { setSources(data.sources ?? []); setLoadError(""); return true; })
    .catch((error: unknown) => { setLoadError(error instanceof Error ? error.message : "Could not read EPG sources."); return false; });

  useEffect(() => { void load().finally(() => setLoading(false)); }, []);

  // Re-contacts each host rather than replaying the cached answer, so a
  // source that failed can be retried after fixing whatever was wrong.
  const recheck = async () => {
    setBusy(true);
    try { const ok = await load(true); showToast(ok ? "Re-checked EPG sources" : loadError, ok ? "success" : "error"); }
    finally { setBusy(false); }
  };

  const save = async (next: Array<{ id?: string; name: string; url?: string }>) => {
    setBusy(true);
    try {
      const response = await fetch("/api/tv/epg", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sources: next }) });
      if (!response.ok) throw new Error("Save failed");
      const data = await response.json() as { sources: EpgSourceResult[] };
      setSources(data.sources ?? []);
      return true;
    } catch { return false; } finally { setBusy(false); }
  };

  const add = async () => {
    if (!url.trim()) { showToast("Paste an XMLTV URL first.", "error"); return; }
    const label = name.trim() || "EPG source";
    const ok = await save([...sources.map((source) => ({ id: source.id, name: source.name })), { name: label, url: url.trim() }]);
    showToast(ok ? `Added ${label}` : "Couldn’t save — try again", ok ? "success" : "error");
    if (ok) { setName(""); setUrl(""); }
  };

  // Uploads have their own endpoint: the file has to be parsed and written to
  // disk before it can join the list, which a JSON save cannot do.
  const upload = async (file: File) => {
    setBusy(true);
    try {
      const form = new FormData();
      form.set("file", file);
      if (name.trim()) form.set("name", name.trim());
      const response = await fetch("/api/tv/epg/upload", { method: "POST", body: form });
      const data = await response.json() as { sources?: EpgSourceResult[]; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Upload failed");
      setSources(data.sources ?? []);
      setName("");
      showToast(`Added ${file.name}`);
    } catch (error) { showToast(error instanceof Error ? error.message : "Upload failed.", "error"); }
    finally { setBusy(false); if (fileRef.current) fileRef.current.value = ""; }
  };

  // Removal is a list replacement: whatever is left is saved, and the server
  // deletes any upload file no longer referenced.
  const remove = async (source: EpgSourceResult) => {
    const confirmed = await confirm({ title: `Remove ${source.name}?`, description: "The programme guide loses this schedule data immediately.", confirmLabel: "Remove", danger: true });
    if (!confirmed) return;
    const ok = await save(sources.filter((item) => item.id !== source.id).map((item) => ({ id: item.id, name: item.name })));
    showToast(ok ? `Removed ${source.name}` : "Couldn’t save — try again", ok ? "success" : "error");
  };

  return <div className="admin-workspace">
    <section className="admin-panel tv-panel">
      <div className="panel-heading"><div><p className="admin-eyebrow">TV</p><h2>Programme guide</h2></div><span className="tv-panel-actions"><button type="button" className="btn btn-secondary btn-sm" onClick={() => void recheck()} disabled={busy}>Re-check</button>{sources.length} configured</span></div>

      <div className="tv-playlist-rows">
        {loading && Array.from({ length: 2 }, (_, index) => <div className="tv-playlist-row skeleton-row" key={index}><span className="skeleton" style={{ width: 8, height: 8, borderRadius: "50%" }} /><span className="skeleton" style={{ height: 28 }} /><span className="skeleton" style={{ width: 80, height: 12, justifySelf: "end" }} /><span className="skeleton" style={{ width: 64, height: 30 }} /></div>)}
        {!loading && sources.length === 0 && <div className="empty-panel"><strong>No EPG source yet</strong><span>{loadError || "Paste an XMLTV URL below — it is stored encrypted, since these can carry your subscription credentials."}</span></div>}
        {!loading && sources.map((source) => <div className="tv-playlist-row" key={source.id}>
          <span className={`integration-dot ${source.error ? "" : "connected"}`} />
          <span className="tv-playlist-copy">
            <strong>{source.name}</strong>
            <small>{source.host}</small>
          </span>
          <span className={`tv-playlist-status ${source.error ? "error" : ""}`}>
            {source.error ? source.error : `${source.channelCount} channels · ${source.programmeCount} programmes${source.truncated ? " (truncated)" : ""}`}
          </span>
          <button type="button" className="btn btn-danger btn-sm" onClick={() => void remove(source)} disabled={busy}>Remove</button>
        </div>)}
      </div>

      <div className="tv-playlist-add">
        <label>Name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Provider EPG" /></label>
        <label>XMLTV URL<input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://…/epg.xml" autoComplete="off" spellCheck={false} /></label>
        <button type="button" className="btn" onClick={() => void add()} disabled={busy}>{busy ? "Loading…" : "Add source"}</button>
      </div>
      <div className="tv-playlist-upload">
        <span>…or upload an XMLTV file</span>
        <input ref={fileRef} type="file" accept=".xml,.xmltv,text/xml,application/xml" disabled={busy}
          onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); }} />
      </div>
    </section>
  </div>;
}
