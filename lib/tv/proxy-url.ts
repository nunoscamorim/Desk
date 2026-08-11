import { createHash, createHmac, timingSafeEqual } from "node:crypto";

const key = () => { const secret = process.env.AUTH_SECRET; if (!secret) throw new Error("AUTH_SECRET is required"); return createHash("sha256").update(secret).digest(); };

/**
 * Signs a URL the proxy is allowed to fetch.
 *
 * HLS is a tree: the manifest the player asks for names variant manifests, which
 * name segments, which may sit on a different CDN host than the playlist did.
 * Proxying only what matches the configured playlist's origin would therefore
 * break on the first segment, but allowing any host at all turns the proxy into
 * an open relay pointed at the internal network.
 *
 * So there are two ways in. A URL whose origin belongs to a configured playlist
 * is accepted directly — that is the entry point. Everything past it is reached
 * through a URL this server itself wrote into a manifest it had already decided
 * to fetch, and carries this signature to prove it. No state, and no way to
 * point the proxy somewhere it was not already going.
 */
export const signProxyUrl = (url: string): string => createHmac("sha256", key()).update(url).digest("base64url").slice(0, 32);

export function isSignedProxyUrl(url: string, signature: string | null): boolean {
  if (!signature) return false;
  const expected = Buffer.from(signProxyUrl(url));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export const proxyPathFor = (url: string): string => `/api/tv/proxy?url=${encodeURIComponent(url)}&sig=${signProxyUrl(url)}`;
