import { getNormalizedData, saveNormalizedData } from './db';
import type { ChartDataRow, IndicatorType, NormalizedDataRow } from '@/types';

const MAPPING: Record<string, IndicatorType> = {
    emision: 'emision',
    emae: 'emae',
    bma: 'bma',
    reca: 'reca',
    recaudacion: 'reca',
    deuda: 'deuda',
    pobreza: 'pobreza',
    poder: 'poder',
    'poder-adquisitivo': 'poder',
    inflacion: 'inflacion',
};

export async function getCachedIndicator(id: string): Promise<NormalizedDataRow[] | null> {
    const type = MAPPING[id];
    if (!type) return null;

    return getNormalizedData(type);
}

export async function safeGetIndicatorData(id: string): Promise<ChartDataRow[]> {
    try {
        return ((await getCachedIndicator(id)) ?? []) as ChartDataRow[];
    } catch (error) {
        console.error(`[indicator][${id}] failed to load from Neon`, error);
        return [];
    }
}

export async function getStaleCache(id: string): Promise<NormalizedDataRow[] | null> {
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

export async function appendToCache(id: string, newRows: NormalizedDataRow[]): Promise<void> {
    const type = MAPPING[id];
    if (!type) return;

    const existingData = (await getNormalizedData(type)) ?? [];
    const existingFechas = new Set(existingData.map((row) => row.fecha));
    const toAdd = newRows.filter((row) => !existingFechas.has(row.fecha));
    const merged = [...existingData, ...toAdd];
    await saveNormalizedData(type, merged);
}

export async function saveIndicatorToCache(id: string, data: NormalizedDataRow[]): Promise<void> {
    const type = MAPPING[id];
    if (!type) return;
    await saveNormalizedData(type, data);
}
