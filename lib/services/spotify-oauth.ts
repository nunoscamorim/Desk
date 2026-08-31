import { fetchWithRetry } from "@/lib/http/fetch-with-retry";
import { readServiceCredentials, writeServiceCredentials } from "./credential-store";

export const SPOTIFY_OAUTH_STATE_COOKIE = "spotify_oauth_state";

const SPOTIFY_SCOPE = [
  "user-read-currently-playing",
  "user-read-playback-state",
  "user-read-recently-played",
  "user-modify-playback-state",
  "playlist-read-private",
  "playlist-read-collaborative",
].join(" ");
const AUTHORIZE_ENDPOINT = "https://accounts.spotify.com/authorize";
const TOKEN_ENDPOINT = "https://accounts.spotify.com/api/token";

export function buildSpotifyAuthorizeUrl(clientId: string, redirectUri: string, state: string) {
  const url = new URL(AUTHORIZE_ENDPOINT);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", SPOTIFY_SCOPE);
  url.searchParams.set("state", state);
  return url.toString();
}

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
};

async function postToken(
  clientId: string,
  clientSecret: string,
  params: Record<string, string>,
): Promise<TokenResponse> {
  const authorization = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const response = await fetchWithRetry(TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Basic ${authorization}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(params).toString(),
    cache: "no-store",
  }, { label: "spotify-token" });
  const data = await response.json() as TokenResponse & { error?: string; error_description?: string };
  if (!response.ok) {
    throw new Error(`Spotify token request failed (${response.status}): ${data.error_description ?? data.error ?? "unknown error"}`);
  }
  return data;
}

export function exchangeSpotifyCode(
  clientId: string,
  clientSecret: string,
  code: string,
  redirectUri: string,
) {
  return postToken(clientId, clientSecret, {
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });
}

let cached: { accessToken: string; expiresAt: number; refreshToken: string } | null = null;

export async function getSpotifyAccessToken(): Promise<string | null> {
  const credentials = await readServiceCredentials();
  if (!credentials.spotifyClientId || !credentials.spotifyClientSecret || !credentials.spotifyRefreshToken) return null;
  if (cached && cached.refreshToken === credentials.spotifyRefreshToken && cached.expiresAt > Date.now()) return cached.accessToken;

  const tokens = await postToken(credentials.spotifyClientId, credentials.spotifyClientSecret, {
    grant_type: "refresh_token",
    refresh_token: credentials.spotifyRefreshToken,
  });
  cached = {
    accessToken: tokens.access_token,
    expiresAt: Date.now() + Math.max(0, tokens.expires_in - 60) * 1000,
    refreshToken: tokens.refresh_token ?? credentials.spotifyRefreshToken,
  };
  if (tokens.refresh_token && tokens.refresh_token !== credentials.spotifyRefreshToken) {
    await writeServiceCredentials({ ...credentials, spotifyRefreshToken: tokens.refresh_token });
  }
  return cached.accessToken;
}
