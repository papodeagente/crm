import crypto from "crypto";

const ALGO = "aes-256-gcm";
const KEY_LENGTH = 32;
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function deriveKey(): Buffer {
  const secret = process.env.ASAAS_ENCRYPTION_KEY || process.env.JWT_SECRET || "saas-secret";
  return crypto.createHash("sha256").update(secret).digest().subarray(0, KEY_LENGTH);
}

export function encryptSecret(plaintext: string): string {
  const key = deriveKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]).toString("base64");
}

export function decryptSecret(encoded: string): string {
  const buf = Buffer.from(encoded, "base64");
  const iv = buf.subarray(0, IV_LENGTH);
  const authTag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = buf.subarray(IV_LENGTH + TAG_LENGTH);
  const key = deriveKey();
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

export function maskApiKey(apiKey: string): string {
  if (!apiKey || apiKey.length < 12) return "••••";
  return `${apiKey.slice(0, 8)}…${apiKey.slice(-4)}`;
}
