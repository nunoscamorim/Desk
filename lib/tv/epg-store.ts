import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * An EPG source is either fetched from a URL or uploaded as a file — the same
 * shape as a TV playlist (lib/tv/playlist-store.ts), for the same reason: kept
 * as a discriminated union so nothing can be half of each.
 */
export type EpgSource =
  | { id: string; name: string; source: "url"; url: string }
  | { id: string; name: string; source: "upload"; file: string; bytes: number; uploadedAt: string };

const dataDir = path.join(process.cwd(), "data");
const filePath = path.join(dataDir, "tv-epg.enc");
export const epgUploadsDir = path.join(dataDir, "tv-epg-uploads");

const key = () => { const secret = process.env.AUTH_SECRET; if (!secret) throw new Error("AUTH_SECRET is required"); return createHash("sha256").update(secret).digest(); };

/** Guards against a stored name escaping the uploads directory. */
export const epgUploadPath = (file: string) => path.join(epgUploadsDir, path.basename(file));

const isEpgSource = (value: unknown): value is EpgSource => {
  if (!value || typeof value !== "object") return false;
  const entry = value as Partial<EpgSource> & { source?: string };
  if (typeof entry.id !== "string" || typeof entry.name !== "string") return false;
  if (entry.source === "upload") return typeof (entry as { file?: unknown }).file === "string";
  return typeof (entry as { url?: unknown }).url === "string";
};

/**
 * The index of EPG sources is stored encrypted, the same way TV playlists are
 * — an XMLTV URL is as likely to carry a subscription's credentials as an M3U
 * one, and everything else under data/ is committed to this repository.
 *
 * A file that exists but will not decrypt is reported loudly rather than read
 * as "no sources configured", because AUTH_SECRET changing between deploys is
 * the usual cause and the two states are otherwise indistinguishable.
 */
export async function readEpgSources(): Promise<EpgSource[]> {
  let encoded: string;
  try { encoded = await readFile(filePath, "utf8"); } catch { return []; }

  if (!process.env.AUTH_SECRET) throw new Error("AUTH_SECRET is not set, so saved EPG sources cannot be read");

  try {
    const [ivText, tagText, payload] = encoded.split(":");
    const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(ivText, "hex"));
    decipher.setAuthTag(Buffer.from(tagText, "hex"));
    const parsed = JSON.parse(Buffer.concat([decipher.update(Buffer.from(payload, "base64")), decipher.final()]).toString("utf8")) as unknown;
    return Array.isArray(parsed) ? parsed.filter(isEpgSource) : [];
  } catch (error) {
    console.error(`[tv] ${filePath} exists but could not be decrypted — AUTH_SECRET likely changed since it was written. The EPG will read as having no sources until it is restored.`, error);
    return [];
  }
}

export async function writeEpgSources(sources: EpgSource[]) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(sources), "utf8"), cipher.final()]);
  await mkdir(dataDir, { recursive: true });
  await writeFile(filePath, `${iv.toString("hex")}:${cipher.getAuthTag().toString("hex")}:${encrypted.toString("base64")}\n`, "utf8");
}

/** Saves an uploaded XMLTV file and returns the entry describing it. */
export async function saveEpgUpload(name: string, body: string): Promise<EpgSource> {
  await mkdir(epgUploadsDir, { recursive: true });
  const id = randomUUID();
  const file = `${id}.xml`;
  await writeFile(epgUploadPath(file), body, "utf8");
  return { id, name, source: "upload", file, bytes: Buffer.byteLength(body, "utf8"), uploadedAt: new Date().toISOString() };
}

/**
 * Removes upload files no longer referenced by the saved index. Called after
 * every write rather than on delete specifically, so a file cannot be
 * orphaned by a path that forgot to clean up after itself.
 */
export async function pruneEpgUploads(sources: EpgSource[]) {
  const keep = new Set(sources.filter((entry) => entry.source === "upload").map((entry) => entry.file));
  const { readdir } = await import("node:fs/promises");
  let present: string[];
  try { present = await readdir(epgUploadsDir); } catch { return; }
  await Promise.all(present.filter((file) => !keep.has(file)).map((file) => rm(epgUploadPath(file), { force: true }).catch(() => undefined)));
}
