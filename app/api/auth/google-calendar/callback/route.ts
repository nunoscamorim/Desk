import { cookies } from "next/headers";
import { isAdminAuthenticated } from "@/lib/auth";
import { publicOrigin } from "@/lib/http/public-origin";
import { readServiceCredentials, writeServiceCredentials } from "@/lib/services/credential-store";
import { exchangeGoogleCode, GOOGLE_OAUTH_STATE_COOKIE } from "@/lib/services/google-oauth";

export async function GET(request: Request) {
  const origin = publicOrigin(request);
  const redirectTo = (path: string) => Response.redirect(`${origin}${path}`, 302);

  if (!(await isAdminAuthenticated())) return Response.json({ error: "Authentication required" }, { status: 401 });

  const url = new URL(request.url);
  const error = url.searchParams.get("error");
  const code = url.searchParams.get("code");
  const returnedState = url.searchParams.get("state");

  const jar = await cookies();
  const expectedState = jar.get(GOOGLE_OAUTH_STATE_COOKIE)?.value;
  jar.delete(GOOGLE_OAUTH_STATE_COOKIE);

  if (error) return redirectTo(`/admin/credentials?google_error=${encodeURIComponent(error)}`);
  if (!returnedState || returnedState !== expectedState) return redirectTo("/admin/credentials?google_error=state_mismatch");
  if (!code) return redirectTo("/admin/credentials?google_error=missing_code");

  const credentials = await readServiceCredentials();
  if (!credentials.googleClientId || !credentials.googleClientSecret) {
    return redirectTo("/admin/credentials?google_error=missing_client");
  }

  try {
    // Must match the redirect_uri sent in the /connect step exactly, or Google
    // rejects the exchange — publicOrigin() computes it the same way both times.
    const redirectUri = `${origin}/api/auth/google-calendar/callback`;
    const tokens = await exchangeGoogleCode(credentials.googleClientId, credentials.googleClientSecret, code, redirectUri);

    if (!tokens.refresh_token) {
      // Happens when the account already granted consent before and Google decided
      // not to issue a new refresh token despite prompt=consent — rare, but the
      // connect flow can't recover from it silently, so surface it plainly.
      return redirectTo("/admin/credentials?google_error=no_refresh_token");
    }

    await writeServiceCredentials({ ...credentials, googleRefreshToken: tokens.refresh_token });
    return redirectTo("/admin/credentials?google=connected");
  } catch {
    return redirectTo("/admin/credentials?google_error=exchange_failed");
  }
}
