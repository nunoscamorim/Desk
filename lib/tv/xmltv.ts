export type EpgChannel = { id: string; displayName: string; icon: string | null };
export type EpgProgramme = { channelId: string; start: string; stop: string; title: string; description: string | null };
export type XmltvParseResult = { channels: EpgChannel[]; programmes: EpgProgramme[]; truncated: boolean };

/**
 * Ceiling on parsed programmes. A single channel's day is roughly 20-40
 * entries, so this covers hundreds of channels for a week — a backstop
 * against a pathological file, the same role MAX_CHANNELS plays for M3U.
 */
export const MAX_PROGRAMMES = 100000;

const attribute = (tag: string, name: string): string | null => {
  const match = new RegExp(`${name}="([^"]*)"`, "i").exec(tag);
  const value = match?.[1]?.trim();
  return value ? value : null;
};

/** Strips a CDATA wrapper and decodes the handful of entities XMLTV feeds actually use. */
const decodeText = (raw: string): string => raw
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
  .replace(/&#x([0-9a-f]+);/gi, (_match, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
  .replace(/&#(\d+);/g, (_match, dec: string) => String.fromCodePoint(parseInt(dec, 10)))
  .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&apos;/g, "'")
  .trim();

const firstElement = (block: string, name: string): string | null => {
  const match = new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)<\\/${name}>`, "i").exec(block);
  return match ? decodeText(match[1]) || null : null;
};

/**
 * XMLTV's timestamp is local wall-clock time plus a zone offset —
 * `YYYYMMDDHHMMSS ±HHMM` (the offset is sometimes omitted, meaning UTC).
 * Converted to a true UTC instant rather than kept as-is, so it sorts and
 * compares the same way every other timestamp in this app already does.
 */
function parseXmltvTime(raw: string): string | null {
  const match = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(?:\s*([+-]\d{4}))?/.exec(raw.trim());
  if (!match) return null;
  const [, year, month, day, hour, minute, second, offset] = match;
  const offsetMinutes = offset ? (offset.startsWith("-") ? -1 : 1) * (Number(offset.slice(1, 3)) * 60 + Number(offset.slice(3, 5))) : 0;
  const utcMs = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second)) - offsetMinutes * 60000;
  return Number.isNaN(utcMs) ? null : new Date(utcMs).toISOString();
}

/**
 * Parses an XMLTV programme guide into channels and programmes.
 *
 * Deliberately pure — no fetching, no caching — matching lib/tv/m3u.ts.
 * Hand-rolled with pattern matching rather than a real XML parser: XMLTV in
 * practice is a flat, repeated sequence of <channel>/<programme> elements,
 * regular enough for this the same way M3U's line-based format is. This is
 * less forgiving of malformed or unusually-structured feeds than a real
 * parser would be — the same trade-off already accepted for M3U.
 */
export function parseXmltv(body: string): XmltvParseResult {
  const channels: EpgChannel[] = [];
  for (const match of body.matchAll(/<channel\b([^>]*)>([\s\S]*?)<\/channel>/gi)) {
    const [, attrs, block] = match;
    const id = attribute(attrs, "id");
    const displayName = firstElement(block, "display-name");
    if (!id || !displayName) continue;
    const iconMatch = /<icon\b[^>]*\bsrc="([^"]*)"/i.exec(block);
    channels.push({ id, displayName, icon: iconMatch?.[1]?.trim() || null });
  }

  const programmes: EpgProgramme[] = [];
  let truncated = false;
  for (const match of body.matchAll(/<programme\b([^>]*)>([\s\S]*?)<\/programme>/gi)) {
    const [, attrs, block] = match;
    const channelId = attribute(attrs, "channel");
    const startRaw = attribute(attrs, "start");
    const stopRaw = attribute(attrs, "stop");
    const title = firstElement(block, "title");
    if (!channelId || !startRaw || !stopRaw || !title) continue;
    const start = parseXmltvTime(startRaw);
    const stop = parseXmltvTime(stopRaw);
    if (!start || !stop) continue;
    programmes.push({ channelId, start, stop, title, description: firstElement(block, "desc") });
    if (programmes.length >= MAX_PROGRAMMES) { truncated = true; break; }
  }

  return { channels, programmes, truncated };
}
