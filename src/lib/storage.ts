import { cache } from 'react';
import { getNormalizedData } from './db';
import type { ChartDataRow, IndicatorType } from '@/types';

const MAPPING: Record<string, IndicatorType> = {
    emision: 'emision',
    emae: 'emae',
    bma: 'bma',
    'depositos-prestamos': 'depositos-prestamos',
    reca: 'reca',
    recaudacion: 'reca',
    deuda: 'deuda',
    pobreza: 'pobreza',
    poder: 'poder',
    'poder-adquisitivo': 'poder',
    inflacion: 'inflacion',
    icg: 'icg',
    sipa: 'sipa',
    balanza: 'balanza',
    'balanza-comercial': 'balanza',
};

export const getIndicatorData = cache(async (id: string): Promise<ChartDataRow[]> => {
    const type = MAPPING[id];
    if (!type) return [];

    return ((await getNormalizedData(type)) ?? []) as ChartDataRow[];
});
