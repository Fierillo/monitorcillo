import type { PobrezaNormalizedRow, PobrezaRawRow } from '@/types';
import { MONTHS_ES } from './dates';
import { toNullableNumber } from './numbers';

type MonthlyPovertyRow = {
    pobreza_indec: number | null;
    pobreza_utdt_proyectada: number | null;
    preliminar: boolean;
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
    return { pobreza_indec: null, pobreza_utdt_proyectada: null, preliminar: false };
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
            setMonthlyValue(rowsByFecha, fecha, { pobreza_indec: pobrezaIndec, preliminar: false });
        }
    }

    // Add UTDT nowcast only for months without INDEC data
    for (const row of sortedRows) {
        const pobrezaUtdtProyectada = toNullableNumber(row.pobreza_utdt_proyectada ?? null);
        if (pobrezaUtdtProyectada == null) continue;

        // Skip if this month already has INDEC data
        if (rowsByFecha.get(row.fecha)?.pobreza_indec != null) continue;

        setMonthlyValue(rowsByFecha, row.fecha, {
            pobreza_utdt_proyectada: pobrezaUtdtProyectada,
            preliminar: true,
        });
    }

    const normalizedRows: PobrezaNormalizedRow[] = [];
    for (const [fecha, row] of Array.from(rowsByFecha.entries()).sort(([a], [b]) => a.localeCompare(b))) {
        const date = new Date(`${fecha}T00:00:00Z`);
        const pobreza = row.pobreza_indec ?? row.pobreza_utdt_proyectada;
        if (pobreza == null || Number.isNaN(date.getTime())) continue;

        normalizedRows.push({
            fecha: `${MONTHS_ES[date.getUTCMonth()]} ${String(date.getUTCFullYear()).slice(-2)}`,
            iso_fecha: fecha,
            pobreza_indec: row.pobreza_indec,
            pobreza_utdt_proyectada: row.pobreza_utdt_proyectada,
            pobreza,
            preliminar: row.pobreza_indec == null && row.pobreza_utdt_proyectada != null,
        });
    }

    return normalizedRows;
}
