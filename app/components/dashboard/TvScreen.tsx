"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
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
function ChannelTile({ channel, active, onSelect }: { channel: Channel; active: boolean; onSelect: () => void }) {
  return <button type="button" className={`tv-tile${active ? " is-selected" : ""}`} onClick={onSelect} aria-pressed={active}>
    <span className="tv-tile-name">{channel.name}</span>
  </button>;
}

/**
 * Tiles rendered at once. A public aggregate playlist runs to five figures, and
 * putting that many nodes on the page locks an iPad up for seconds — so the list
 * is capped and the search box is what reaches the rest.
 */
const VISIBLE_LIMIT = 300;

type Diagnosis = { environment?: { authSecretSet?: boolean; adminPasswordSet?: boolean; dataDirWritable?: boolean }; request?: { authenticated?: boolean; canReadChannels?: boolean }; playlists?: { stored?: number; error?: string } };

const DEMO_STREAM = "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8";
const demoGeneralNames = ["Desk News", "Culture One", "Documentary", "World Report", "City Life", "The History Room", "Nature Now", "Morning Brief", "Independent", "Travel Desk", "Food Stories", "Science Daily", "Arts Night", "Home & Garden", "Cinema Club"];
const demoSportsNames = ["Sports Live", "Football Central", "Racing Club", "Tennis Tour", "Basketball Daily", "Matchday", "Golf Channel", "Fight Night", "Athletics", "The Fan Zone", "Motorsport", "Sports Desk", "Live Arena", "Stadium", "Overtime"];
const demoChannels: Channel[] = [...demoGeneralNames.map((name, index) => ({ id: `demo-general-${index}`, name, logo: null, group: "General", url: DEMO_STREAM })), ...demoSportsNames.map((name, index) => ({ id: `demo-sports-${index}`, name, logo: null, group: "Sports", url: DEMO_STREAM }))];

/**
 * Turns the diagnostics report into the one sentence that explains an empty
 * screen, in the order the causes actually block each other.
 *
 * Not signed in is the one case with an actual next step, and on this device
 * that step is a tap rather than typing a URL: added to the home screen, the
 * app runs with no address bar at all — Guided Access does not even enter into
 * it — so "open /admin" was advice this screen made impossible to follow.
 * Every other case ends here, in server or admin configuration, so text is all
 * there is to give.
 */
function explain(diagnosis: Diagnosis | null): { text: string; needsSignIn?: boolean } | null {
  if (!diagnosis) return null;
  const { environment = {}, request = {}, playlists = {} } = diagnosis;
  if (environment.authSecretSet === false) return { text: "AUTH_SECRET is not set on the server, so saved playlists cannot be read. Set it and redeploy." };
  if (request.canReadChannels === false) return { text: "This device isn’t signed in.", needsSignIn: true };
  if (playlists.error) return { text: playlists.error };
  if (environment.dataDirWritable === false) return { text: "The server cannot write to data/. Mount a persistent volume at /app/data." };
  if (playlists.stored === 0) return { text: "No playlist is saved yet. Add one in /admin — paste a URL or upload a file." };
  return null;
}

function DiagnosisNote({ diagnosis }: { diagnosis: Diagnosis | null }) {
  const explained = explain(diagnosis);
  if (!explained) return null;
  return <span className="tv-diagnosis">
    {explained.text}
    {explained.needsSignIn &&
      // In-app navigation, not a URL the user has to type — the address bar
      // does not exist in the standalone launch this kiosk uses.
      <Link href="/admin" className="tv-signin">Sign in →</Link>}
  </span>;
}

export function TvScreen() {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [playing, setPlaying] = useState<Channel | null>(null);
  const [preview, setPreview] = useState<Channel | null>(null);
  const [diagnosis, setDiagnosis] = useState<Diagnosis | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/tv/channels", { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        if (response.status === 401) throw new Error("This device is not signed in.");
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

  // Fetched alongside, so an empty screen can name its own cause instead of
  // sending the user to /admin to work out which of five things went wrong.
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/tv/diagnose", { signal: controller.signal, cache: "no-store" })
      .then((response) => (response.ok ? response.json() as Promise<Diagnosis> : null))
      .then(setDiagnosis)
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  // Memoised so the empty-array branch does not hand the filters below a fresh
  // identity on every render.
  const channels = useMemo(() => {
    if (state.status !== "ready") return [];
    // Keep the production display honest: demo channels only appear in local
    // development, where they make the TV layout usable before a playlist is
    // configured. They all point at a public test HLS stream.
    return state.channels.length > 0 || process.env.NODE_ENV === "production" ? state.channels : demoChannels;
  }, [state]);
  const showingDemoChannels = state.status === "ready" && state.channels.length === 0 && process.env.NODE_ENV !== "production";
  const matches = channels;

  if (playing) return <TvPlayer key={playing.id} channel={playing} onBack={() => setPlaying(null)} />;
  if (state.status === "loading") return <section className="tv-screen tv-message"><span>Loading channels…</span></section>;
  if (state.status === "error") return <section className="tv-screen tv-message"><strong>Channels unavailable</strong><span>{state.message}</span><DiagnosisNote diagnosis={diagnosis} /></section>;

  const failed = state.playlists.filter((playlist) => playlist.error);
  const truncated = state.playlists.filter((playlist) => playlist.truncated);

  if (channels.length === 0) {
    const explained = explain(diagnosis);
    return <section className="tv-screen tv-message">
      <strong>No channels yet</strong>
      {explained
        ? <DiagnosisNote diagnosis={diagnosis} />
        : <span>{state.playlists.length === 0 ? "Add an M3U playlist in /admin — paste a URL or upload a file." : "Every configured playlist failed to load."}</span>}
      {failed.map((playlist) => <span key={playlist.id} className="tv-warning">{playlist.name}: {playlist.error}</span>)}
    </section>;
  }

  const visible = matches.slice(0, VISIBLE_LIMIT);
  const sports = visible.filter((channel) => /sport/i.test(`${channel.group ?? ""} ${channel.name}`));
  const general = visible.filter((channel) => !sports.includes(channel));
  const previewChannel = preview && matches.some((channel) => channel.id === preview.id) ? preview : matches[0] ?? null;
  const channelSection = (title: string, channelsInSection: Channel[], tone: "general" | "sports") => channelsInSection.length > 0 && <section className={`tv-channel-section tv-channel-${tone}`} aria-label={`${title} channels`}><header><div><span className="tv-section-kicker">{tone === "sports" ? "Live & on demand" : "Your lineup"}</span><h3>{title}</h3></div><span>{channelsInSection.length} channels</span></header><div className="tv-grid">{channelsInSection.map((channel) => <ChannelTile key={channel.id} channel={channel} active={previewChannel?.id === channel.id} onSelect={() => setPreview(channel)} />)}</div></section>;

  return <section className="tv-screen">
    {(failed.length > 0 || truncated.length > 0) && <div className="tv-notices">
      {failed.map((playlist) => <span key={playlist.id} className="tv-warning">{playlist.name}: {playlist.error}</span>)}
      {truncated.map((playlist) => <span key={playlist.id} className="tv-warning">{playlist.name}: showing the first {playlist.channelCount.toLocaleString()} channels only.</span>)}
    </div>}
    {matches.length === 0 ? <div className="tv-grid-empty">No channel matches that search.</div> : <div className="tv-content">
      <div className="tv-channel-list"><div className="tv-channel-groups">{channelSection("General", general, "general")}{channelSection("Sports", sports, "sports")}</div></div>
      {previewChannel && <aside className="tv-preview" aria-label={`Preview ${previewChannel.name}`}>
        <div className="tv-preview-art">{previewChannel.logo && // eslint-disable-next-line @next/next/no-img-element -- arbitrary provider logos
          <img src={previewChannel.logo} alt="" />}<span className="tv-preview-live"><i /> Ready to watch</span></div>
        <div className="tv-preview-copy"><span className="tv-section-kicker">Channel preview</span><h2>{previewChannel.name}</h2><p>{previewChannel.group ?? "General entertainment"}</p><button type="button" className="tv-watch" onClick={() => setPlaying(previewChannel)}>Watch live <span aria-hidden="true">→</span></button></div>
      </aside>}
    </div>}
    {matches.length > visible.length && <p className="tv-more">Showing the first {visible.length} — keep typing to narrow it down.</p>}
  </section>;
}
