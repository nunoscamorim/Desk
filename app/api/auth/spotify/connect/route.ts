import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { publicOrigin } from "@/lib/http/public-origin";
import { readServiceCredentials } from "@/lib/services/credential-store";
import { buildSpotifyAuthorizeUrl, SPOTIFY_OAUTH_STATE_COOKIE } from "@/lib/services/spotify-oauth";

export async function GET(request: Request) {
  if (!(await isAdminAuthenticated())) return Response.json({ error: "Authentication required" }, { status: 401 });

  const credentials = await readServiceCredentials();
  if (!credentials.spotifyClientId || !credentials.spotifyClientSecret) {
    return Response.redirect(`${publicOrigin(request)}/admin/credentials?spotify_error=missing_client`, 302);
  }

  const redirectUri = `${publicOrigin(request)}/api/auth/spotify/callback`;
  const state = randomUUID();
  const response = NextResponse.redirect(new URL(buildSpotifyAuthorizeUrl(credentials.spotifyClientId, redirectUri, state)), 302);
  response.cookies.set(SPOTIFY_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    maxAge: 600,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}
