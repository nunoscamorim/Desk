export type Channel = {
  /** Stable within a playlist: the provider's tvg-id when present, else derived. */
  id: string;
  /** The provider's own tvg-id, kept distinct from `id` — matches an XMLTV
   *  <channel id> for programme-guide lookups; null when the provider set none. */
  tvgId: string | null;
  name: string;
  logo: string | null;
  group: string | null;
  url: string;
};

export type ParseResult = { channels: Channel[]; truncated: boolean };

/**
 * Ceiling on parsed entries.
 *
 * Public aggregate playlists — iptv-org's country index and the like — run to
 * about ten thousand channels, and cutting them off part-way is worse than
 * useless: the channel you want is as likely to be in the half that was dropped.
 * The screen keeps the whole list and makes it navigable by search instead. This
 * remains only as a backstop against a pathological file.
 */
export const MAX_CHANNELS = 20000;

const attribute = (line: string, name: string): string | null => {
  const match = new RegExp(`${name}="([^"]*)"`, "i").exec(line);
  const value = match?.[1]?.trim();
  return value ? value : null;
};

/**
 * Lines that are directives rather than URLs. `#EXTVLCOPT` and `#KODIPROP`
 * commonly sit between an `#EXTINF` and its URL to carry a user-agent or
 * referrer; treating one as the stream URL yields a channel that can never play.
 */
const isDirective = (line: string) => line.startsWith("#");

/**
 * Parses an M3U/M3U8 playlist into channels.
 *
 * Deliberately pure — no fetching, no caching — so the format handling can be
 * exercised directly against fixtures. Anything it cannot make sense of is
 * dropped rather than guessed at: an `#EXTINF` with no URL after it, or a URL
 * with no `#EXTINF` before it, produces nothing instead of a broken tile.
 *
 * `group` is captured even though nothing filters on it yet. It costs nothing at
 * parse time and means adding category filtering later is a UI change rather
 * than a re-parse of everything already stored.
 */
export function parseM3u(body: string): ParseResult {
  const channels: Channel[] = [];
  const seen = new Set<string>();
  let pending: { name: string; logo: string | null; group: string | null; tvgId: string | null } | null = null;

  // Split on either line ending: providers emit both, and a stray \r on the end
  // of a URL makes it unfetchable.
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;

    if (line.toUpperCase().startsWith("#EXTINF")) {
      // Everything after the last comma is the display name; the attributes
      // before it may themselves contain commas inside quotes.
      const name = line.slice(line.lastIndexOf(",") + 1).trim();
      pending = { name: name || "Untitled channel", logo: attribute(line, "tvg-logo"), group: attribute(line, "group-title"), tvgId: attribute(line, "tvg-id") };
      continue;
    }

    if (isDirective(line)) continue;
    if (!pending) continue;

    // Public lists commonly append Kodi-style playback options to the URL —
    // `…/stream.m3u8|User-Agent=Mozilla&Referer=…`. That pipe and everything
    // after it is not part of the URL, and left attached the stream simply 404s.
    const url = line.split("|")[0].trim();
    if (!/^https?:\/\//i.test(url)) { pending = null; continue; }

    // Falls back to the position rather than to name+url: an aggregate playlist
    // is mostly entries without a tvg-id, and embedding the URL in the id sent a
    // second copy of every stream URL to the browser.
    let id = pending.tvgId ?? String(channels.length);
    while (seen.has(id)) id = `${id}_${channels.length}`;
    seen.add(id);

    channels.push({ id, tvgId: pending.tvgId, name: pending.name, logo: pending.logo, group: pending.group, url });
    pending = null;

    if (channels.length >= MAX_CHANNELS) return { channels, truncated: true };
  }

  return { channels, truncated: false };
}
