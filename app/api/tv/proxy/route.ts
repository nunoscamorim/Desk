import { getChannels } from "@/lib/tv/playlist";
import { isSignedProxyUrl, proxyPathFor } from "@/lib/tv/proxy-url";
import { isAdminAuthenticated, isPasswordConfigured } from "@/lib/auth";

/**
 * Relays a stream for browsers that cannot reach it directly.
 *
 * The iPad never uses this: Safari plays HLS natively and native playback is not
 * subject to CORS, so streams go straight from the source and none of this
 * bandwidth touches the server. It exists for hls.js in other browsers, which
 * fetches segments over XHR and is blocked whenever the source omits CORS
 * headers — which most of them do.
 */

const MANIFEST_HINTS = ["application/vnd.apple.mpegurl", "application/x-mpegurl", "audio/mpegurl"];

const looksLikeManifest = (url: string, contentType: string | null) =>
  MANIFEST_HINTS.some((hint) => contentType?.toLowerCase().includes(hint)) || new URL(url).pathname.toLowerCase().endsWith(".m3u8");

/** Origins of every configured playlist and the channels parsed out of them. */
async function allowedOrigins(): Promise<Set<string>> {
  const { channels } = await getChannels();
  const origins = new Set<string>();
  for (const channel of channels) { try { origins.add(new URL(channel.url).origin); } catch { /* skip unparseable */ } }
  return origins;
}

/**
 * Rewrites every URI inside a manifest to come back through this proxy.
 *
 * Without this the proxy is useless: the player would fetch the manifest through
 * here, then read segment URLs pointing straight at the origin and hit exactly
 * the CORS wall the proxy exists to get around. Relative URIs are resolved
 * against the manifest's own URL first, and the two attribute-carried URIs —
 * EXT-X-KEY for the decryption key and EXT-X-MAP for the init segment — are
 * rewritten too, since a stream fails just as completely without either.
 */
function rewriteManifest(body: string, manifestUrl: string): string {
  const absolute = (uri: string) => { try { return new URL(uri, manifestUrl).toString(); } catch { return null; } };
  const wrap = (uri: string) => { const resolved = absolute(uri); return resolved ? proxyPathFor(resolved) : uri; };

  return body.split(/\r?\n/).map((raw) => {
    const line = raw.trim();
    if (!line) return raw;
    if (line.startsWith("#")) {
      if (!/^#EXT-X-(KEY|MAP|MEDIA|I-FRAME-STREAM-INF|PART|PRELOAD-HINT|RENDITION-REPORT)/i.test(line)) return raw;
      return line.replace(/URI="([^"]+)"/gi, (_match, uri: string) => `URI="${wrap(uri)}"`);
    }
    return wrap(line);
  }).join("\n");
}

export async function GET(request: Request) {
  if (isPasswordConfigured() && !(await isAdminAuthenticated())) return new Response("Authentication required", { status: 401 });

  const params = new URL(request.url).searchParams;
  const target = params.get("url");
  if (!target) return new Response("Missing url", { status: 400 });

  let parsed: URL;
  try { parsed = new URL(target); } catch { return new Response("Invalid url", { status: 400 }); }
  // Blocks file:, data:, gopher: and the rest before anything is fetched.
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return new Response("Unsupported protocol", { status: 400 });

  const signed = isSignedProxyUrl(target, params.get("sig"));
  if (!signed && !(await allowedOrigins()).has(parsed.origin)) return new Response("Host is not in a configured playlist", { status: 400 });

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      cache: "no-store",
      redirect: "follow",
      // Providers commonly gate on these, and a bare server-side fetch is
      // rejected where the same request from a player is not.
      headers: { "user-agent": request.headers.get("user-agent") ?? "VLC/3.0.20 LibVLC/3.0.20", ...(request.headers.get("range") ? { range: request.headers.get("range")! } : {}) },
    });
  } catch (error) {
    return new Response(`Upstream request failed: ${error instanceof Error ? error.message : String(error)}`, { status: 502 });
  }

  if (!upstream.ok) return new Response(`Upstream returned ${upstream.status}`, { status: upstream.status === 404 ? 404 : 502 });

  const contentType = upstream.headers.get("content-type");

  if (looksLikeManifest(upstream.url || target, contentType)) {
    const rewritten = rewriteManifest(await upstream.text(), upstream.url || target);
    return new Response(rewritten, { status: 200, headers: { "content-type": "application/vnd.apple.mpegurl", "cache-control": "no-store" } });
  }

  // Segments are piped through untouched so nothing is buffered in memory.
  const headers = new Headers({ "cache-control": "no-store" });
  for (const header of ["content-type", "content-length", "accept-ranges", "content-range"]) {
    const value = upstream.headers.get(header);
    if (value) headers.set(header, value);
  }
  return new Response(upstream.body, { status: upstream.status, headers });
}
