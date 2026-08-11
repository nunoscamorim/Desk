import { getChannels } from "@/lib/tv/playlist";
import { isAdminAuthenticated, isPasswordConfigured } from "@/lib/auth";

/**
 * Unlike GET /api/config, which is deliberately open, this one is behind the
 * admin session: channel URLs carry the subscription's username and password,
 * so an open route hands a working subscription to anyone who can reach the
 * host. The kiosk iPad signs in once and its cookie persists.
 *
 * This does not make the credentials secret from the browser — direct playback
 * means the client necessarily receives the real stream URL. It only stops them
 * being readable without logging in first.
 */
export async function GET() {
  if (isPasswordConfigured() && !(await isAdminAuthenticated())) return Response.json({ error: "Authentication required" }, { status: 401 });
  return Response.json(await getChannels());
}
