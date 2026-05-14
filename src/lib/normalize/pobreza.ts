import type { PobrezaNormalizedRow, PobrezaRawRow } from '@/types';
import { MONTHS_ES } from './dates';
import { toNullableNumber } from './numbers';

type MonthlyPovertyRow = {
    pobreza_indec: number | null;
    pobreza_utdt: number | null;
};

function addMonths(fecha: string, offset: number): string {
    const [year, month] = fecha.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1 + offset, 1)).toISOString().split('T')[0];
}

function monthRange(start: string, end: string): string[] {
    const months: string[] = [];
    for (let current = start; current <= end; current = addMonths(current, 1)) months.push(current);
    return months;
}

function emptyMonthlyRow(): MonthlyPovertyRow {
    return { pobreza_indec: null, pobreza_utdt: null };
}

function setMonthlyValue(rowsByFecha: Map<string, MonthlyPovertyRow>, fecha: string, values: Partial<MonthlyPovertyRow>) {
    rowsByFecha.set(fecha, { ...emptyMonthlyRow(), ...rowsByFecha.get(fecha), ...values });
}

export function normalizePobreza(rawData: PobrezaRawRow[]): PobrezaNormalizedRow[] {
    if (!Array.isArray(rawData) || rawData.length === 0) return [];

    const rowsByFecha = new Map<string, MonthlyPovertyRow>();
    const sortedRows = [...rawData]
        .sort((a, b) => a.fecha.localeCompare(b.fecha))
        .filter(row => /^\d{4}-\d{2}-\d{2}$/.test(row.fecha));

    // Expand INDEC semestral data to 6 months
    // INDEC dates represent the end of semester (e.g., 2026-01-01 = semestre jul-dic 2025)
    // We subtract 1 month to get the actual last month of the semester (e.g., 2025-12-01)
    for (const row of sortedRows) {
        const pobrezaIndec = toNullableNumber(row.pobreza_indec ?? null);
        if (pobrezaIndec == null) continue;
        const semesterEnd = addMonths(row.fecha, -1);
        const start = addMonths(semesterEnd, -5);
        const end = semesterEnd;
        for (const fecha of monthRange(start, end)) {
            setMonthlyValue(rowsByFecha, fecha, { pobreza_indec: pobrezaIndec });
        }
    }

    // Add UTDT nowcast as its own series, including overlap with INDEC.
    for (const row of sortedRows) {
        const pobrezaUtdt = toNullableNumber(row.pobreza_utdt ?? null);
        if (pobrezaUtdt == null) continue;

        setMonthlyValue(rowsByFecha, row.fecha, {
            pobreza_utdt: pobrezaUtdt,
        });
    }

    const normalizedRows: PobrezaNormalizedRow[] = [];
    for (const [fecha, row] of Array.from(rowsByFecha.entries()).sort(([a], [b]) => a.localeCompare(b))) {
        const date = new Date(`${fecha}T00:00:00Z`);
        if (row.pobreza_indec == null && row.pobreza_utdt == null) continue;
        if (Number.isNaN(date.getTime())) continue;

        normalizedRows.push({
            fecha: `${MONTHS_ES[date.getUTCMonth()]} ${String(date.getUTCFullYear()).slice(-2)}`,
            iso_fecha: fecha,
            pobreza_indec: row.pobreza_indec,
            pobreza_utdt: row.pobreza_utdt,
        });
    }

    return normalizedRows;
}
