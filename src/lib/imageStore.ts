/**
 * IndexedDB-backed image store for trade screenshots.
 *
 * Images are stored as data-URL strings keyed by a UUID.
 * This keeps binary blobs out of localStorage (which has a ~5 MB cap)
 * while still being fully local / offline.
 */

const DB_NAME    = "nexus-images";
const DB_VERSION = 1;
const STORE_NAME = "images";

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
