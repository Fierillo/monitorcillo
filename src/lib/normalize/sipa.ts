import type { SipaNormalizedRow, SipaRawRow } from '@/types';
import { SIPA_VALUE_KEYS } from '../sipa-schema';
import { isoToMonthLabel } from './dates';
import { toNullableNumber } from './numbers';

export function normalizeSipa(rawData: SipaRawRow[]): SipaNormalizedRow[] {
    if (!Array.isArray(rawData)) return [];

    return rawData
        .filter(row => /^\d{4}-\d{2}-\d{2}$/.test(row.fecha))
        .map(row => {
            const values = Object.fromEntries(
                SIPA_VALUE_KEYS.map(key => [key, toNullableNumber(row[key] ?? null)]),
            ) as Record<(typeof SIPA_VALUE_KEYS)[number], number | null>;

            return {
                fecha: isoToMonthLabel(row.fecha),
                iso_fecha: row.fecha,
                provisional: Boolean(row.provisional),
                ...values,
            };
        })
        .filter(row => row.total !== null)
        .sort((a, b) => a.iso_fecha.localeCompare(b.iso_fecha));
}
