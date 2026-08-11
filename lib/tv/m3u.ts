export type Channel = {
  /** Stable within a playlist: the provider's tvg-id when present, else derived. */
  id: string;
  name: string;
  logo: string | null;
  group: string | null;
  url: string;
};

export type ParseResult = { channels: Channel[]; truncated: boolean };

/**
 * A playlist that parses to more entries than this is not the curated list this
 * screen is built for — it is somebody's full provider dump. Rendering 50,000
 * tiles would lock the iPad up, so the list is cut and the UI says so.
 */
export const MAX_CHANNELS = 1000;

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

    const url = line;
    if (!/^https?:\/\//i.test(url)) { pending = null; continue; }

    let id = pending.tvgId ?? `${pending.name}|${url}`;
    while (seen.has(id)) id = `${id}|${channels.length}`;
    seen.add(id);

    channels.push({ id, name: pending.name, logo: pending.logo, group: pending.group, url });
    pending = null;

    if (channels.length >= MAX_CHANNELS) return { channels, truncated: true };
  }

  return { channels, truncated: false };
}
