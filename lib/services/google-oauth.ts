import { readServiceCredentials } from "./credential-store";

/**
 * Google Calendar OAuth (Authorization Code flow, offline access).
 *
 * The dashboard only ever needs to *read* events, so the scope is read-only.
 * "Permanent" access here means: request access_type=offline + prompt=consent
 * once to get a refresh token, store that refresh token, and mint a new
 * short-lived access token from it on every request. The refresh token itself
 * only dies if the Google Cloud project stays in "Testing" publish status
 * (7-day forced expiry) or goes unused for 6 months — see the admin panel
 * for a reminder to publish the OAuth consent screen.
 */

// Shared between the connect and callback routes for the CSRF state cookie.
// Lives here rather than in either route.ts because Next.js route handler
// files may only export the recognized HTTP-method/config names — anything
// else fails the build.
export const GOOGLE_OAUTH_STATE_COOKIE = "google_oauth_state";

const GOOGLE_SCOPE = "https://www.googleapis.com/auth/calendar.readonly";
const AUTHORIZE_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

export function buildGoogleAuthorizeUrl(clientId: string, redirectUri: string, state: string) {
  const url = new URL(AUTHORIZE_ENDPOINT);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GOOGLE_SCOPE);
  url.searchParams.set("access_type", "offline");
  // Forces Google to hand back a refresh token even if this account already
  // consented before — without it, a repeat login can silently omit one.
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", state);
  return url.toString();
}

type TokenResponse = { access_token: string; refresh_token?: string; expires_in: number; scope: string; token_type: string };

async function postToken(params: Record<string, string>): Promise<TokenResponse> {
  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params).toString(),
  });
  const data = await response.json() as TokenResponse & { error?: string; error_description?: string };
  if (!response.ok) throw new Error(`Google token request failed (${response.status}): ${data.error_description ?? data.error ?? "unknown error"}`);
  return data;
}

export async function exchangeGoogleCode(clientId: string, clientSecret: string, code: string, redirectUri: string) {
  return postToken({ grant_type: "authorization_code", code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri });
}

async function refreshGoogleAccessToken(clientId: string, clientSecret: string, refreshToken: string) {
  return postToken({ grant_type: "refresh_token", refresh_token: refreshToken, client_id: clientId, client_secret: clientSecret });
}

// Access tokens live ~1hr; keep the last one in memory (per server process) so a
// burst of dashboard polls doesn't hit Google's token endpoint every time.
let cached: { accessToken: string; expiresAt: number } | null = null;

/**
 * Returns a live Google Calendar access token, or null if OAuth has not been
 * set up yet (no client id/secret, or the connect flow was never completed).
 * Throws if the stored refresh token has been revoked or expired — callers
 * already fall back to the mock calendar on any error (see get-dashboard.ts).
 */
export async function getGoogleAccessToken(): Promise<string | null> {
  if (cached && cached.expiresAt > Date.now()) return cached.accessToken;

  const credentials = await readServiceCredentials();
  if (!credentials.googleClientId || !credentials.googleClientSecret || !credentials.googleRefreshToken) return null;

  const tokens = await refreshGoogleAccessToken(credentials.googleClientId, credentials.googleClientSecret, credentials.googleRefreshToken);
  // 60s safety margin so a request never fires with a token that expires mid-flight.
  cached = { accessToken: tokens.access_token, expiresAt: Date.now() + (tokens.expires_in - 60) * 1000 };
  return cached.accessToken;
}
