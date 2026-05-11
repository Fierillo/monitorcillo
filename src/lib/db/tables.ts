import type { DbValue, IndicatorType } from '@/types';

const TABLES: Record<IndicatorType, { raw: string; normalized: string }> = {
    emision: { raw: 'emision_raw', normalized: 'emision_normalized' },
    emae: { raw: 'emae_raw', normalized: 'emae_normalized' },
    bma: { raw: 'bma_raw', normalized: 'bma_normalized' },
    reca: { raw: 'recaudacion_raw', normalized: 'recaudacion_normalized' },
    poder: { raw: 'poder_adquisitivo_raw', normalized: 'poder_adquisitivo_normalized' },
    deuda: { raw: 'deuda_raw', normalized: 'deuda_normalized' },
    pobreza: { raw: 'pobreza_raw', normalized: 'pobreza_normalized' },
    inflacion: { raw: 'inflacion_raw', normalized: 'inflacion_normalized' },
};

export function getTableName(type: IndicatorType, normalized: boolean): string {
    return normalized ? TABLES[type].normalized : TABLES[type].raw;
}

export function formatDbDate(value: DbValue): string {
    if (value instanceof Date) return value.toISOString().split('T')[0];
    return String(value ?? '');
}

export function toNumber(value: DbValue): number {
    return Number(value ?? 0);
}

export function toNullableNumber(value: DbValue): number | null {
    if (value === null || value === undefined) return null;
    return Number(value);
}

export function toDbRow(row: object): Record<string, DbValue> {
    return row as Record<string, DbValue>;
}

export function isSafeColumn(column: string): boolean {
    return /^[a-z_]+$/.test(column);
}

export function isMissingTableError(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === '42P01';
}

export function isMissingColumnError(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === '42703';
}
