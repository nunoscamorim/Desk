import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type Playlist = { id: string; name: string; url: string };

const filePath = path.join(process.cwd(), "data", "tv-playlists.enc");
const key = () => { const secret = process.env.AUTH_SECRET; if (!secret) throw new Error("AUTH_SECRET is required"); return createHash("sha256").update(secret).digest(); };

/**
 * Playlists are stored encrypted, the same way service credentials are.
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

  try {
    const [ivText, tagText, payload] = encoded.split(":");
    const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(ivText, "hex"));
    decipher.setAuthTag(Buffer.from(tagText, "hex"));
    const parsed = JSON.parse(Buffer.concat([decipher.update(Buffer.from(payload, "base64")), decipher.final()]).toString("utf8")) as Playlist[];
    return Array.isArray(parsed) ? parsed.filter((entry) => entry && typeof entry.url === "string") : [];
  } catch (error) {
    console.error(`[tv] ${filePath} exists but could not be decrypted — AUTH_SECRET likely changed since it was written. The TV screen will read as having no playlists until it is restored.`, error);
    return [];
  }
}

export async function writePlaylists(playlists: Playlist[]) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(playlists), "utf8"), cipher.final()]);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${iv.toString("hex")}:${cipher.getAuthTag().toString("hex")}:${encrypted.toString("base64")}\n`, "utf8");
}
