import { pruneUploads, readPlaylists, saveUpload, writePlaylists } from "@/lib/tv/playlist-store";
import { getChannels, invalidatePlaylistCache } from "@/lib/tv/playlist";
import { parseM3u } from "@/lib/tv/m3u";
import { isAdminAuthenticated, isPasswordConfigured } from "@/lib/auth";

/** Matches the download ceiling in lib/tv/playlist.ts. */
const MAX_UPLOAD_BYTES = 40 * 1024 * 1024;

/**
 * Accepts an M3U file and stores it alongside the URL-based playlists.
 *
 * The file is parsed before anything is written, so a mistyped or non-M3U file
 * is refused with a reason here rather than saved and then found to be empty on
 * the TV screen later.
 */
export async function POST(request: Request) {
  if (isPasswordConfigured() && !(await isAdminAuthenticated())) return Response.json({ error: "Authentication required" }, { status: 401 });

  let form: FormData;
  try { form = await request.formData(); } catch { return Response.json({ error: "Expected a file upload" }, { status: 400 }); }

  const file = form.get("file");
  if (!(file instanceof File)) return Response.json({ error: "No file was attached" }, { status: 400 });
  if (file.size === 0) return Response.json({ error: "That file is empty" }, { status: 400 });
  if (file.size > MAX_UPLOAD_BYTES) return Response.json({ error: `File is ${Math.round(file.size / 1024 / 1024)} MB, over the ${MAX_UPLOAD_BYTES / 1024 / 1024} MB limit` }, { status: 400 });

  const body = await file.text();
  const parsed = parseM3u(body);
  if (parsed.channels.length === 0) return Response.json({ error: "No channels found — is this an M3U playlist?" }, { status: 400 });

  const rawName = String(form.get("name") ?? "").trim();
  const entry = await saveUpload(rawName || file.name.replace(/\.[^.]+$/, "") || "Uploaded playlist", body);

  const existing = await readPlaylists();
  const next = [...existing, entry];
  await writePlaylists(next);
  await pruneUploads(next);
  invalidatePlaylistCache();

  const { playlists } = await getChannels();
  return Response.json({ playlists });
}
