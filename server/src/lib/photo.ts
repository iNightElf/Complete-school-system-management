import { createHmac, randomBytes } from "crypto";

const MAX_PHOTO_BYTES = 512 * 1024;

const MAGIC_BYTES: Record<string, Uint8Array> = {
  'image/jpeg': new Uint8Array([0xFF, 0xD8, 0xFF]),
  'image/png': new Uint8Array([0x89, 0x50, 0x4E, 0x47]),
};

export function detectMimeType(buffer: Buffer): string | null {
  for (const [mime, magic] of Object.entries(MAGIC_BYTES)) {
    if (buffer.length >= magic.length && magic.every((b, i) => buffer[i] === b)) {
      return mime;
    }
  }
  return null;
}

export function parsePhoto(body: any): { buffer: Buffer; mimeType: string } | null {
  if (!body.photo) return null;
  if (typeof body.photo !== "string" || !body.photo.startsWith("data:image")) return null;

  const match = body.photo.match(/^data:image\/(\w+);base64,(.+)$/);
  if (!match) return null;

  const ext = match[1].toLowerCase();
  if (ext !== 'jpeg' && ext !== 'jpg' && ext !== 'png') return null;

  try {
    const buffer = Buffer.from(match[2], "base64");
    if (buffer.length === 0 || buffer.length > MAX_PHOTO_BYTES) return null;

    const mimeType = detectMimeType(buffer);
    if (!mimeType) return null;

    return { buffer, mimeType };
  } catch {
    return null;
  }
}

// ── Signed photo tokens (for <img> tags that can't send Bearer headers) ──

const PHOTO_SECRET = process.env.PHOTO_TOKEN_SECRET || randomBytes(32).toString("hex");
const TOKEN_TTL = 86_400_000; // 24 hours

function makeToken(entityType: string, id: string, expiresAt: number): string {
  const payload = `${entityType}:${id}:${expiresAt}`;
  const sig = createHmac("sha256", PHOTO_SECRET).update(payload).digest("hex");
  return Buffer.from(`${payload}:${sig}`).toString("base64url");
}

export function verifyPhotoToken(token: string): { entityType: string; id: string } | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString();
    const parts = decoded.split(":");
    if (parts.length < 4) return null;
    const entityType = parts[0];
    const id = parts[1];
    const expiresAt = parseInt(parts[2], 10);
    const sig = parts.slice(3).join(":");
    if (isNaN(expiresAt) || Date.now() > expiresAt) return null;
    const expected = createHmac("sha256", PHOTO_SECRET).update(`${entityType}:${id}:${expiresAt}`).digest("hex");
    if (sig !== expected) return null;
    return { entityType, id };
  } catch {
    return null;
  }
}

export function getSignedPhotoUrl(entityType: string, id: string): string {
  const expiresAt = Date.now() + TOKEN_TTL;
  const token = makeToken(entityType, id, expiresAt);
  return `/api/photo/${entityType}/${id}/${token}`;
}
