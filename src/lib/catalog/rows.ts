import type { CatalogIndicatorRow, CatalogIndicatorSpec, DataRow } from '@/types';
import { isoToFecha, isoToMonthLabel } from '../normalize';

export function toFiniteNumber(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null;
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : null;
}

export function rowDate(row: DataRow): string | null {
    const value = row.iso_fecha ?? row.fecha;
    if (value instanceof Date) return value.toISOString().split('T')[0];
    if (typeof value !== 'string') return null;
    return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function hasAnyValue(row: DataRow, fields: string[]): boolean {
    return fields.some(field => toFiniteNumber(row[field]) !== null);
}

export function latestRow(rows: DataRow[], predicate: (row: DataRow) => boolean): DataRow | null {
    let latest: DataRow | null = null;
    let latestDate = '';

    for (const row of rows) {
        const date = rowDate(row);
        if (!date || !predicate(row) || date < latestDate) continue;
        latest = row;
        latestDate = date;
    }

    return latest;
}

export function latestRawDate(rows: DataRow[], spec: CatalogIndicatorSpec): string | null {
    const row = latestRow(rows, candidate => !!rowDate(candidate) && hasAnyValue(candidate, spec.rawDateFields));
    return row ? rowDate(row) : null;
}

export function formatCatalogDate(date: string, precision: CatalogIndicatorSpec['datePrecision']): string {
    return precision === 'month' ? isoToMonthLabel(date) : isoToFecha(date);
}

export function formatCatalogDisplayDate(date: string, spec: CatalogIndicatorSpec, publicationDate?: string | null): string {
    return publicationDate ? isoToFecha(publicationDate) : formatCatalogDate(date, spec.datePrecision);
}

export function formatReferenceValue(spec: CatalogIndicatorSpec, referenceRow: DataRow | null): string {
    if (!referenceRow) return '-';
    const value = toFiniteNumber(spec.selectReferenceValue(referenceRow));
    return value === null ? '-' : (spec.formatReferenceValue ?? spec.formatValue)(value);
}

export function referenceNumericValue(spec: CatalogIndicatorSpec, referenceRow: DataRow | null): number | null {
    return referenceRow ? toFiniteNumber(spec.selectReferenceValue(referenceRow)) : null;
}

export function comparisonTrend(spec: CatalogIndicatorSpec, value: number, referenceValue: number | null): CatalogIndicatorRow['trend'] {
    if (referenceValue === null || value === referenceValue) return 'neutral';
    const isBetter = spec.betterWhen === 'higher' ? value > referenceValue : value < referenceValue;
    return isBetter ? 'up' : 'down';
}

export function referenceRowForSpec(spec: CatalogIndicatorSpec, valueRow: DataRow, normalizedRows: DataRow[], rawRows: DataRow[]): DataRow | null {
    const valueDate = rowDate(valueRow);
    if (!valueDate) return null;
    const referenceDate = spec.getReferenceDate(valueDate);
    const sourceRows = spec.referenceSource === 'raw' ? rawRows : normalizedRows;
    return sourceRows.find(row => rowDate(row) === referenceDate) ?? null;
}
