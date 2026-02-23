import fs from 'fs/promises';
import path from 'path';

const CACHE_PATH = path.join(process.cwd(), 'src', 'data', 'bcra_cache.json');
const CACHE_DURATION_MS = 6 * 60 * 60 * 1000; // 6 hours

export interface CachedData {
    lastUpdate: string;
    indicators: Record<string, any[]>;
}

export async function getCachedIndicator(id: string): Promise<any[] | null> {
    try {
        const content = await fs.readFile(CACHE_PATH, 'utf-8');
        const cache: CachedData = JSON.parse(content);

        const lastUpdate = new Date(cache.lastUpdate).getTime();
        const now = Date.now();

        if (now - lastUpdate < CACHE_DURATION_MS) {
            return cache.indicators[id] || null;
        }
        return null;
    } catch {
        return null;
    }
}

export async function saveIndicatorToCache(id: string, data: any[]): Promise<void> {
    let cache: CachedData = { lastUpdate: new Date().toISOString(), indicators: {} };

    try {
        const content = await fs.readFile(CACHE_PATH, 'utf-8');
        cache = JSON.parse(content);
    } catch {
        // Use default empty cache
    }

    cache.indicators[id] = data;
    cache.lastUpdate = new Date().toISOString();

    await fs.mkdir(path.dirname(CACHE_PATH), { recursive: true });
    await fs.writeFile(CACHE_PATH, JSON.stringify(cache, null, 2));
}
