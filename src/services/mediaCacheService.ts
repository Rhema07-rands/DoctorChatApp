import * as FileSystem from 'expo-file-system';

const CACHE_DIR = `${FileSystem.documentDirectory}media_cache/`;
const MAX_CACHE_BYTES = 200 * 1024 * 1024; // 200 MB

/**
 * Simple hash of a URL to produce a safe filename.
 * Uses a fast numeric hash + the file extension from the URL.
 */
function urlToFilename(url: string): string {
    let hash = 0;
    for (let i = 0; i < url.length; i++) {
        const char = url.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0; // Convert to 32bit integer
    }
    const hashStr = Math.abs(hash).toString(36);

    // Extract extension from URL (strip query params)
    const cleanUrl = url.split('?')[0];
    const parts = cleanUrl.split('.');
    const ext = parts.length > 1 ? parts[parts.length - 1].toLowerCase() : 'bin';
    // Keep only safe extensions
    const safeExt = /^[a-z0-9]{1,5}$/.test(ext) ? ext : 'bin';

    return `${hashStr}.${safeExt}`;
}

async function ensureCacheDir(): Promise<void> {
    const dirInfo = await FileSystem.getInfoAsync(CACHE_DIR);
    if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
    }
}

/**
 * Returns the local cached file URI for a remote URL, or null if not cached.
 */
async function getCachedUri(remoteUrl: string): Promise<string | null> {
    if (!remoteUrl) return null;
    try {
        const filename = urlToFilename(remoteUrl);
        const localUri = CACHE_DIR + filename;
        const info = await FileSystem.getInfoAsync(localUri);
        if (info.exists && info.size && info.size > 0) {
            return localUri;
        }
        return null;
    } catch {
        return null;
    }
}

/**
 * Downloads a remote file into local cache. Returns the local URI.
 * If download fails, returns null (caller should fall back to remote URL).
 */
async function cacheMedia(remoteUrl: string): Promise<string | null> {
    if (!remoteUrl) return null;
    if (remoteUrl.startsWith('file://')) return remoteUrl;
    try {
        await ensureCacheDir();
        const filename = urlToFilename(remoteUrl);
        const localUri = CACHE_DIR + filename;

        // Don't re-download if already cached
        const existing = await FileSystem.getInfoAsync(localUri);
        if (existing.exists && existing.size && existing.size > 0) {
            return localUri;
        }

        const downloadResult = await FileSystem.downloadAsync(remoteUrl, localUri);
        if (downloadResult.status === 200) {
            // Fire-and-forget eviction check
            evictOldFiles().catch(() => {});
            return localUri;
        } else {
            // Clean up failed download
            await FileSystem.deleteAsync(localUri, { idempotent: true });
            return null;
        }
    } catch (e) {
        // Silently fail caching for timeouts or unreachable old network links
        // console.log(`MediaCache: Skipped caching for ${remoteUrl}`);
        return null;
    }
}

/**
 * Returns local URI if cached, otherwise downloads and caches.
 * Always returns a usable URI (local or remote fallback).
 */
async function getOrDownload(remoteUrl: string): Promise<string> {
    if (!remoteUrl) return '';
    if (remoteUrl.startsWith('file://')) return remoteUrl;

    const cached = await getCachedUri(remoteUrl);
    if (cached) return cached;

    const downloaded = await cacheMedia(remoteUrl);
    return downloaded || remoteUrl; // Fallback to remote if download fails
}

/**
 * Evicts oldest cached files when total cache exceeds MAX_CACHE_BYTES.
 */
async function evictOldFiles(): Promise<void> {
    try {
        await ensureCacheDir();
        const files = await FileSystem.readDirectoryAsync(CACHE_DIR);
        if (files.length === 0) return;

        // Get info for all files
        const fileInfos: { name: string; size: number; modTime: number }[] = [];
        for (const name of files) {
            const info = await FileSystem.getInfoAsync(CACHE_DIR + name);
            if (info.exists && info.size) {
                fileInfos.push({
                    name,
                    size: info.size,
                    modTime: (info as any).modificationTime || 0,
                });
            }
        }

        const totalSize = fileInfos.reduce((sum, f) => sum + f.size, 0);
        if (totalSize <= MAX_CACHE_BYTES) return;

        // Sort oldest first
        fileInfos.sort((a, b) => a.modTime - b.modTime);

        let freed = 0;
        const target = totalSize - MAX_CACHE_BYTES;
        for (const file of fileInfos) {
            if (freed >= target) break;
            await FileSystem.deleteAsync(CACHE_DIR + file.name, { idempotent: true });
            freed += file.size;
        }
        console.log(`MediaCache: Evicted ${(freed / 1024 / 1024).toFixed(1)} MB`);
    } catch (e) {
        console.warn('MediaCache: Eviction error', e);
    }
}

/**
 * Returns total cache size in bytes.
 */
async function getCacheSize(): Promise<number> {
    try {
        await ensureCacheDir();
        const files = await FileSystem.readDirectoryAsync(CACHE_DIR);
        let total = 0;
        for (const name of files) {
            const info = await FileSystem.getInfoAsync(CACHE_DIR + name);
            if (info.exists && info.size) {
                total += info.size;
            }
        }
        return total;
    } catch {
        return 0;
    }
}

/**
 * Deletes the entire media cache folder.
 */
async function clearCache(): Promise<void> {
    try {
        await FileSystem.deleteAsync(CACHE_DIR, { idempotent: true });
        await ensureCacheDir();
    } catch (e) {
        console.warn('MediaCache: Clear error', e);
    }
}

export const mediaCacheService = {
    getCachedUri,
    cacheMedia,
    getOrDownload,
    evictOldFiles,
    getCacheSize,
    clearCache,
};
