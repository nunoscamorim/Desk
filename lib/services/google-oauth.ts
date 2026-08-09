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

const TOKEN_TIMEOUT_MS = 8000;
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

/**
 * Raised when Google rejects the stored refresh token itself (`invalid_grant`).
 * This is not retryable: the grant is gone — revoked from the account, expired
 * because the OAuth consent screen is still in "Testing", or unused for six
 * months — and the only cure is running the connect flow again. Kept distinct
 * from transient network/5xx failures so the dashboard can say which happened.
 */
export class GoogleReauthRequiredError extends Error {
  constructor(detail: string) { super(`Google Calendar must be reconnected: ${detail}`); this.name = "GoogleReauthRequiredError"; }
}

async function postToken(params: Record<string, string>): Promise<TokenResponse> {
  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params).toString(),
    signal: AbortSignal.timeout(TOKEN_TIMEOUT_MS),
  });
  const data = await response.json() as TokenResponse & { error?: string; error_description?: string };
  if (!response.ok) {
    const detail = data.error_description ?? data.error ?? "unknown error";
    if (data.error === "invalid_grant") throw new GoogleReauthRequiredError(detail);
    throw new Error(`Google token request failed (${response.status}): ${detail}`);
  }
  return data;
}

export async function exchangeGoogleCode(clientId: string, clientSecret: string, code: string, redirectUri: string) {
  return postToken({ grant_type: "authorization_code", code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri });
}

async function refreshGoogleAccessToken(clientId: string, clientSecret: string, refreshToken: string) {
  return postToken({ grant_type: "refresh_token", refresh_token: refreshToken, client_id: clientId, client_secret: clientSecret });
}

// Access tokens live ~1hr; keep the last one in memory (per server process) so a
// burst of dashboard polls doesn't hit Google's token endpoint every time. The
// refresh token that minted it is kept alongside so that reconnecting the
// account retires the old access token instead of serving it until it expires.
let cached: { accessToken: string; expiresAt: number; refreshToken: string } | null = null;

/**
 * Returns a live Google Calendar access token, or null if OAuth has not been
 * set up yet (no client id/secret, or the connect flow was never completed).
 *
 * Pass `forceRefresh` after Google rejects a token with 401: an access token can
 * stop being accepted before the cached expiry says it should — revoked grant,
 * password change, clock skew — and without a forced re-mint the process would
 * keep replaying the dead token from cache until it aged out on its own. That is
 * the "worked for a while, then failed until restart" failure mode.
 *
 * Throws GoogleReauthRequiredError if the refresh token itself is dead; callers
 * fall back to an empty calendar on any error (see get-dashboard.ts).
 */
export async function getGoogleAccessToken(options?: { forceRefresh?: boolean }): Promise<string | null> {
  const credentials = await readServiceCredentials();
  if (!credentials.googleClientId || !credentials.googleClientSecret || !credentials.googleRefreshToken) {
    // Credentials went away (or stopped being readable) — never keep serving a
    // token minted from a grant this process can no longer prove it holds.
    cached = null;
    return null;
  }

  const usable = cached && cached.expiresAt > Date.now() && cached.refreshToken === credentials.googleRefreshToken;
  if (usable && !options?.forceRefresh) return cached!.accessToken;

  try {
    const tokens = await refreshGoogleAccessToken(credentials.googleClientId, credentials.googleClientSecret, credentials.googleRefreshToken);
    // 60s safety margin so a request never fires with a token that expires mid-flight.
    const lifetimeSeconds = Number.isFinite(tokens.expires_in) ? tokens.expires_in : 3600;
    cached = { accessToken: tokens.access_token, expiresAt: Date.now() + Math.max(30, lifetimeSeconds - 60) * 1000, refreshToken: credentials.googleRefreshToken };
    return cached.accessToken;
  } catch (error) {
    // A failed refresh must not leave a stale token behind to be replayed.
    cached = null;
    throw error;
  }
}
