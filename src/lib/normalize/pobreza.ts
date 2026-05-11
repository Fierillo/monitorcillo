import type { PobrezaNormalizedRow, PobrezaRawRow } from '@/types';
import { MONTHS_ES } from './dates';
import { toNullableNumber } from './numbers';

type MonthlyPovertyRow = {
    pobreza_indec: number | null;
    pobreza_utdt: number | null;
    pobreza_utdt_lower: number | null;
    pobreza_utdt_upper: number | null;
    pobreza_utdt_proyectada: number | null;
    pobreza_utdt_proyectada_lower: number | null;
    pobreza_utdt_proyectada_upper: number | null;
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
    return { pobreza_indec: null, pobreza_utdt: null, pobreza_utdt_lower: null, pobreza_utdt_upper: null, pobreza_utdt_proyectada: null, pobreza_utdt_proyectada_lower: null, pobreza_utdt_proyectada_upper: null, preliminar: false };
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

    for (const row of sortedRows) {
        const pobrezaIndec = toNullableNumber(row.pobreza_indec ?? null);
        if (pobrezaIndec == null) continue;
        const start = addMonths(row.fecha, -6);
        const end = addMonths(row.fecha, -1);
        for (const fecha of monthRange(start, end)) setMonthlyValue(rowsByFecha, fecha, { pobreza_indec: pobrezaIndec, preliminar: false });
    }

    const lastOfficialMonth = Array.from(rowsByFecha.keys()).sort().at(-1) ?? null;

    for (const row of sortedRows) {
        const pobrezaUtdt = toNullableNumber(row.pobreza_utdt ?? null);
        const pobrezaUtdtProyectada = toNullableNumber(row.pobreza_utdt_proyectada ?? null);
        if (pobrezaUtdt != null && row.pobreza_utdt_first_quarter == null && row.pobreza_utdt_second_quarter == null) {
            setMonthlyValue(rowsByFecha, row.fecha, {
                pobreza_utdt: pobrezaUtdt,
                pobreza_utdt_lower: toNullableNumber(row.pobreza_utdt_lower ?? null),
                pobreza_utdt_upper: toNullableNumber(row.pobreza_utdt_upper ?? null),
            });
            continue;
        }
        if (pobrezaUtdtProyectada != null) {
            if (lastOfficialMonth && row.fecha <= lastOfficialMonth) continue;
            setMonthlyValue(rowsByFecha, row.fecha, {
                pobreza_utdt_proyectada: pobrezaUtdtProyectada,
                pobreza_utdt_proyectada_lower: toNullableNumber(row.pobreza_utdt_proyectada_lower ?? null),
                pobreza_utdt_proyectada_upper: toNullableNumber(row.pobreza_utdt_proyectada_upper ?? null),
                preliminar: true,
            });
            continue;
        }
        if (pobrezaUtdt == null) continue;

        const start = addMonths(row.fecha, -3);
        const end = addMonths(row.fecha, 2);
        const firstQuarterValue = toNullableNumber(row.pobreza_utdt_first_quarter ?? null) ?? pobrezaUtdt;
        const secondQuarterValue = toNullableNumber(row.pobreza_utdt_second_quarter ?? null) ?? pobrezaUtdt;
        for (const [index, fecha] of monthRange(start, end).entries()) {
            if (lastOfficialMonth && fecha <= lastOfficialMonth) continue;
            const monthlyPovertyUtdt = index < 3 ? firstQuarterValue : secondQuarterValue;
            setMonthlyValue(rowsByFecha, fecha, {
                pobreza_utdt_proyectada: monthlyPovertyUtdt,
                pobreza_utdt_proyectada_lower: toNullableNumber(row.pobreza_utdt_lower ?? null),
                pobreza_utdt_proyectada_upper: toNullableNumber(row.pobreza_utdt_upper ?? null),
                preliminar: true,
            });
        }
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
            pobreza_utdt: row.pobreza_utdt,
            pobreza_utdt_lower: row.pobreza_utdt_lower,
            pobreza_utdt_upper: row.pobreza_utdt_upper,
            pobreza_utdt_proyectada: row.pobreza_utdt_proyectada,
            pobreza_utdt_proyectada_lower: row.pobreza_utdt_proyectada_lower,
            pobreza_utdt_proyectada_upper: row.pobreza_utdt_proyectada_upper,
            pobreza,
            preliminar: row.pobreza_indec == null && row.pobreza_utdt_proyectada != null,
        });
    }

    return normalizedRows;
}
