import fs from 'fs/promises';
import path from 'path';

const CACHE_DIR = path.join(process.cwd(), 'src', 'data', 'cache');
const CACHE_DURATION_MS = 6 * 60 * 60 * 1000; // 6 hours

export interface CachedEntry {
    lastUpdate: string;
    data: any[];
}

async function readCacheFile(id: string): Promise<CachedEntry | null> {
    const cacheFile = path.join(CACHE_DIR, `${id}.json`);
    try {
        const content = await fs.readFile(cacheFile, 'utf-8');
        return JSON.parse(content);
    } catch {
        return null;
    }
}

export async function getCachedIndicator(id: string): Promise<any[] | null> {
    if (id === 'emision') {
        const entry = await readCacheFile(id);
        return entry?.data ?? null;
    }

    const entry = await readCacheFile(id);
    if (!entry) return null;

    const isExpired = Date.now() - new Date(entry.lastUpdate).getTime() >= CACHE_DURATION_MS;
    return isExpired ? null : entry.data;
}

export async function getStaleCache(id: string): Promise<any[] | null> {
    const entry = await readCacheFile(id);
    return entry?.data ?? null;
}

export async function getLastCachedDate(id: string): Promise<string | null> {
    const entry = await readCacheFile(id);
    if (!entry?.data?.length) return null;
    return entry.data[entry.data.length - 1]?.fecha ?? null;
}

export async function appendToCache(id: string, newRows: any[]): Promise<void> {
    const existing = await readCacheFile(id);
    const existingData = existing?.data ?? [];

    const existingFechas = new Set(existingData.map((r: any) => r.fecha));
    const toAdd = newRows.filter(r => !existingFechas.has(r.fecha));

    const merged = [...existingData, ...toAdd];

    const cacheFile = path.join(CACHE_DIR, `${id}.json`);
    const entry: CachedEntry = {
        lastUpdate: new Date().toISOString(),
        data: merged
    };

    await fs.mkdir(CACHE_DIR, { recursive: true });
    await fs.writeFile(cacheFile, JSON.stringify(entry, null, 2));
}

export async function saveIndicatorToCache(id: string, data: any[]): Promise<void> {
    const cacheFile = path.join(CACHE_DIR, `${id}.json`);
    const entry: CachedEntry = {
        lastUpdate: new Date().toISOString(),
        data
    };

    await fs.mkdir(CACHE_DIR, { recursive: true });
    await fs.writeFile(cacheFile, JSON.stringify(entry, null, 2));
}
