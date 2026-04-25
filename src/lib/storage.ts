import { getNormalizedData, saveNormalizedData } from './db';

const MAPPING: Record<string, 'emision' | 'emae' | 'bma' | 'reca' | 'poder'> = {
    emision: 'emision',
    emae: 'emae',
    bma: 'bma',
    reca: 'reca',
    recaudacion: 'reca',
    poder: 'poder',
    'poder-adquisitivo': 'poder',
};

export async function getCachedIndicator(id: string): Promise<any[] | null> {
    const type = MAPPING[id];
    if (!type) return null;

    return getNormalizedData(type);
}

export async function getStaleCache(id: string): Promise<any[] | null> {
    const type = MAPPING[id];
    if (!type) return null;
    return getNormalizedData(type);
}

export async function getLastCachedDate(id: string): Promise<string | null> {
    const type = MAPPING[id];
    if (!type) return null;
    const data = await getNormalizedData(type);
    if (!data || data.length === 0) return null;
    return data[data.length - 1]?.fecha ?? null;
}

export async function appendToCache(id: string, newRows: any[]): Promise<void> {
    const type = MAPPING[id];
    if (!type) return;

    const existingData = (await getNormalizedData(type)) ?? [];
    const existingFechas = new Set(existingData.map((r: any) => r.fecha));
    const toAdd = newRows.filter((r: any) => !existingFechas.has(r.fecha));
    const merged = [...existingData, ...toAdd];
    await saveNormalizedData(type, merged);
}

export async function saveIndicatorToCache(id: string, data: any[]): Promise<void> {
    const type = MAPPING[id];
    if (!type) return;
    await saveNormalizedData(type, data);
}
