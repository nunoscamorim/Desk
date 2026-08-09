import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type ServiceCredentials = { googleClientId?: string; googleClientSecret?: string; googleRefreshToken?: string; googleCalendarId?: string; spotifyClientId?: string; spotifyClientSecret?: string; spotifyRefreshToken?: string };
const filePath = path.join(process.cwd(), "data", "service-credentials.enc");
const key = () => { const secret = process.env.AUTH_SECRET; if (!secret) throw new Error("AUTH_SECRET is required"); return createHash("sha256").update(secret).digest(); };

/**
 * Reads the stored integration credentials, or an empty set if none have been
 * saved yet.
 *
 * A file that exists but cannot be decrypted is reported loudly rather than
 * being treated as "not connected": it means AUTH_SECRET no longer matches the
 * one that encrypted it (regenerated between deploys is the usual cause), and
 * every OAuth integration silently reverts to disconnected until it is restored.
 * Failing quietly here is indistinguishable from never having connected, which
 * makes the outage very hard to place.
 */
export async function readServiceCredentials(): Promise<ServiceCredentials> {
  let encoded: string;
  try { encoded = await readFile(filePath, "utf8"); } catch { return {}; }

  try {
    const [ivText, tagText, payload] = encoded.split(":");
    const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(ivText, "hex"));
    decipher.setAuthTag(Buffer.from(tagText, "hex"));
    return JSON.parse(Buffer.concat([decipher.update(Buffer.from(payload, "base64")), decipher.final()]).toString("utf8")) as ServiceCredentials;
  } catch (error) {
    console.error(`[credentials] ${filePath} exists but could not be decrypted — AUTH_SECRET likely changed since it was written. All connected integrations will read as disconnected until it is restored.`, error);
    return {};
  }
}

export async function writeServiceCredentials(credentials: ServiceCredentials) {
  const iv = randomBytes(12); const cipher = createCipheriv("aes-256-gcm", key(), iv); const encrypted = Buffer.concat([cipher.update(JSON.stringify(credentials), "utf8"), cipher.final()]);
  await mkdir(path.dirname(filePath), { recursive: true }); await writeFile(filePath, `${iv.toString("hex")}:${cipher.getAuthTag().toString("hex")}:${encrypted.toString("base64")}\n`, "utf8");
}
