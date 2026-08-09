import { cookies } from "next/headers";
import { isAdminAuthenticated } from "@/lib/auth";
import { publicOrigin } from "@/lib/http/public-origin";
import { readServiceCredentials, writeServiceCredentials } from "@/lib/services/credential-store";
import { exchangeSpotifyCode, SPOTIFY_OAUTH_STATE_COOKIE } from "@/lib/services/spotify-oauth";

export async function GET(request: Request) {
  const origin = publicOrigin(request);
  const redirectTo = (path: string) => Response.redirect(`${origin}${path}`, 302);
  if (!(await isAdminAuthenticated())) return Response.json({ error: "Authentication required" }, { status: 401 });

  const url = new URL(request.url);
  const error = url.searchParams.get("error");
  const code = url.searchParams.get("code");
  const returnedState = url.searchParams.get("state");
  const jar = await cookies();
  const expectedState = jar.get(SPOTIFY_OAUTH_STATE_COOKIE)?.value;
  jar.delete(SPOTIFY_OAUTH_STATE_COOKIE);

  if (error) return redirectTo(`/admin/credentials?spotify_error=${encodeURIComponent(error)}`);
  if (!returnedState || returnedState !== expectedState) return redirectTo("/admin/credentials?spotify_error=state_mismatch");
  if (!code) return redirectTo("/admin/credentials?spotify_error=missing_code");

  const credentials = await readServiceCredentials();
  if (!credentials.spotifyClientId || !credentials.spotifyClientSecret) {
    return redirectTo("/admin/credentials?spotify_error=missing_client");
  }

  try {
    const redirectUri = `${origin}/api/auth/spotify/callback`;
    const tokens = await exchangeSpotifyCode(credentials.spotifyClientId, credentials.spotifyClientSecret, code, redirectUri);
    if (!tokens.refresh_token) return redirectTo("/admin/credentials?spotify_error=no_refresh_token");
    await writeServiceCredentials({ ...credentials, spotifyRefreshToken: tokens.refresh_token });
    return redirectTo("/admin/credentials?spotify=connected");
  } catch {
    return redirectTo("/admin/credentials?spotify_error=exchange_failed");
  }
}
