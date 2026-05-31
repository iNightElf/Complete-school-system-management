const MAX_PHOTO_BYTES = 512 * 1024;

const MAGIC_BYTES: Record<string, Uint8Array> = {
  'image/jpeg': new Uint8Array([0xFF, 0xD8, 0xFF]),
  'image/png': new Uint8Array([0x89, 0x50, 0x4E, 0x47]),
};

export function detectMimeType(buffer: Buffer): string {
  for (const [mime, magic] of Object.entries(MAGIC_BYTES)) {
    if (buffer.length >= magic.length && magic.every((b, i) => buffer[i] === b)) {
      return mime;
    }
  }
  return 'image/jpeg';
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
    if (mimeType !== 'image/jpeg' && mimeType !== 'image/png') return null;

    return { buffer, mimeType };
  } catch {
    return null;
  }
}
