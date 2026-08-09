import { XMLParser } from "fast-xml-parser";
import { fetchWithRetry } from "@/lib/http/fetch-with-retry";

/**
 * Minimal CalDAV client, enough to discover a principal's collections and read
 * them.
 *
 * Apple Reminders has no public API, but iCloud exposes reminder lists over
 * CalDAV as `VTODO` collections, reachable with an Apple ID and an
 * app-specific password. Reaching them takes three hops — the server only tells
 * you where the next one is:
 *
 *   1. the well-known endpoint reports the `current-user-principal`
 *   2. the principal reports its `calendar-home-set`
 *   3. the home collection lists the calendars, each declaring whether it holds
 *      events (`VEVENT`) or reminders (`VTODO`)
 *
 * iCloud answers from a per-account partition host, so every href is resolved
 * against the URL it arrived from rather than assumed to sit under the origin
 * we started at.
 */

const DAV_NS = 'xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"';

// Namespace prefixes vary by server (`d:`, `D:`, or defaulted), so they are
// stripped rather than matched on.
const parser = new XMLParser({ removeNSPrefix: true, ignoreAttributes: false, attributeNamePrefix: "@_" });

/** Multi-status bodies collapse a single <response> to an object; callers always want a list. */
const asArray = <T,>(value: T | T[] | undefined): T[] => (value === undefined ? [] : Array.isArray(value) ? value : [value]);

export type CalDavCollection = { url: string; displayName: string };

export type CalDavAccount = { username: string; password: string; baseUrl: string };

function authorization({ username, password }: CalDavAccount) {
  return `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
}

async function request(account: CalDavAccount, url: string, method: "PROPFIND" | "REPORT", depth: "0" | "1", body: string) {
  const response = await fetchWithRetry(url, {
    method,
    headers: { Authorization: authorization(account), Depth: depth, "Content-Type": 'application/xml; charset="utf-8"' },
    body,
    cache: "no-store",
  }, { label: `caldav-${method.toLowerCase()}` });

  if (response.status === 401) throw new Error("iCloud rejected the credentials — check the Apple ID and app-specific password");
  if (!response.ok) throw new Error(`CalDAV ${method} failed (${response.status})`);
  return parser.parse(await response.text());
}

/** Resolves an href from a multi-status body, which may be a path or absolute. */
const resolve = (href: string, against: string) => new URL(href, against).toString();

const firstHref = (node: unknown): string | null => {
  const href = (node as { href?: string | string[] } | undefined)?.href;
  const value = Array.isArray(href) ? href[0] : href;
  return typeof value === "string" ? value : null;
};

// Multi-status responses nest the values that matter under propstat/prop, and a
// resource can return several propstats (one per status code).
const props = (entry: unknown) => asArray((entry as { propstat?: unknown }).propstat).map((propstat) => (propstat as { prop?: Record<string, unknown> }).prop).filter(Boolean) as Record<string, unknown>[];

const firstProp = (entry: unknown, name: string) => props(entry).map((prop) => prop[name]).find((value) => value !== undefined);

/**
 * Walks discovery and returns the collections holding the requested component
 * type — `VTODO` for reminder lists, `VEVENT` for calendars.
 */
export async function discoverCollections(account: CalDavAccount, component: "VTODO" | "VEVENT"): Promise<CalDavCollection[]> {
  const principalBody = `<?xml version="1.0" encoding="utf-8"?><d:propfind ${DAV_NS}><d:prop><d:current-user-principal/></d:prop></d:propfind>`;
  const principalDoc = await request(account, account.baseUrl, "PROPFIND", "0", principalBody);
  const principalEntry = asArray((principalDoc as { multistatus?: { response?: unknown } }).multistatus?.response)[0];
  const principalHref = principalEntry ? firstHref(firstProp(principalEntry, "current-user-principal")) : null;
  if (!principalHref) throw new Error("CalDAV discovery failed: no current-user-principal returned");
  const principalUrl = resolve(principalHref, account.baseUrl);

  const homeBody = `<?xml version="1.0" encoding="utf-8"?><d:propfind ${DAV_NS}><d:prop><c:calendar-home-set/></d:prop></d:propfind>`;
  const homeDoc = await request(account, principalUrl, "PROPFIND", "0", homeBody);
  const homeEntry = asArray((homeDoc as { multistatus?: { response?: unknown } }).multistatus?.response)[0];
  const homeHref = homeEntry ? firstHref(firstProp(homeEntry, "calendar-home-set")) : null;
  if (!homeHref) throw new Error("CalDAV discovery failed: no calendar-home-set returned");
  const homeUrl = resolve(homeHref, principalUrl);

  const listBody = `<?xml version="1.0" encoding="utf-8"?><d:propfind ${DAV_NS}><d:prop><d:displayname/><d:resourcetype/><c:supported-calendar-component-set/></d:prop></d:propfind>`;
  const listDoc = await request(account, homeUrl, "PROPFIND", "1", listBody);

  return asArray((listDoc as { multistatus?: { response?: unknown } }).multistatus?.response).flatMap((entry) => {
    const supported = firstProp(entry, "supported-calendar-component-set") as { comp?: unknown } | undefined;
    // A collection that does not declare its components cannot be assumed to
    // hold the one we want — iCloud always declares them.
    const holdsComponent = asArray(supported?.comp).some((comp) => (comp as { "@_name"?: string })?.["@_name"] === component);
    if (!holdsComponent) return [];
    const href = (entry as { href?: string | string[] }).href;
    const path = Array.isArray(href) ? href[0] : href;
    if (typeof path !== "string") return [];
    const displayName = firstProp(entry, "displayname");
    return [{ url: resolve(path, homeUrl), displayName: typeof displayName === "string" ? displayName : "" }];
  });
}

/** Fetches every object of the given component type in a collection, as raw iCalendar text. */
export async function fetchCollectionObjects(account: CalDavAccount, collectionUrl: string, component: "VTODO" | "VEVENT"): Promise<string[]> {
  const body = `<?xml version="1.0" encoding="utf-8"?><c:calendar-query ${DAV_NS}><d:prop><c:calendar-data/></d:prop><c:filter><c:comp-filter name="VCALENDAR"><c:comp-filter name="${component}"/></c:comp-filter></c:filter></c:calendar-query>`;
  const doc = await request(account, collectionUrl, "REPORT", "1", body);

  return asArray((doc as { multistatus?: { response?: unknown } }).multistatus?.response).flatMap((entry) => {
    const data = firstProp(entry, "calendar-data");
    // Servers may return the payload as text or wrapped with attributes.
    const text = typeof data === "string" ? data : (data as { "#text"?: string } | undefined)?.["#text"];
    return typeof text === "string" && text.trim() ? [text] : [];
  });
}
