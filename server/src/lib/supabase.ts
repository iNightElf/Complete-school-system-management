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
    supabase = createClient(supabaseUrl, supabaseKey);
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
