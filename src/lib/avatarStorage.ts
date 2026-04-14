import { supabase, getSession } from "@/lib/supabase";

const BUCKET = "avatars";

/**
 * Upload avatar to Supabase Storage. Returns the public URL.
 * Overwrites any existing avatar for this user.
 */
export async function uploadAvatar(base64DataUrl: string): Promise<string | null> {
  const session = await getSession();
  if (!session) return null;

  const userId = session.user.id;

  // Convert base64 data URL to Blob
  const response = await fetch(base64DataUrl);
  const blob = await response.blob();

  // Determine file extension from mime type
  const ext = blob.type === "image/png" ? "png" : blob.type === "image/webp" ? "webp" : "jpg";
  const path = `${userId}/avatar.${ext}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { upsert: true, contentType: blob.type });

  if (error) {
    console.error("[avatarStorage] Upload failed:", error.message);
    return null;
  }

  // Get the public URL
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  // Add cache-busting timestamp
  return `${data.publicUrl}?t=${Date.now()}`;
}

/**
 * Delete avatar from Supabase Storage.
 */
export async function deleteAvatar(): Promise<void> {
  const session = await getSession();
  if (!session) return;

  const userId = session.user.id;

  // Try to delete all common extensions
  await supabase.storage.from(BUCKET).remove([
    `${userId}/avatar.jpg`,
    `${userId}/avatar.png`,
    `${userId}/avatar.webp`,
  ]);
}
