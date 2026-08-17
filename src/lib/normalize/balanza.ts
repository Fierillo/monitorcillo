import type { BalanzaNormalizedRow, BalanzaRawRow } from '@/types';
import { BALANZA_IMPORT_KEYS, BALANZA_SERIES_KEYS, toNegativeImport } from '../balanza/schema';
import { isoToMonthLabel } from './dates';
import { toNullableNumber } from './numbers';

export function normalizeBalanza(rawData: BalanzaRawRow[]): BalanzaNormalizedRow[] {
    if (!Array.isArray(rawData)) return [];

    return rawData
        .filter(row => /^\d{4}-\d{2}-\d{2}$/.test(row.fecha))
        .map(row => {
            const values = Object.fromEntries(
                BALANZA_SERIES_KEYS.map(key => [key, toNullableNumber(row[key] ?? null)]),
            ) as Record<typeof BALANZA_SERIES_KEYS[number], number | null>;
            const saldo = values.saldo ?? (
                values.exportaciones != null && values.importaciones != null
                    ? values.exportaciones - values.importaciones
                    : null
            );

            for (const key of BALANZA_IMPORT_KEYS) values[key] = toNegativeImport(values[key]);

            return {
                fecha: isoToMonthLabel(row.fecha),
                iso_fecha: row.fecha,
                ...values,
                saldo,
                pbi: toNullableNumber(row.pbi_trimestral ?? null),
                tc: toNullableNumber(row.tc ?? null),
                ipc_nucleo: toNullableNumber(row.ipc_nucleo ?? null),
                pbi_usd: toNullableNumber(row.pbi_usd ?? null),
            };
        })
        .filter(row => row.exportaciones != null || row.importaciones != null || row.saldo != null)
        .sort((a, b) => a.iso_fecha.localeCompare(b.iso_fecha));
}
