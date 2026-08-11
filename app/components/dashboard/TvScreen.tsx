"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import Link from "next/link";
import { TvPlayer } from "@/app/components/tv/TvPlayer";
import { TvStream, type TvStreamState } from "@/app/components/tv/TvStream";
import type { Channel } from "@/lib/tv/m3u";
import type { PlaylistResult } from "@/lib/tv/playlist";

type NowPlaying = { title: string; stop: string; next?: { title: string; start: string; stop: string } };

type LoadState =
  | { status: "loading" }
  | { status: "ready"; channels: Channel[]; playlists: PlaylistResult[]; nowPlaying: Record<string, NowPlaying>; epgIcons: Record<string, string> }
  | { status: "error"; message: string };

/**
 * Provider logos are arbitrary remote images. Sample their dominant colour when
 * possible so each compact tile gets a subtle branded wash without depending on
 * the image being served with permissive CORS headers.
 */
function useLogoColor(logo: string | null): string | null {
  const [color, setColor] = useState<string | null>(null);
  useEffect(() => {
    if (!logo) return;
    let cancelled = false;
    const image = new Image(); image.crossOrigin = "anonymous"; image.src = logo;
    image.onload = () => {
      if (cancelled) return;
      const canvas = document.createElement("canvas"); canvas.width = 16; canvas.height = 16;
      const context = canvas.getContext("2d", { willReadFrequently: true }); if (!context) return;
      try { context.drawImage(image, 0, 0, 16, 16); const pixels = context.getImageData(0, 0, 16, 16).data; let red = 0; let green = 0; let blue = 0; let count = 0; for (let index = 0; index < pixels.length; index += 16) { if (pixels[index + 3] < 128) continue; red += pixels[index]; green += pixels[index + 1]; blue += pixels[index + 2]; count += 1; } if (count && !cancelled) setColor(`rgb(${Math.round(red / count)}, ${Math.round(green / count)}, ${Math.round(blue / count)})`); } catch { /* Cross-origin logos may not expose pixels. */ }
    };
    return () => { cancelled = true; };
  }, [logo]);
  return color;
}

function ChannelTile({ channel, poster, active, onSelect }: { channel: Channel; poster: string | null; active: boolean; onSelect: () => void }) {
  const [logoFailed, setLogoFailed] = useState(!poster);
  const logoColor = useLogoColor(poster);
  return <button type="button" className={`tv-tile${active ? " is-selected" : ""}`} onClick={onSelect} aria-pressed={active} style={logoColor ? { "--tile-logo-color": logoColor } as CSSProperties : undefined}>
    {poster && !logoFailed && // eslint-disable-next-line @next/next/no-img-element -- arbitrary provider/EPG logos
      <img className="tv-tile-logo" src={poster} alt="" loading="lazy" onError={() => setLogoFailed(true)} />}
    {logoFailed && <span className="tv-tile-name">{channel.name}</span>}
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
const demoChannels: Channel[] = [...demoGeneralNames.map((name, index) => ({ id: `demo-general-${index}`, tvgId: null, name, logo: null, group: "General", url: DEMO_STREAM })), ...demoSportsNames.map((name, index) => ({ id: `demo-sports-${index}`, tvgId: null, name, logo: null, group: "Sports", url: DEMO_STREAM }))];
// Paired with demoChannels the same way: a placeholder so the preview's "now
// playing" line has something to show before a real EPG source is added.
// Demo channels carry no tvgId, so this is keyed by channel id directly
// rather than going through the real tvg-id/XMLTV matching path.
const demoProgrammeTitles = ["Morning Edition", "Midday Report", "The Afternoon Show", "Prime Time", "Evening Special", "Late Night Replay", "Weekend Wrap", "Feature Presentation"];
const demoNowPlaying: Record<string, NowPlaying> = Object.fromEntries(demoChannels.map((channel, index) => [channel.id, { title: demoProgrammeTitles[index % demoProgrammeTitles.length], stop: new Date(Date.now() + 45 * 60_000).toISOString(), next: { title: demoProgrammeTitles[(index + 1) % demoProgrammeTitles.length], start: new Date(Date.now() + 45 * 60_000).toISOString(), stop: new Date(Date.now() + 105 * 60_000).toISOString() } }]));

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
  const [previewState, setPreviewState] = useState<TvStreamState>("connecting");
  const [diagnosis, setDiagnosis] = useState<Diagnosis | null>(null);
  // The channel actually allowed to open a live connection, one step behind
  // `preview`. Tapping a tile disconnects whatever was playing immediately —
  // the render below only ever mounts one TvStream for the preview slot — but
  // a single-connection IPTV line may not notice the old socket closed the
  // instant the client aborts it. Waiting here before connecting the new one
  // does two things: a fast run of taps through the list never opens more
  // than one connection, for whichever tile the user actually settles on, and
  // that connection gets a beat after the previous one closed before it tries
  // to open.
  const [liveChannel, setLiveChannel] = useState<Channel | null>(null);
  useEffect(() => {
    // No need to clear liveChannel here: isLive below compares ids against
    // the *current* previewChannel, so a stale liveChannel left over from the
    // previous tap already reads as not-live the instant preview changes —
    // this only has to schedule the next connection, never unset the old one.
    if (!preview) return;
    const timer = window.setTimeout(() => setLiveChannel(preview), 500);
    return () => window.clearTimeout(timer);
  }, [preview]);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/tv/channels", { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        if (response.status === 401) throw new Error("This device is not signed in.");
        if (!response.ok) throw new Error(`Channels request failed (${response.status})`);
        return response.json() as Promise<{ channels: Channel[]; playlists: PlaylistResult[]; nowPlaying?: Record<string, NowPlaying>; epgIcons?: Record<string, string> }>;
      })
      .then((data) => setState({ status: "ready", channels: data.channels, playlists: data.playlists, nowPlaying: data.nowPlaying ?? {}, epgIcons: data.epgIcons ?? {} }))
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

  if (state.status === "loading") return <section className="tv-screen tv-message"><span>Loading channels…</span></section>;
  if (state.status === "error") return <section className="tv-screen tv-message"><strong>Channels unavailable</strong><span>{state.message}</span><DiagnosisNote diagnosis={diagnosis} /></section>;
  // Placed after the loading/error guards (not before) so state is narrowed
  // to "ready" here — playing is only ever set from buttons that exist in the
  // ready-state tree, so this can never actually fire while state isn't ready.
  if (playing) return <TvPlayer key={playing.id} channel={playing} poster={playing.logo || (playing.tvgId ? state.epgIcons[playing.tvgId] : undefined) || null} onBack={() => setPlaying(null)} />;

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
  // Nothing is selected until the user taps a tile. Falling back to matches[0]
  // here used to mean the first channel in the list was always shown as
  // selected — and, worse, the preview pane below connects a live stream the
  // instant a channel becomes "selected", so that fallback opened an
  // unrequested stream on load. Most IPTV lines allow exactly one concurrent
  // connection: that phantom stream can hold the account's only slot, so the
  // channel the user actually taps next gets refused as already in use.
  const previewChannel = preview && matches.some((channel) => channel.id === preview.id) ? preview : null;
  const previewNowPlaying = previewChannel && showingDemoChannels
    ? demoNowPlaying[previewChannel.id]
    : previewChannel?.tvgId ? state.nowPlaying[previewChannel.tvgId] : undefined;
  // M3U's own tvg-logo wins when a provider set one; the EPG's <icon> for the
  // matching tvg-id is the fallback, since a channel that has a schedule
  // usually has branding too even when the playlist itself carries none.
  const resolveLogo = (channel: Channel): string | null => channel.logo || (channel.tvgId ? state.epgIcons[channel.tvgId] : undefined) || null;
  const channelSection = (title: string, channelsInSection: Channel[], tone: "general" | "sports") => channelsInSection.length > 0 && <section className={`tv-channel-section tv-channel-${tone}`} aria-label={`${title} channels`}><header><h3>{title}</h3><span>{channelsInSection.length} channels</span></header><div className="tv-grid">{channelsInSection.map((channel) => <ChannelTile key={channel.id} channel={channel} poster={resolveLogo(channel)} active={previewChannel?.id === channel.id} onSelect={() => setPreview(channel)} />)}</div></section>;
  // Only actually stream once liveChannel has caught up with the current
  // selection — during the gap in between, the tapped tile is already
  // highlighted and its name is already showing below, just not yet playing.
  const isLive = liveChannel !== null && previewChannel !== null && liveChannel.id === previewChannel.id;

  return <section className="tv-screen">
    {(failed.length > 0 || truncated.length > 0) && <div className="tv-notices">
      {failed.map((playlist) => <span key={playlist.id} className="tv-warning">{playlist.name}: {playlist.error}</span>)}
      {truncated.map((playlist) => <span key={playlist.id} className="tv-warning">{playlist.name}: showing the first {playlist.channelCount.toLocaleString()} channels only.</span>)}
    </div>}
    {matches.length === 0 ? <div className="tv-grid-empty">No channel matches that search.</div> : <div className="tv-content">
      <div className="tv-channel-list"><div className="tv-channel-groups">{channelSection("General", general, "general")}{channelSection("Sports", sports, "sports")}</div></div>
      {/* Kept in the layout whether or not a channel is selected, so the grid
          doesn't reflow to full width the moment something is picked — but the
          stream itself only mounts once liveChannel has caught up with the
          tap, never before. */}
      <aside className="tv-preview" aria-label={previewChannel ? `Preview ${previewChannel.name}` : "Channel preview"}>
        <div className="tv-preview-art">
          {previewChannel
            ? isLive
              ? <>
                <TvStream key={previewChannel.id} channel={previewChannel} poster={resolveLogo(previewChannel)} muted controls={false} className="tv-preview-stage" onStateChange={setPreviewState} />
                {previewState === "playing" && <span className="tv-preview-live"><i /> Live</span>}
              </>
              : <div className="tv-preview-idle"><span>Connecting to {previewChannel.name}…</span></div>
            : <div className="tv-preview-idle"><span>Tap a channel to preview it</span></div>}
        </div>
        <div className="tv-preview-copy">
          <span className="tv-section-kicker">Channel preview</span>
          {previewChannel
            ? <>
              <h2>{previewChannel.name}</h2>
              {previewNowPlaying && <p className="tv-preview-now"><i /><span>Now: {previewNowPlaying.title}</span></p>}
              <p>{previewChannel.group ?? "General entertainment"}</p>
              <button type="button" className="tv-watch" onClick={() => setPlaying(previewChannel)}>Watch live <span aria-hidden="true">→</span></button>
            </>
            : <p>Select a channel on the left — nothing streams until you do.</p>}
        </div>
      </aside>}
    </div>}
    {matches.length > visible.length && <p className="tv-more">Showing the first {visible.length} — keep typing to narrow it down.</p>}
  </section>;
}
