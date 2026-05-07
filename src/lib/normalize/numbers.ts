import type { NumericValue } from '@/types';

export function toNumber(value: NumericValue, fallback = 0): number {
    const numericValue = Number(value ?? fallback);
    return Number.isNaN(numericValue) ? fallback : numericValue;
}

export function toNullableNumber(value: NumericValue): number | null {
    if (value === null || value === undefined || value === '') return null;
    const numericValue = Number(value);
    return Number.isNaN(numericValue) ? null : numericValue;
}

export function notNull<T>(value: T | null): value is T {
    return value !== null;
}

export function baseIpcValue(rows: Array<{ fecha: string; ipc_nucleo?: NumericValue }>): number | null {
    const baseRow = rows.find(row => row.fecha === '2017-01-01');
    return baseRow ? toNullableNumber(baseRow.ipc_nucleo ?? null) : null;
}

export function toBasePrices(value: number | null, currentIpc: number | null, baseIpc: number | null): number | null {
    if (value == null || !currentIpc || !baseIpc) return null;
    return value * (baseIpc / currentIpc);
}
