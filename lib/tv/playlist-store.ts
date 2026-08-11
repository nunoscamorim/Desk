import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * A playlist is either fetched from a URL or uploaded as a file.
 *
 * Kept as a discriminated union rather than optional fields so nothing can be
 * half of each — an entry with neither a URL nor a stored file would read as a
 * playlist that silently never loads.
 */
export type Playlist =
  | { id: string; name: string; source: "url"; url: string }
  | { id: string; name: string; source: "xtream"; server: string; username: string; password: string; categories: string[]; channels: string[] }
  | { id: string; name: string; source: "upload"; file: string; bytes: number; uploadedAt: string };

const dataDir = path.join(process.cwd(), "data");
const filePath = path.join(dataDir, "tv-playlists.enc");
export const uploadsDir = path.join(dataDir, "tv-uploads");

const key = () => { const secret = process.env.AUTH_SECRET; if (!secret) throw new Error("AUTH_SECRET is required"); return createHash("sha256").update(secret).digest(); };

/** Guards against a stored name escaping the uploads directory. */
export const uploadPath = (file: string) => path.join(uploadsDir, path.basename(file));

const isPlaylist = (value: unknown): value is Playlist => {
  if (!value || typeof value !== "object") return false;
  const entry = value as Partial<Playlist> & { source?: string };
  if (typeof entry.id !== "string" || typeof entry.name !== "string") return false;
  if (entry.source === "upload") return typeof (entry as { file?: unknown }).file === "string";
  if (entry.source === "xtream") return typeof (entry as { server?: unknown }).server === "string" && typeof (entry as { username?: unknown }).username === "string" && typeof (entry as { password?: unknown }).password === "string";
  // Entries written before uploads existed have no source and are URL playlists.
  return typeof (entry as { url?: unknown }).url === "string";
};

const withSource = (entry: Playlist): Playlist => {
  if (entry.source === "xtream") return { ...entry, categories: entry.categories ?? [], channels: entry.channels ?? [] };
  return entry.source ? entry : { ...(entry as Playlist), source: "url" } as Playlist;
};

/**
 * The index of playlists is stored encrypted, the same way service credentials
 * are.
 *
 * This is not belt-and-braces: a provider M3U URL is a bearer credential —
 * `…/get.php?username=…&password=…` — and everything else under data/ is
 * committed to this repository. A plaintext store here would put a working
 * subscription URL into git history on the next commit.
 *
 * A file that exists but will not decrypt is reported loudly rather than read as
 * "no playlists configured", because AUTH_SECRET changing between deploys is the
 * usual cause and the two states are otherwise indistinguishable.
 */
export async function readPlaylists(): Promise<Playlist[]> {
  let encoded: string;
  try { encoded = await readFile(filePath, "utf8"); } catch { return []; }

  // Deliberately outside the catch below. key() throws when AUTH_SECRET is
  // unset, and swallowing that alongside a genuine decryption failure reported
  // a misconfigured deployment as a corrupt file — while silently returning no
  // playlists, which looks identical to never having added one.
  if (!process.env.AUTH_SECRET) throw new Error("AUTH_SECRET is not set, so saved playlists cannot be read");

  try {
    const [ivText, tagText, payload] = encoded.split(":");
    const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(ivText, "hex"));
    decipher.setAuthTag(Buffer.from(tagText, "hex"));
    const parsed = JSON.parse(Buffer.concat([decipher.update(Buffer.from(payload, "base64")), decipher.final()]).toString("utf8")) as unknown;
    return Array.isArray(parsed) ? parsed.filter(isPlaylist).map(withSource) : [];
  } catch (error) {
    console.error(`[tv] ${filePath} exists but could not be decrypted — AUTH_SECRET likely changed since it was written. The TV screen will read as having no playlists until it is restored.`, error);
    return [];
  }
}

export async function writePlaylists(playlists: Playlist[]) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(playlists), "utf8"), cipher.final()]);
  await mkdir(dataDir, { recursive: true });
  await writeFile(filePath, `${iv.toString("hex")}:${cipher.getAuthTag().toString("hex")}:${encrypted.toString("base64")}\n`, "utf8");
}

/** Saves uploaded playlist text and returns the entry describing it. */
export async function saveUpload(name: string, body: string): Promise<Playlist> {
  await mkdir(uploadsDir, { recursive: true });
  const id = randomUUID();
  const file = `${id}.m3u`;
  await writeFile(uploadPath(file), body, "utf8");
  return { id, name, source: "upload", file, bytes: Buffer.byteLength(body, "utf8"), uploadedAt: new Date().toISOString() };
}

/**
 * Removes upload files no longer referenced by the saved index.
 *
 * Called after every write rather than on delete specifically, so a file cannot
 * be orphaned by a path that forgot to clean up after itself — the index is the
 * single source of truth for what should exist on disk.
 */
export async function pruneUploads(playlists: Playlist[]) {
  const keep = new Set(playlists.filter((entry) => entry.source === "upload").map((entry) => entry.file));
  const { readdir } = await import("node:fs/promises");
  let present: string[];
  try { present = await readdir(uploadsDir); } catch { return; }
  await Promise.all(present.filter((file) => !keep.has(file)).map((file) => rm(uploadPath(file), { force: true }).catch(() => undefined)));
}
