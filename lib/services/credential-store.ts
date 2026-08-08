import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type ServiceCredentials = { googleClientId?: string; googleClientSecret?: string; spotifyClientId?: string; spotifyClientSecret?: string };
const filePath = path.join(process.cwd(), "data", "service-credentials.enc");
const key = () => { const secret = process.env.AUTH_SECRET; if (!secret) throw new Error("AUTH_SECRET is required"); return createHash("sha256").update(secret).digest(); };

export async function readServiceCredentials(): Promise<ServiceCredentials> {
  try { const encoded = await readFile(filePath, "utf8"); const [ivText, tagText, payload] = encoded.split(":"); const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(ivText, "hex")); decipher.setAuthTag(Buffer.from(tagText, "hex")); return JSON.parse(Buffer.concat([decipher.update(Buffer.from(payload, "base64")), decipher.final()]).toString("utf8")) as ServiceCredentials; } catch { return {}; }
}

export async function writeServiceCredentials(credentials: ServiceCredentials) {
  const iv = randomBytes(12); const cipher = createCipheriv("aes-256-gcm", key(), iv); const encrypted = Buffer.concat([cipher.update(JSON.stringify(credentials), "utf8"), cipher.final()]);
  await mkdir(path.dirname(filePath), { recursive: true }); await writeFile(filePath, `${iv.toString("hex")}:${cipher.getAuthTag().toString("hex")}:${encrypted.toString("base64")}\n`, "utf8");
}
