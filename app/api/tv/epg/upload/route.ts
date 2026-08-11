import { pruneEpgUploads, readEpgSources, saveEpgUpload, writeEpgSources } from "@/lib/tv/epg-store";
import { getEpg, invalidateEpgCache } from "@/lib/tv/epg";
import { parseXmltv } from "@/lib/tv/xmltv";
import { isAdminAuthenticated, isPasswordConfigured } from "@/lib/auth";

/** Matches the download ceiling in lib/tv/epg.ts. */
const MAX_UPLOAD_BYTES = 40 * 1024 * 1024;

/**
 * Accepts an XMLTV file and stores it alongside the URL-based EPG sources.
 *
 * The file is parsed before anything is written, so a mistyped or non-XMLTV
 * file is refused with a reason here rather than saved and found empty later.
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
  const parsed = parseXmltv(body);
  if (parsed.channels.length === 0) return Response.json({ error: "No channels found — is this an XMLTV file?" }, { status: 400 });

  const rawName = String(form.get("name") ?? "").trim();
  const entry = await saveEpgUpload(rawName || file.name.replace(/\.[^.]+$/, "") || "Uploaded EPG", body);

  const existing = await readEpgSources();
  const next = [...existing, entry];
  await writeEpgSources(next);
  await pruneEpgUploads(next);
  invalidateEpgCache();

  const { sources } = await getEpg();
  return Response.json({ sources });
}
