import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const key = process.env.CREDENTIALS_ENCRYPTION_KEY;
  if (!key) {
    throw new Error("CREDENTIALS_ENCRYPTION_KEY not set");
  }
  return createHash("sha256").update(key).digest();
}

export function encryptCredentials(credentials: Record<string, string>): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const plaintext = JSON.stringify(credentials);
  let encrypted = cipher.update(plaintext, "utf8", "base64");
  encrypted += cipher.final("base64");

  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:encrypted (all base64)
  return [
    iv.toString("base64"),
    authTag.toString("base64"),
    encrypted,
  ].join(":");
}

export function decryptCredentials(encryptedData: string): Record<string, string> {
  const key = getEncryptionKey();
  const [ivB64, authTagB64, encrypted] = encryptedData.split(":");

  if (!ivB64 || !authTagB64 || !encrypted) {
    throw new Error("Invalid encrypted data format");
  }

  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(authTagB64, "base64");

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, "base64", "utf8");
  decrypted += decipher.final("utf8");

  return JSON.parse(decrypted);
}
