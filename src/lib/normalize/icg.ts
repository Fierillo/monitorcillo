import type { IcgNormalizedRow, IcgRawRow } from '@/types';
import { isoToMonthLabel } from './dates';
import { toNullableNumber } from './numbers';

export function normalizeIcg(rawData: IcgRawRow[]): IcgNormalizedRow[] {
    if (!Array.isArray(rawData)) return [];
    return rawData
        .filter(row => /^\d{4}-\d{2}-\d{2}$/.test(row.fecha))
        .map(row => ({ fecha: isoToMonthLabel(row.fecha), iso_fecha: row.fecha, icg: toNullableNumber(row.icg ?? null) }))
        .filter(row => row.icg !== null)
        .sort((a, b) => a.iso_fecha.localeCompare(b.iso_fecha));
}
