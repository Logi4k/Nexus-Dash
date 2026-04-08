/**
 * IndexedDB-backed image store for trade screenshots.
 *
 * Images are stored as data-URL strings keyed by a UUID.
 * This keeps binary blobs out of localStorage (which has a ~5 MB cap)
 * while still being fully local / offline.
 *
 * Cloud sync: images are also uploaded to Supabase Storage so they're
 * available on all devices. IndexedDB acts as a fast local cache.
 */

import { supabase, getSession } from "@/lib/supabase";

const STORAGE_BUCKET = "trade-images";

const DB_NAME    = "nexus-images";
const DB_VERSION = 1;
const STORE_NAME = "images";

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE_NAME)) {
        req.result.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror  = () => reject(req.error);
  });
}

/** Store a data-URL under the given id. */
export async function saveImage(id: string, dataUrl: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(dataUrl, id);
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
  });
}

/** Retrieve a single data-URL by id (null if not found). */
export async function getImage(id: string): Promise<string | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(id);
    req.onsuccess = () => resolve((req.result as string) ?? null);
    req.onerror   = () => reject(req.error);
  });
}

/** Batch-retrieve multiple images. Returns a map of id → dataUrl. */
export async function getImages(ids: string[]): Promise<Record<string, string>> {
  if (ids.length === 0) return {};
  const db = await openDB();
  const results: Record<string, string> = {};
  await Promise.all(
    ids.map(
      (id) =>
        new Promise<void>((resolve, reject) => {
          const tx  = db.transaction(STORE_NAME, "readonly");
          const req = tx.objectStore(STORE_NAME).get(id);
          req.onsuccess = () => {
            if (req.result) results[id] = req.result as string;
            resolve();
          };
          req.onerror = () => reject(req.error);
        })
    )
  );
  return results;
}

/** Delete a single image. */
export async function deleteImage(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
  });
}

/** Delete multiple images in a single transaction. */
export async function deleteImages(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    ids.forEach((id) => store.delete(id));
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
  });
}

/** Read a File as a data-URL string. */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

// ── Supabase Storage (cloud sync) ─────────────────────────────────────────────

/** Upload a data-URL image to Supabase Storage. Returns the storage path. */
export async function uploadImageToCloud(id: string, dataUrl: string): Promise<string | null> {
  const session = await getSession();
  if (!session) return null;

  try {
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    const ext = blob.type === "image/png" ? "png" : blob.type === "image/webp" ? "webp" : "jpg";
    const path = `${session.user.id}/${id}.${ext}`;

    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(path, blob, { upsert: true, contentType: blob.type });

    if (error) {
      console.error("[imageStore] Cloud upload failed:", error.message);
      return null;
    }
    return path;
  } catch (err) {
    console.error("[imageStore] Cloud upload error:", err);
    return null;
  }
}

/** Delete an image from Supabase Storage. */
export async function deleteImageFromCloud(id: string): Promise<void> {
  const session = await getSession();
  if (!session) return;

  const userId = session.user.id;
  // Try all common extensions since we don't track the exact one
  await supabase.storage.from(STORAGE_BUCKET).remove([
    `${userId}/${id}.jpg`,
    `${userId}/${id}.png`,
    `${userId}/${id}.webp`,
  ]);
}

/** Delete multiple images from Supabase Storage. */
export async function deleteImagesFromCloud(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const session = await getSession();
  if (!session) return;

  const userId = session.user.id;
  const paths = ids.flatMap((id) => [
    `${userId}/${id}.jpg`,
    `${userId}/${id}.png`,
    `${userId}/${id}.webp`,
  ]);
  await supabase.storage.from(STORAGE_BUCKET).remove(paths);
}

/** Get a signed URL for an image from Supabase Storage.
 *  Tries common extensions. Returns the first working URL or null. */
export async function getImageFromCloud(id: string): Promise<string | null> {
  const session = await getSession();
  if (!session) return null;

  const userId = session.user.id;
  const extensions = ["jpg", "png", "webp"];

  for (const ext of extensions) {
    const path = `${userId}/${id}.${ext}`;
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .download(path);

    if (!error && data) {
      try {
        return await blobToDataUrl(data);
      } catch (err) {
        console.error("[imageStore] Failed to convert downloaded image:", err);
      }
    }
  }
  return null;
}

/** Batch get images: try IndexedDB first, fall back to cloud for missing ones.
 *  Returns a map of id → dataUrl/signedUrl. */
export async function getImagesWithCloudFallback(ids: string[]): Promise<Record<string, string>> {
  if (ids.length === 0) return {};

  // First try IndexedDB (local cache)
  const local = await getImages(ids).catch((err) => {
    console.error("[imageStore] IndexedDB read failed:", err);
    return {} as Record<string, string>;
  });

  // Find which ones are missing locally
  const missing = ids.filter((id) => !local[id]);

  if (missing.length === 0) return local;

  // Fetch missing ones from cloud
  const results = { ...local };
  await Promise.all(
    missing.map(async (id) => {
      const url = await getImageFromCloud(id);
      if (url) {
        results[id] = url;
        saveImage(id, url).catch((err) =>
          console.error("[imageStore] Cache warming failed for", id, err)
        );
      }
    })
  );

  return results;
}
