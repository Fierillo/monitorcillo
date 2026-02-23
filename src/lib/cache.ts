import fs from 'fs/promises';
import path from 'path';

const CACHE_DIR = path.join(process.cwd(), 'src', 'data', 'cache');
const CACHE_DURATION_MS = 6 * 60 * 60 * 1000; // 6 hours

export interface CachedEntry {
    lastUpdate: string;
    data: any[];
}

export async function getCachedIndicator(id: string): Promise<any[] | null> {
    const cacheFile = path.join(CACHE_DIR, `${id}.json`);
    try {
        const content = await fs.readFile(cacheFile, 'utf-8');
        const entry: CachedEntry = JSON.parse(content);

        const lastUpdate = new Date(entry.lastUpdate).getTime();
        const now = Date.now();

        if (now - lastUpdate < CACHE_DURATION_MS) {
            return entry.data;
        }
        return null; // Cache expired
    } catch {
        return null; // Cache missing
    }
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
