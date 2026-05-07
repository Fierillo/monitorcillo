import type { EmaeNormalizedRow, EmaeRawRow } from '@/types';
import { fechaToTimestamp, MONTHS_ES } from './dates';
import { notNull, toNullableNumber } from './numbers';

export function normalizeEmae(rawData: EmaeRawRow[]): EmaeNormalizedRow[] {
    if (!Array.isArray(rawData) || rawData.length === 0) return [];

    const baseRow = rawData.find((row) => row.fecha === '2017-01-01');
    if (!baseRow) return [];

    const baseOriginal = toNullableNumber(baseRow.emae);
    const baseDesest = toNullableNumber(baseRow.emae_desestacionalizado);
    const baseTendencia = toNullableNumber(baseRow.emae_tendencia);

    return rawData
        .map((row) => {
            if (!row.fecha || typeof row.fecha !== 'string') return null;
            const dateObj = new Date(`${row.fecha}T00:00:00Z`);
            if (Number.isNaN(dateObj.getTime())) return null;
            const emae = toNullableNumber(row.emae);
            const emaeDesestacionalizado = toNullableNumber(row.emae_desestacionalizado);
            const emaeTendencia = toNullableNumber(row.emae_tendencia);

            return {
                fecha: `${MONTHS_ES[dateObj.getUTCMonth()]} ${String(dateObj.getUTCFullYear()).slice(-2)}`,
                iso_fecha: row.fecha,
                emae: baseOriginal && emae != null ? (emae / baseOriginal) * 100 : null,
                emae_desestacionalizado: baseDesest && emaeDesestacionalizado != null ? (emaeDesestacionalizado / baseDesest) * 100 : null,
                emae_tendencia: baseTendencia && emaeTendencia != null ? (emaeTendencia / baseTendencia) * 100 : null,
            };
        })
        .filter(notNull)
        .sort((a, b) => fechaToTimestamp(a.fecha) - fechaToTimestamp(b.fecha));
}
