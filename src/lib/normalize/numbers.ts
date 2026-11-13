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

/** Number format a source writes in, declared per source and never guessed ('1,5' is 1.5 in es-AR): its text → JS number text. */
const NUMBER_FORMATS = {
    'es-AR': (text: string) => text.replace(/\./g, '').replace(',', '.'),
    en: (text: string) => text.replace(/,/g, ''),
};
export type NumberFormat = keyof typeof NUMBER_FORMATS;

/** Number from a source cell written in the given format ('1.234,5' in es-AR, '1,234.5' in en; '(5)' is -5); null when blank or not a number. */
export function parseNumber(value: unknown, format: NumberFormat): number | null {
    const text = String(value ?? '').trim();
    const negative = /^\(.+\)$/.test(text);
    const parsed = toNullableNumber(NUMBER_FORMATS[format](negative ? text.slice(1, -1).trim() : text));
    return negative && parsed != null ? -parsed : parsed;
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
