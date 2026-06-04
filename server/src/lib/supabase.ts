import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

let supabase: ReturnType<typeof createClient> | null = null;

function isConfigured(): boolean {
  return !!(supabaseUrl && supabaseKey);
}

function getSupabase() {
  if (!supabase) {
    if (!isConfigured()) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
    supabase = createClient(supabaseUrl, supabaseKey, {
      global: {
        fetch: (url: any, opts: any) => fetch(url, { ...opts, signal: AbortSignal.timeout(10000) }),
      },
    });
  }
  return supabase;
}

export type UploadResult = { path: string; error: null } | { path: null; error: string };

export async function uploadPhoto(
  bucket: string,
  entityType: string,
  entityId: string,
  buffer: Buffer,
  mimeType: string,
): Promise<UploadResult> {
  if (!isConfigured()) return { path: null, error: "Supabase not configured" };
  const ext = mimeType === "image/png" ? "png" : "jpg";
  const path = `${entityType}/${entityId}.${ext}`;

  const { error } = await getSupabase().storage
    .from(bucket)
    .upload(path, buffer, {
      contentType: mimeType,
      upsert: true,
    });

  if (error) return { path: null, error: error.message };
  return { path, error: null };
}

export async function deletePhoto(bucket: string, path: string): Promise<void> {
  if (!isConfigured()) return;
  const { error } = await getSupabase().storage
    .from(bucket)
    .remove([path]);

  if (error) console.error("Failed to delete photo from Supabase:", error.message);
}

export async function getSignedUrl(bucket: string, path: string, expiresIn = 86400): Promise<string | null> {
  if (!isConfigured()) return null;
  const { data, error } = await getSupabase().storage
    .from(bucket)
    .createSignedUrl(path, expiresIn);

  if (error || !data) return null;
  return data.signedUrl;
}

const signedUrlCache = new Map<string, { url: string; expires: number }>();
const SIGNED_URL_TTL = 86_400_000; // 24h

export async function getPhotoUrl(bucket: string, path: string): Promise<string | null> {
  if (!isConfigured() || !path) return null;
  const key = `${bucket}/${path}`;
  const cached = signedUrlCache.get(key);
  if (cached && cached.expires > Date.now()) return cached.url;

  try {
    const { data, error } = await getSupabase().storage
      .from(bucket)
      .createSignedUrl(path, 86400);

    if (error || !data) return null;
    const url = data.signedUrl;
    signedUrlCache.set(key, { url, expires: Date.now() + SIGNED_URL_TTL });
    return url;
  } catch {
    return null;
  }
}

export function getPublicUrl(bucket: string, path: string): string | null {
  if (!isConfigured() || !path) return null;
  const { data } = getSupabase().storage
    .from(bucket)
    .getPublicUrl(path);
  return data?.publicUrl || null;
}
