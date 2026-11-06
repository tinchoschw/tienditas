import { useState, useEffect } from 'react';

/**
 * Checks if a given media URL represents a video (file, blob, data URL, or video host)
 */
export function isVideoMedia(url: string | undefined | null): boolean {
  if (!url) return false;
  const clean = String(url).trim().toLowerCase();
  if (clean.startsWith('data:video/')) return true;
  if (clean.startsWith('idb://media_video') || clean.startsWith('idb://video')) return true;
  if (clean.includes('youtube.com/') || clean.includes('youtu.be/')) return true;
  if (clean.includes('vimeo.com/')) return true;

  const urlWithoutQuery = clean.split('?')[0];
  if (
    urlWithoutQuery.endsWith('.mp4') ||
    urlWithoutQuery.endsWith('.webm') ||
    urlWithoutQuery.endsWith('.mov') ||
    urlWithoutQuery.endsWith('.ogg') ||
    urlWithoutQuery.endsWith('.m4v')
  ) {
    return true;
  }

  if (clean.includes('/videos/') || clean.includes('.mp4?') || clean.includes('.webm?')) {
    return true;
  }

  return false;
}

/**
 * Converts YouTube and Vimeo URLs into responsive embed URLs
 */
export function getEmbedVideoUrl(url: string | undefined | null): string | null {
  if (!url) return null;
  const str = String(url).trim();

  // YouTube match (standard watch, embed, or youtu.be shortlink)
  const ytMatch = str.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (ytMatch && ytMatch[1]) {
    return `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=0&rel=0`;
  }

  // Vimeo match
  const vimeoMatch = str.match(/vimeo\.com\/(?:video\/)?([0-9]+)/);
  if (vimeoMatch && vimeoMatch[1]) {
    return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  }

  return null;
}

/**
 * Extracts a thumbnail image URL for YouTube videos
 */
export function getYouTubeThumbnail(url: string | undefined | null): string | null {
  if (!url) return null;
  const str = String(url).trim();
  const ytMatch = str.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (ytMatch && ytMatch[1]) {
    return `https://img.youtube.com/vi/${ytMatch[1]}/hqdefault.jpg`;
  }
  return null;
}

// ==============================================================
// IndexedDB Local Storage for Large Media Blobs (Up to 40 MB)
// ==============================================================
const DB_NAME = 'atelier_media_db';
const DB_VERSION = 1;
const STORE_NAME = 'media_blobs';

let dbPromise: Promise<IDBDatabase> | null = null;

function getIDB(): Promise<IDBDatabase> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('IndexedDB unavailable in non-browser environment'));
  }
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
    });
  }
  return dbPromise;
}

export async function saveMediaBlob(blob: Blob, prefix = 'media_video'): Promise<string> {
  const db = await getIDB();
  const id = `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const item = {
      id,
      blob,
      type: blob.type,
      size: blob.size,
      createdAt: Date.now()
    };
    const req = store.put(item);
    req.onsuccess = () => resolve(`idb://${id}`);
    req.onerror = () => reject(req.error);
  });
}

export async function getMediaBlob(id: string): Promise<Blob | null> {
  const cleanId = id.replace(/^idb:\/\//, '');
  try {
    const db = await getIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(cleanId);
      req.onsuccess = () => {
        const res = req.result;
        resolve(res?.blob || null);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Error reading media blob from IndexedDB:', err);
    return null;
  }
}

// In-memory cache for resolved Object URLs
const objectUrlCache = new Map<string, string>();

/**
 * Resolves an idb:// URI into a live browser blob: URL.
 * If given a standard http/https or data URL, returns it immediately.
 */
export async function resolveMediaUrl(uri: string): Promise<string> {
  if (!uri) return '';
  if (!uri.startsWith('idb://')) {
    return uri;
  }
  if (objectUrlCache.has(uri)) {
    return objectUrlCache.get(uri)!;
  }

  const blob = await getMediaBlob(uri);
  if (blob) {
    const blobUrl = URL.createObjectURL(blob);
    objectUrlCache.set(uri, blobUrl);
    return blobUrl;
  }

  return '';
}

/**
 * React hook that returns a playable/viewable URL for any media string (including idb://)
 */
export function useResolvedMediaUrl(uri: string | undefined | null): string {
  const initial = uri ? (objectUrlCache.get(uri) || (uri.startsWith('idb://') ? '' : uri)) : '';
  const [resolved, setResolved] = useState<string>(initial);

  useEffect(() => {
    if (!uri) {
      setResolved('');
      return;
    }
    if (!uri.startsWith('idb://')) {
      setResolved(uri);
      return;
    }
    if (objectUrlCache.has(uri)) {
      setResolved(objectUrlCache.get(uri)!);
      return;
    }

    let isMounted = true;
    resolveMediaUrl(uri).then((url) => {
      if (isMounted) {
        setResolved(url);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [uri]);

  return resolved;
}

/**
 * React hook to resolve a list of media URLs
 */
export function useResolvedMediaUrls(uris: string[]): string[] {
  const [resolvedList, setResolvedList] = useState<string[]>(() =>
    uris.map((u) => (u.startsWith('idb://') ? objectUrlCache.get(u) || '' : u))
  );

  useEffect(() => {
    let isMounted = true;
    Promise.all(uris.map((u) => resolveMediaUrl(u))).then((results) => {
      if (isMounted) {
        setResolvedList(results);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [uris]);

  return resolvedList;
}
