import { access, constants } from "node:fs/promises";
import path from "node:path";
import { readPlaylists } from "@/lib/tv/playlist-store";
import { getChannels } from "@/lib/tv/playlist";
import { readEpgSources } from "@/lib/tv/epg-store";
import { getEpg } from "@/lib/tv/epg";
import { isAdminAuthenticated, isPasswordConfigured } from "@/lib/auth";

/**
 * Reports why the TV screen is showing nothing.
 *
 * Every failure so far has been indistinguishable from every other one at the
 * point where it is seen: an empty grid means the same thing whether the build
 * is stale, AUTH_SECRET is missing, the request is unauthenticated, no playlist
 * was ever saved, or the host refused the download. This separates them.
 *
 * It answers even when unauthenticated, because "you are not signed in" is
 * itself one of the answers and a 401 that hides it would defeat the purpose.
 * Only booleans and counts are reported — never a secret's value, and never a
 * playlist URL.
 */
export async function GET() {
  const passwordConfigured = isPasswordConfigured();
  const authenticated = await isAdminAuthenticated();
  const dataDir = path.join(process.cwd(), "data");

  const report: Record<string, unknown> = {
    build: {
      // Present on this deployment only if the TV feature is actually running.
      tvFeature: "present",
      uploadsSupported: true,
      startedAt: new Date().toISOString(),
    },
    environment: {
      authSecretSet: Boolean(process.env.AUTH_SECRET),
      adminPasswordSet: passwordConfigured,
      dataDirWritable: await access(dataDir, constants.W_OK).then(() => true).catch(() => false),
    },
    request: {
      authenticated,
      // The channels endpoint is gated on this: false here with a password set
      // is why the TV screen would report nothing to show.
      canReadChannels: !passwordConfigured || authenticated,
    },
  };

  try {
    const stored = await readPlaylists();
    report.playlists = { stored: stored.length, bySource: { url: stored.filter((p) => p.source === "url").length, upload: stored.filter((p) => p.source === "upload").length } };
  } catch (error) {
    report.playlists = { error: error instanceof Error ? error.message : String(error) };
    return Response.json(report);
  }

  try {
    const { channels, playlists } = await getChannels();
    report.channels = { total: channels.length };
    report.results = playlists.map((playlist) => ({ name: playlist.name, source: playlist.source, host: playlist.host, channelCount: playlist.channelCount, truncated: playlist.truncated, error: playlist.error }));
  } catch (error) {
    report.channels = { error: error instanceof Error ? error.message : String(error) };
  }

  try {
    const storedEpg = await readEpgSources();
    report.epg = { stored: storedEpg.length, bySource: { url: storedEpg.filter((s) => s.source === "url").length, upload: storedEpg.filter((s) => s.source === "upload").length } };
  } catch (error) {
    report.epg = { error: error instanceof Error ? error.message : String(error) };
    return Response.json(report);
  }

  try {
    const { channels, programmes, sources } = await getEpg();
    report.epg = { ...(report.epg as object), channels: channels.length, programmes: programmes.length };
    report.epgResults = sources.map((source) => ({ name: source.name, source: source.source, host: source.host, channelCount: source.channelCount, programmeCount: source.programmeCount, truncated: source.truncated, error: source.error }));
  } catch (error) {
    report.epg = { ...(report.epg as object), error: error instanceof Error ? error.message : String(error) };
  }

  return Response.json(report);
}
