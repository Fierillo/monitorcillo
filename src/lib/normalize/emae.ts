import type { EmaeNormalizedRow, EmaeRawRow } from '@/types';
import {
    EMAE_SECTOR_KEYS,
    EMAE_SECTOR_MM12_KEYS,
    sectorLevelAportes,
    type EmaeSectorKey,
} from '../emae/schema';
import { fechaToTimestamp, MONTHS_ES } from './dates';
import { notNull, toNullableNumber } from './numbers';

const MM12_PERIODS = 12;

function average(values: number[]): number | null {
    return values.length === MM12_PERIODS ? values.reduce((sum, value) => sum + value, 0) / MM12_PERIODS : null;
}

function sectorMm12(rawData: EmaeRawRow[], key: EmaeSectorKey, rowIndex: number): number | null {
    const values = rawData
        .slice(Math.max(0, rowIndex - MM12_PERIODS + 1), rowIndex + 1)
        .map(row => toNullableNumber(row[key] ?? null))
        .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
    return average(values);
}

function rebase(value: number | null, base: number | null): number | null {
    if (value == null || base == null || base === 0) return null;
    return (value / base) * 100;
}

export function normalizeEmae(rawData: EmaeRawRow[]): EmaeNormalizedRow[] {
    if (!Array.isArray(rawData) || rawData.length === 0) return [];

    const baseRow = rawData.find((row) => row.fecha === '2017-01-01');
    if (!baseRow) return [];

    const baseOriginal = toNullableNumber(baseRow.emae);
    const baseDesest = toNullableNumber(baseRow.emae_desestacionalizado);
    const baseTendencia = toNullableNumber(baseRow.emae_tendencia);
    const sortedRawData = [...rawData].sort((a, b) => a.fecha.localeCompare(b.fecha));
    const baseRowIndex = sortedRawData.findIndex(row => row.fecha === '2017-01-01');
    const baseSectorsMm12: Partial<Record<EmaeSectorKey, number | null>> = Object.fromEntries(
        EMAE_SECTOR_KEYS.map(key => [key, sectorMm12(sortedRawData, key, baseRowIndex)]),
    );
    const baseSectorsMonthly: Partial<Record<EmaeSectorKey, number | null>> = Object.fromEntries(
        EMAE_SECTOR_KEYS.map(key => [key, toNullableNumber(baseRow[key] ?? null)]),
    );

    return sortedRawData
        .map((row, rowIndex) => {
            if (!row.fecha || typeof row.fecha !== 'string') return null;
            const dateObj = new Date(`${row.fecha}T00:00:00Z`);
            if (Number.isNaN(dateObj.getTime())) return null;
            const emae = toNullableNumber(row.emae);
            const emaeDesestacionalizado = toNullableNumber(row.emae_desestacionalizado);
            const emaeTendencia = toNullableNumber(row.emae_tendencia);
            const emaeBase100 = rebase(emae, baseOriginal);
            const emaeDesestBase100 = rebase(emaeDesestacionalizado, baseDesest);

            const sectorMonthlyBase100: Partial<Record<EmaeSectorKey, number | null>> = Object.fromEntries(
                EMAE_SECTOR_KEYS.map(key => [
                    key,
                    rebase(toNullableNumber(row[key] ?? null), baseSectorsMonthly[key] ?? null),
                ]),
            );
            const aportes = sectorLevelAportes(sectorMonthlyBase100, emaeDesestBase100);

            const normalizedRow: EmaeNormalizedRow = {
                fecha: `${MONTHS_ES[dateObj.getUTCMonth()]} ${String(dateObj.getUTCFullYear()).slice(-2)}`,
                iso_fecha: row.fecha,
                emae: emaeBase100,
                emae_desestacionalizado: emaeDesestBase100,
                emae_tendencia: rebase(emaeTendencia, baseTendencia),
                ...aportes,
            };

            for (let index = 0; index < EMAE_SECTOR_KEYS.length; index++) {
                const key = EMAE_SECTOR_KEYS[index];
                const value = sectorMm12(sortedRawData, key, rowIndex);
                const baseValue = baseSectorsMm12[key];
                normalizedRow[EMAE_SECTOR_MM12_KEYS[index]] = baseValue && value != null ? (value / baseValue) * 100 : null;
            }

            return normalizedRow;
        })
        .filter(notNull)
        .sort((a, b) => fechaToTimestamp(a.fecha) - fechaToTimestamp(b.fecha));
}
