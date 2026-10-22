import type { CatalogIndicatorRow, CatalogIndicatorSpec, DataRow } from '@/types';
import { argentinaToday, isoToFecha, isoToMonthLabel } from '../normalize';

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

/** Latest row with a finite value in the non-daily date fields (see dateCandidateFields), and those fields. */
function latestRawRow(rows: DataRow[], fields: string[]): { row: DataRow | null; candidates: string[] } {
    const candidates = dateCandidateFields(rows, fields);
    return { row: latestRow(rows, candidate => !!rowDate(candidate) && hasAnyValue(candidate, candidates)), candidates };
}

export function latestRawDate(rows: DataRow[], fields: string[]): string | null {
    const { row } = latestRawRow(rows, fields);
    return row ? rowDate(row) : null;
}

/** Data types (spec labels) of the series that set the latest raw date, e.g. «Índice de salarios y RIPTE» (see sourceLabel). */
function latestRawDateLabel(rows: DataRow[], labels: Record<string, string>): string | undefined {
    const { row, candidates } = latestRawRow(rows, Object.keys(labels));
    if (!row) return undefined;
    return sourceLabel(joinLabels(candidates.filter(field => toFiniteNumber(row[field]) !== null).map(field => labels[field])), labels) ?? undefined;
}

/** A date label only tells which source it is on multi-source indicators; on a single-source one (EMAE → «EMAE») it repeats the indicator, so it is omitted. */
function sourceLabel(label: string, labels: Record<string, string>): string | null {
    return new Set(Object.values(labels)).size > 1 ? label : null;
}

/** Label of the Última fecha: the source of the shown value for value-dated indicators, else the series that set the latest raw date. */
export function latestDateLabel(spec: CatalogIndicatorSpec, valueRow: DataRow, rawRows: DataRow[]): string | undefined {
    const sources = spec.valueSourceFields;
    if (!sources) return latestRawDateLabel(rawRows, spec.rawDateFields);
    const field = Object.keys(sources).find(key => toFiniteNumber(valueRow[key]) !== null);
    return field ? sourceLabel(sources[field], sources) ?? undefined : undefined;
}

/** Joins data-type labels without repeats: «Depósitos y Préstamos». */
function joinLabels(labels: string[]): string {
    return new Intl.ListFormat('es', { type: 'conjunction' }).format([...new Set(labels)]);
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

const MAX_DAILY_GAP_MS = 3 * 86_400_000; // next business day after a Friday

/** A series is daily when the median gap between its data points is at most three days. */
function isDailyField(rows: DataRow[], field: string): boolean {
    const dates = rows.filter(row => toFiniteNumber(row[field]) !== null).map(rowDate).filter((date): date is string => !!date).sort();
    const gaps = dates.slice(1).map((date, index) => Date.parse(date) - Date.parse(dates[index])).sort((a, b) => a - b);
    return gaps[Math.floor(gaps.length / 2)] <= MAX_DAILY_GAP_MS;
}

/** An indicator is daily only when every date series with data is daily. */
export function allFieldsDaily(rows: DataRow[], fields: string[]): boolean {
    const observed = fields.filter(field => rows.some(row => toFiniteNumber(row[field]) !== null));
    return observed.length > 0 && observed.every(field => isDailyField(rows, field));
}

/** Date candidates: the non-daily series, or every field when all are daily. */
function dateCandidateFields(rows: DataRow[], fields: string[]): string[] {
    const nonDaily = fields.filter(field => !isDailyField(rows, field));
    return nonDaily.length > 0 ? nonDaily : fields;
}

export function nextExpectedCatalogEvent(
    spec: CatalogIndicatorSpec,
    valueRow: DataRow,
    referenceDate: string | null,
    rawDate: string | null,
    publicationDate: string | null,
    sourcePublicationDates: Record<string, string | null> | undefined,
    normalizedRows: DataRow[],
    rawRows: DataRow[],
): { date: string; description: string | null; estimated: boolean } | null {
    if (!spec.getNextExpectedEvents) return null;

    const today = argentinaToday();
    const events = spec.getNextExpectedEvents({ valueRow, referenceDate, rawDate, publicationDate, sourcePublicationDates, normalizedRows, rawRows, today })
        .filter(event => /^\d{4}-\d{2}-\d{2}$/.test(event.date) && event.date >= today)
        .sort((a, b) => a.date.localeCompare(b.date) || (b.priority ?? 0) - (a.priority ?? 0));

    // An official calendar event always wins; estimates are only a fallback, flagged for the table's footnote.
    const event = events.find(candidate => candidate.official) ?? events[0];
    return event ? { date: isoToFecha(event.date), description: sourceLabel(event.label, spec.valueSourceFields ?? spec.rawDateFields), estimated: !event.official || !!event.estimated } : null;
}

export function referenceRowForSpec(spec: CatalogIndicatorSpec, valueRow: DataRow, normalizedRows: DataRow[], rawRows: DataRow[]): DataRow | null {
    const valueDate = rowDate(valueRow);
    if (!valueDate) return null;
    const referenceDate = spec.getReferenceDate(valueDate);
    const sourceRows = spec.referenceSource === 'raw' ? rawRows : normalizedRows;
    return sourceRows.find(row => rowDate(row) === referenceDate) ?? null;
}
