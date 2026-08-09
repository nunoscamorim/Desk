import { randomUUID } from "node:crypto";
import { isAdminAuthenticated } from "@/lib/auth";
import { publicOrigin } from "@/lib/http/public-origin";
import { readServiceCredentials } from "@/lib/services/credential-store";
import { buildGoogleAuthorizeUrl, GOOGLE_OAUTH_STATE_COOKIE } from "@/lib/services/google-oauth";

export async function GET(request: Request) {
  if (!(await isAdminAuthenticated())) return Response.json({ error: "Authentication required" }, { status: 401 });

  const credentials = await readServiceCredentials();
  if (!credentials.googleClientId || !credentials.googleClientSecret) {
    return Response.redirect(`${publicOrigin(request)}/admin/credentials?google_error=missing_client`, 302);
  }

  const redirectUri = `${publicOrigin(request)}/api/auth/google-calendar/callback`;
  const state = randomUUID();
  const authorizeUrl = buildGoogleAuthorizeUrl(credentials.googleClientId, redirectUri, state);

  const response = Response.redirect(authorizeUrl, 302);
  // 10 minutes is generous for a consent screen click-through; short-lived on purpose
  // since this cookie only exists to prove the callback belongs to this connect attempt.
  response.headers.append("Set-Cookie", `${GOOGLE_OAUTH_STATE_COOKIE}=${state}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600${process.env.NODE_ENV === "production" ? "; Secure" : ""}`);
  return response;
}
