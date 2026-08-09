import { isAdminAuthenticated } from "@/lib/auth";
import { readServiceCredentials, writeServiceCredentials, type ServiceCredentials } from "@/lib/services/credential-store";

export async function GET() { if (!(await isAdminAuthenticated())) return Response.json({ error: "Authentication required" }, { status: 401 }); const credentials = await readServiceCredentials(); return Response.json({ google: Boolean(credentials.googleClientId && credentials.googleClientSecret), googleConnected: Boolean(credentials.googleRefreshToken), spotify: Boolean(credentials.spotifyClientId && credentials.spotifyClientSecret), spotifyConnected: Boolean(credentials.spotifyRefreshToken) }); }
// Merges onto the existing record rather than overwriting it outright: this form only ever
// submits the client id/secret pair, and a blind overwrite would erase the refresh token that
// the OAuth callback wrote separately (see app/api/auth/google-calendar/callback).
export async function PUT(request: Request) {
  if (!(await isAdminAuthenticated())) return Response.json({ error: "Authentication required" }, { status: 401 });
  const body = await request.json() as ServiceCredentials;
  const existing = await readServiceCredentials();
  await writeServiceCredentials({
    ...existing,
    googleClientId: body.googleClientId?.trim() ?? existing.googleClientId,
    googleClientSecret: body.googleClientSecret?.trim() || existing.googleClientSecret,
    spotifyClientId: body.spotifyClientId?.trim() ?? existing.spotifyClientId,
    spotifyClientSecret: body.spotifyClientSecret?.trim() || existing.spotifyClientSecret,
  });
  return Response.json({ saved: true });
}
