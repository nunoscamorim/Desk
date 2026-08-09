/**
 * The origin a browser can actually reach, derived from forwarded headers.
 *
 * Behind Coolify/Traefik the app only ever sees plain HTTP internally, so
 * request.url's own protocol/host are wrong for anything that has to match
 * exactly across a round trip — like an OAuth redirect_uri, which Google
 * rejects if the value sent to /authorize doesn't byte-for-byte match the
 * value sent back to /token.
 */
export function publicOrigin(request: Request) {
  const headers = request.headers;
  const proto = (headers.get("x-forwarded-proto") ?? new URL(request.url).protocol.replace(":", "")).split(",")[0].trim();
  const host = headers.get("x-forwarded-host") ?? headers.get("host") ?? new URL(request.url).host;
  return `${proto}://${host}`;
}
