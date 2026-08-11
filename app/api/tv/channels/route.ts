import { getChannels } from "@/lib/tv/playlist";
import { getNowPlayingByChannel } from "@/lib/tv/epg";
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
  const channelSet = await getChannels();
  // Best-effort: a broken or unconfigured EPG should never take the channel
  // grid down with it, so a lookup failure here just means no "now playing"
  // annotations rather than a failed request.
  const nowPlaying = await getNowPlayingByChannel().catch(() => ({}));
  return Response.json({ ...channelSet, nowPlaying });
}
